// Reads the six Word files in content/source, applies content/corrections.json,
// and writes clean JSON to content/out plus a report of anything that looks wrong.
//
// Run:  npm run import

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readDocx, buildManual, buildDaily, buildChildren, checkManual, checkDaily, labelTypos, Part, Lesson, Reading } from "./lib/parse";

const YEAR = 2027;
const FIRST_SUNDAY = "2027-01-03";
const SRC = "content/source";
const OUT = "content/out";

/** The adult manual's file names also contain SUNDAY SCHOOL, so skip the children's files. */
function findAdult(lang: string) {
  const f = readdirSync(SRC).find((n) => n.endsWith(".docx") && /SUNDAY.SCHOOL/i.test(n) && !/CHILD/i.test(n) && n.toUpperCase().includes(lang));
  if (!f) throw new Error(`Could not find the ${lang} Sunday School Manual .docx in ${SRC}.`);
  return join(SRC, f);
}

/** Find a Word file by words in its name, so renamed copies still work. */
function find(...words: string[]) {
  const f = readdirSync(SRC).find((n) => n.endsWith(".docx") && words.every((w) => n.toUpperCase().includes(w)));
  if (!f) throw new Error(`Could not find a .docx in ${SRC} with ${words.join(" + ")} in its name.`);
  return join(SRC, f);
}

type Fix = { book: "manual" | "daily"; key: number | string; lang: "en" | "yo"; find: string; replace: string };

function applyFix(part: Part, fix: Fix): boolean {
  let hit = false;
  const swap = (s: string) => {
    if (!s.includes(fix.find)) return s;
    hit = true;
    return s.split(fix.find).join(fix.replace);
  };
  part.topic = swap(part.topic);
  part.text = swap(part.text);
  for (const b of part.body) {
    if ("x" in b) b.x = swap(b.x);
    if (b.t === "mv") b.ref = swap(b.ref);
  }
  return hit;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log("Reading Word files...");
  const [mEn, mYo, dEn, dYo] = await Promise.all([
    readDocx(findAdult("ENGLISH")),
    readDocx(findAdult("YORUBA")),
    readDocx(find("DAILY", "ENGLISH")),
    readDocx(find("DAILY", "YORUBA")),
  ]);

  const manual = buildManual(mEn, mYo, FIRST_SUNDAY);
  const children = buildChildren(
    await readDocx(find("CHILDREN", "ENGLISH")),
    await readDocx(find("CHILDREN", "YORUBA")),
    FIRST_SUNDAY,
  );
  const daily = buildDaily(dEn, dYo, YEAR);

  const corrections = JSON.parse(readFileSync("content/corrections.json", "utf8"));
  const applied: string[] = [];
  for (const fix of corrections.fixes as Fix[]) {
    const item: Lesson | Reading | undefined =
      fix.book === "manual" ? manual.lessons.find((l) => l.n === fix.key) : daily.readings.find((r) => r.date === fix.key);
    const ok = item ? applyFix(item[fix.lang], fix) : false;
    applied.push(`${ok ? "Applied" : "NOT FOUND"}: ${fix.book} ${fix.key} (${fix.lang}) "${fix.find}" to "${fix.replace}"`);
  }

  manual.problems.push(...checkManual(manual.lessons));
  daily.problems.push(...checkDaily(daily.readings));

  writeFileSync(join(OUT, `manual-${YEAR}.json`), JSON.stringify(manual.lessons, null, 1));
  writeFileSync(join(OUT, `daily-${YEAR}.json`), JSON.stringify(daily.readings, null, 1));
  writeFileSync(join(OUT, `children-${YEAR}.json`), JSON.stringify(children.lessons, null, 1));

  const report = [
    `# Content import report, ${YEAR}`,
    "",
    `Sunday School Manual: ${manual.lessons.length} lessons.`,
    `Daily Divine Bread: ${daily.readings.length} days.`,
    `Children's Sunday School Manual: ${children.lessons.length} lessons.`,
    "",
    "## Corrections",
    ...applied.map((a) => `- ${a}`),
    "",
    "## Still waiting for the conference",
    ...(corrections.waiting_for_conference as string[]).map((w) => `- ${w}`),
    "",
    "## Spelling slips in labels (for the printed book)",
    ...[mEn, mYo, dEn, dYo].flatMap(labelTypos).map((t) => `- "${t}..."`),
    "",
    "## Sunday School Manual: things to check",
    ...(manual.problems.length ? manual.problems.map((p) => `- ${p}`) : ["- Nothing found."]),
    "",
    "## Daily Divine Bread: things to check",
    ...(daily.problems.length ? daily.problems.map((p) => `- ${p}`) : ["- Nothing found."]),
    "",
    "## Children's Sunday School Manual: things to check",
    ...(children.problems.length ? children.problems.map((p) => `- ${p}`) : ["- Nothing found."]),
    "",
  ].join("\n");
  writeFileSync(join(OUT, "report.md"), report);

  console.log(`Done. ${manual.lessons.length} lessons, ${daily.readings.length} days, ${children.lessons.length} children's lessons.`);
  console.log(`${manual.problems.length + daily.problems.length + children.problems.length} things to check. Open content/out/report.md`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
