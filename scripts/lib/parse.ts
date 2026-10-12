// Turns the conference's Word files into clean lessons and daily readings.
// Word files are read with mammoth (docx to HTML), then each paragraph is
// classified by its label (TOPIC, BIBLE TEXT, PRAYER...) in English or Yoruba.

import mammoth from "mammoth";

export type Lang = "en" | "yo";

export type Block =
  | { t: "h"; x: string }
  | { t: "p"; x: string }
  | { t: "li"; x: string; ordered: boolean }
  | { t: "mv"; x: string; ref: string }
  | { t: "lab"; k: string; x: string };

export type Part = {
  name: string; // "Lesson One" / "Eko Kinni" (lessons only)
  topic: string;
  text: string; // Bible text reference(s)
  body: Block[];
  dupes?: number; // paragraphs printed twice in the source (removed)
};

export type Lesson = { n: number; date: string; review: boolean; en: Part; yo: Part };
export type Reading = { date: string; sunday: boolean; en: Part; yo: Part };

type Para = { tag: string; text: string; bold: boolean; ordered: boolean };

// ---------- text helpers ----------

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Upper case without tone marks or dots, so "ÀDÚRÀ" and "Adura" both read "ADURA". */
export const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

const titleCase = (s: string) => {
  const small = new Set(["of", "the", "and", "to", "in", "a", "for", "is", "with", "on", "at", "that"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/^(\(?)(\p{L})/u, (_, p, c) => p + c.toUpperCase())))
    .join(" ")
    .replace(/\b(Ii|Iii|Iv)\b/g, (m) => m.toUpperCase())
    .replace(/Ⅱ/g, "II");
};

/** Topics in the files are in capitals. Show them in title case; keep Yoruba tone marks as written. */
const niceTopic = (s: string) => titleCase(s.replace(/\.$/, "").trim());

// ---------- read a Word file into paragraphs ----------

export async function readDocx(path: string): Promise<Para[]> {
  const { value } = await mammoth.convertToHtml({ path });
  const out: Para[] = [];
  const re = /<(p|li|h[1-6])(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<(ol|ul)>|<\/(ol|ul)>/g;
  const listStack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    if (m[3]) { listStack.push(m[3]); continue; }
    if (m[4]) { listStack.pop(); continue; }
    // A line break inside a paragraph often separates two labels (TOPIC<br>BIBLE TEXT).
    const wholeBold = /^<strong>[\s\S]*<\/strong>$/.test(m[2].trim());
    for (let inner of m[2].split(/<br\s*\/?>/)) {
      if (wholeBold) inner = `<strong>${inner.replace(/<\/?strong>/g, "")}</strong>`;
      const text = decode(inner);
      if (!text) continue;
      const boldText = decode((inner.match(/<strong>[\s\S]*?<\/strong>/g) || []).join(" "));
      out.push({
        tag: m[1],
        text,
        bold: boldText.length >= text.length * 0.9,
        ordered: listStack[listStack.length - 1] === "ol",
      });
    }
  }
  return out;
}

// ---------- labels ----------

const LABEL = {
  topic: /^(\(\d+\)\s*)?(TOPICS?|ORI[\s-]*ORO|AKORI)\s*[:\-]\s*/,
  text: /^(BIBLE\s*(TEXTS?|TEX|VERSES?|READING)|TEXTS?|BIBELI\s*KIKA|ORO\s*BIBELI|BIBELI)\s*[:\-]?\s*/,
  // Tolerates the typos found in the 2027 files: MEMEORY VERSE, MEMORY VENSE.
  memory: /^(MEM[A-Z]*\s*VE[A-Z]*SE|GOLDEN\s*VERSE|ESE\s*AKOSORI)\s*[:\-]?\s*/,
};
const NAMED: [RegExp, { en: string; yo: string }][] = [
  [/^P?RA[YT]ER|^ADURA/, // also RAYER, PRATER (typos in the 2027 files)
   { en: "Prayer", yo: "Àdúrà" }],
  [/^CHALLENGE|^IPENIJA/, { en: "Challenge", yo: "Ìpèníjà" }],
  [/^QUESTIONS?\s*(\(S\))?|^IBEERE/, { en: "Question", yo: "Ìbéèrè" }],
  [/^CONCLUSION|^IPARI/, { en: "Conclusion", yo: "Ìparí" }],
  [/^INTRODUCTION|^IFAARA/, { en: "Introduction", yo: "Ìfáàrà" }],
  // Children's Manual sections
  [/^ASSIGNMENT|^ISE\s*AMURELE/, { en: "Assignment", yo: "Iṣẹ́ Àmúrelé" }],
  [/^INSTRUCTIONAL\s*MATERIALS?|^(AWON\s*)?OHUN\s*ELO\s*EKO/, { en: "Instructional materials", yo: "Àwọn ohun èlò ẹ̀kọ́" }],
  [/^LESSON\s*OBJECTIVES?|^AFOJUSUN\s*EKO/, { en: "Lesson objectives", yo: "Àfojúsùn ẹ̀kọ́" }],
];

const afterLabel = (text: string, re: RegExp) => {
  // Remove the label from the original text using the plain copy's match length.
  const m = plain(text).match(re);
  return m ? text.slice(m[0].length).trim().replace(/^[:\-]\s*/, "") : text;
};

function memoryVerse(x: string): { x: string; ref: string } {
  const i = Math.max(x.lastIndexOf("”"), x.lastIndexOf('"'));
  if (i > 0 && i < x.length - 1) return { x: x.slice(0, i + 1).trim(), ref: x.slice(i + 1).replace(/^[\s.,;:]+/, "").trim() };
  return { x, ref: "" };
}

/** Turn the paragraphs of one lesson or day into structured parts. */
function toPart(paras: Para[], lang: Lang, skip: (p: Para) => boolean): Part {
  const part: Part = { name: "", topic: "", text: "", body: [] };
  for (const p of paras) {
    if (skip(p)) continue;
    const u = plain(p.text);
    if (!part.topic && LABEL.topic.test(u)) { part.topic = niceTopic(afterLabel(p.text, LABEL.topic)); continue; }
    if (!part.text && LABEL.text.test(u) && /\d/.test(p.text) && p.text.length < 160) {
      part.text = afterLabel(p.text, LABEL.text).replace(/(\d)\.(\d)/g, "$1:$2");
      continue;
    }
    if (LABEL.memory.test(u)) { part.body.push({ t: "mv", ...memoryVerse(afterLabel(p.text, LABEL.memory)) }); continue; }
    const named = NAMED.find(([re]) => re.test(u));
    if (named) {
      const rest = p.text.replace(/^[^:]*:\s*/, "").trim();
      const hasColon = p.text.includes(":") && p.text.indexOf(":") < 24;
      if (hasColon && rest) { part.body.push({ t: "lab", k: named[1][lang], x: rest }); continue; }
      if (p.bold && p.text.length < 40) { part.body.push({ t: "h", x: named[1][lang] }); continue; }
    }
    if (p.tag === "li") part.body.push({ t: "li", x: p.text, ordered: p.ordered });
    else if (p.bold && p.text.length < 140) part.body.push({ t: "h", x: p.text.replace(/:$/, "") });
    else part.body.push({ t: "p", x: p.text });
  }
  return tidy(part);
}

const LABEL_NAMES = new Set(NAMED.flatMap(([, v]) => [v.en, v.yo]));

/** Join "Prayer" + next paragraph into one labelled block; drop a paragraph printed twice in a row. */
function tidy(part: Part): Part {
  const out: Block[] = [];
  for (const b of part.body) {
    const prev = out[out.length - 1];
    if (prev && b.t === "p" && prev.t === "p" && prev.x === b.x) { part.dupes = (part.dupes || 0) + 1; continue; }
    if (prev && prev.t === "h" && LABEL_NAMES.has(prev.x) && /Prayer|Àdúrà|Challenge|Ìpèníjà/.test(prev.x) && b.t === "p") {
      out[out.length - 1] = { t: "lab", k: prev.x, x: b.x };
      continue;
    }
    out.push(b);
  }
  part.body = out;
  return part;
}

/** Spelling slips in labels, kept so the printed book can be corrected too. */
export function labelTypos(paras: Para[]): string[] {
  const typos = ["RAYER:", "PRATER:", "MEMEORY", "VENSE", "BIBLE TEX:"];
  return paras.filter((p) => typos.some((t) => p.text.toUpperCase().startsWith(t) || p.text.toUpperCase().includes(" " + t))).map((p) => p.text.slice(0, 40));
}

// ---------- Sunday School Manual ----------

const isLessonHead = (lang: Lang) => (p: Para) =>
  p.text.length < 40 &&
  (lang === "en" ? /^Lesson\s+[A-Z][a-z]+(-[A-Z][a-z]+)?$/.test(p.text) : /^Eko\s+[A-Za-z-]+$/.test(p.text));

const isLessonDate = (p: Para) =>
  p.text.length < 60 && /2027/.test(p.text) && /^(SUNDAY|OJO|ỌJỌ́|OJỌ)/i.test(plain(p.text));

function splitLessons(paras: Para[], lang: Lang) {
  const out: { name: string; paras: Para[] }[] = [];
  for (const p of paras) {
    if (isLessonHead(lang)(p)) out.push({ name: p.text, paras: [] });
    else if (out.length) out[out.length - 1].paras.push(p);
  }
  return out;
}

export function buildManual(en: Para[], yo: Para[], firstSunday: string): { lessons: Lesson[]; problems: string[] } {
  const problems: string[] = [];
  const E = splitLessons(en, "en");
  const Y = splitLessons(yo, "yo");
  if (E.length !== Y.length) problems.push(`English has ${E.length} lessons, Yoruba has ${Y.length}.`);
  const lessons: Lesson[] = [];
  for (let i = 0; i < Math.max(E.length, Y.length); i++) {
    const date = addDays(firstSunday, 7 * i);
    const e = E[i], y = Y[i];
    const review = !!e && e.paras.some((p) => /REVIEW OF LESSONS/.test(plain(p.text)));
    const enPart = e ? toPart(e.paras, "en", isLessonDate) : emptyPart();
    const yoPart = y ? toPart(y.paras, "yo", isLessonDate) : emptyPart();
    enPart.name = e?.name ?? "";
    yoPart.name = y?.name ?? "";
    if (review) {
      // Review lessons have no TOPIC label; their first heading is the title.
      for (const part of [enPart, yoPart]) {
        const first = part.body.findIndex((b) => b.t === "h");
        if (!part.topic && first >= 0) {
          part.topic = niceTopic((part.body[first] as { x: string }).x.replace(/[–—]/g, "to"));
          part.body.splice(first, 1);
        }
      }
    }
    for (const [lang, part] of [["English", enPart], ["Yoruba", yoPart]] as const) {
      if (part.dupes) problems.push(`Lesson ${i + 1}: ${lang} has a paragraph printed twice (removed in the app).`);
      delete part.dupes;
    }
    if (!e?.paras.some(isLessonDate)) problems.push(`Lesson ${i + 1}: English has no date line (app uses ${date}).`);
    if (!enPart.topic) problems.push(`Lesson ${i + 1}: English topic not found.`);
    if (!yoPart.topic) problems.push(`Lesson ${i + 1}: Yoruba topic not found.`);
    if (!review && !enPart.text) problems.push(`Lesson ${i + 1}: English Bible text not found.`);
    if (!review && !yoPart.text) problems.push(`Lesson ${i + 1}: Yoruba Bible text not found.`);
    lessons.push({ n: i + 1, date, review, en: enPart, yo: yoPart });
  }
  return { lessons, problems };
}

// ---------- Children's Sunday School Manual ----------
// No "Lesson One" headings: each lesson starts at its Sunday date line.
// Each month opens with a THEME (English) / AKORI (Yoruba) that applies to its lessons.

export type ChildLesson = { n: number; date: string; theme: { en: string; yo: string }; en: Part; yo: Part };

const THEME = /^(THEME|AKORI)\s*:\s*/;

function childDate(p: Para, lang: Lang, year: number): string | null | "unknown" {
  if (p.text.length > 60) return null;
  const u = plain(p.text);
  if (!/\d/.test(u)) return null; // a bare "Sunday" in the text is not a date line
  if (lang === "en") {
    if (!/^SUNDAY\b/.test(u)) return null;
    const m = u.match(/(\d{1,2})\s*(ST|ND|RD|TH)?\s*,?\s*(OF\s+)?([A-Z]+)?/);
    const mi = m && m[4] ? MONTHS.indexOf(m[4]) : -1;
    return m && mi >= 0 ? iso(year, mi + 1, +m[1]) : "unknown";
  }
  // Also accepts the typo "OKO AIKU" (8 August 2027).
  const m = u.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  if (m && /^O[JK]O\s*AIKU/.test(u)) return iso(year, +m[2], +m[1]);
  return /^OJO\s*AIKU/.test(u) ? "unknown" : null;
}

function splitChildren(paras: Para[], lang: Lang, year: number) {
  const out = new Map<string, { theme: string; paras: Para[] }>();
  const problems: string[] = [];
  const L = lang === "en" ? "English" : "Yoruba";
  let theme = "", cur: string | null = null, last = `${year - 1}-12-27`, hasTopic = false;
  for (const p of paras) {
    const u = plain(p.text);
    if (THEME.test(u) && p.text.length < 120) { theme = niceTopic(afterLabel(p.text, THEME).replace(/["“”]/g, "")); continue; }
    let d = childDate(p, lang, year);
    // A second topic before any new date line means a lesson's date line is missing.
    if (!d && LABEL.topic.test(u) && (hasTopic || !cur)) {
      d = addDays(last, 7);
      problems.push(`${d}: ${L} date line is missing (lesson "${afterLabel(p.text, LABEL.topic)}").`);
      cur = d; last = d; hasTopic = true;
      out.set(d, { theme, paras: [p] });
      continue;
    }
    if (!d && LABEL.topic.test(u)) hasTopic = true;
    if (d) {
      if (d === "unknown") {
        d = addDays(last, 7); // date line has no month: take the Sunday after the last one
        problems.push(`${d}: ${lang === "en" ? "English" : "Yoruba"} date line is incomplete ("${p.text}").`);
      }
      if (lang === "yo" && /^OKO/.test(u)) problems.push(`${d}: Yoruba date line says "OKO AIKU" (should be "OJO AIKU").`);
      cur = d; last = d; hasTopic = false;
      if (out.has(d)) problems.push(`${d}: ${lang === "en" ? "English" : "Yoruba"} has this Sunday twice.`);
      out.set(d, { theme, paras: [] });
      continue;
    }
    if (cur) out.get(cur)!.paras.push(p);
  }
  return { lessons: out, problems };
}

export function buildChildren(en: Para[], yo: Para[], firstSunday: string): { lessons: ChildLesson[]; problems: string[] } {
  const E = splitChildren(en, "en", +firstSunday.slice(0, 4));
  const Y = splitChildren(yo, "yo", +firstSunday.slice(0, 4));
  const problems = [...E.problems, ...Y.problems];
  const lessons: ChildLesson[] = [];
  const noSkip = () => false;
  for (let d = firstSunday, n = 1; d.startsWith(firstSunday.slice(0, 4)); d = addDays(d, 7), n++) {
    const e = E.lessons.get(d), y = Y.lessons.get(d);
    if (!e) problems.push(`${d}: no lesson in English.`);
    if (!y) problems.push(`${d}: no lesson in Yoruba.`);
    if (!e && !y) continue;
    const enPart = e ? toPart(e.paras, "en", noSkip) : emptyPart();
    const yoPart = y ? toPart(y.paras, "yo", noSkip) : emptyPart();
    for (const [lang, part] of [["English", enPart], ["Yoruba", yoPart]] as const) {
      delete part.dupes;
      // Half-year review lessons have no TOPIC label; their first heading is the title.
      const first = part.body.findIndex((b) => b.t === "h");
      if (!part.topic && first >= 0 && /^(REVIEW|ATUNYEWO)/.test(plain((part.body[first] as { x: string }).x))) {
        part.topic = niceTopic((part.body[first] as { x: string }).x.replace(/[–—]/g, "to"));
        part.body.splice(first, 1);
      }
      if ((lang === "English" ? e : y) && !part.topic) problems.push(`${d}: ${lang} topic not found.`);
    }
    if (refsDiffer(enPart.text, yoPart.text))
      problems.push(`${d}: Bible text differs. EN "${enPart.text}" / YO "${yoPart.text}".`);
    lessons.push({ n, date: d, theme: { en: e?.theme ?? "", yo: y?.theme ?? "" }, en: enPart, yo: yoPart });
  }
  return { lessons, problems };
}

// ---------- Daily Divine Bread ----------

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

function dayKey(p: Para, lang: Lang, year: number): string | null {
  if (p.text.length > 60) return null;
  const u = plain(p.text);
  if (lang === "en") {
    const m = u.match(/(SUN|MON|TUES|WEDNES|THURS|FRI|SATUR)DAY,?\s*(\d{1,2})\s*(ST|ND|RD|TH)?\s*,?\s*(OF\s+)?([A-Z]+)/);
    if (!m) return null;
    const mi = MONTHS.indexOf(m[5]);
    return mi < 0 ? null : iso(year, mi + 1, +m[2]);
  }
  const m = u.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  return m && +m[3] === year ? iso(year, +m[2], +m[1]) : null;
}

function splitDays(paras: Para[], lang: Lang, year: number) {
  const out = new Map<string, Para[]>();
  let cur: string | null = null;
  for (const p of paras) {
    const k = dayKey(p, lang, year);
    if (k) { cur = k; if (!out.has(k)) out.set(k, []); continue; }
    if (cur) out.get(cur)!.push(p);
  }
  return out;
}

export function buildDaily(en: Para[], yo: Para[], year: number): { readings: Reading[]; problems: string[] } {
  const problems: string[] = [];
  const E = splitDays(en, "en", year);
  const Y = splitDays(yo, "yo", year);
  const notHeader = (p: Para) => /^[A-Z ,]+\d{4}$/.test(plain(p.text)) && p.text.length < 30; // month banners
  const readings: Reading[] = [];
  for (let d = `${year}-01-01`; d.startsWith(String(year)); d = addDays(d, 1)) {
    const sunday = new Date(d + "T12:00:00Z").getUTCDay() === 0;
    const e = E.get(d), y = Y.get(d);
    if (!e) problems.push(`${d}: missing in English.`);
    if (!y) problems.push(`${d}: missing in Yoruba.`);
    const enPart = trimAfterPrayer(e ? toPart(e, "en", notHeader) : emptyPart());
    const yoPart = trimAfterPrayer(y ? toPart(y, "yo", notHeader) : emptyPart());
    for (const [lang, part, has] of [["English", enPart, !!e], ["Yoruba", yoPart, !!y]] as const) {
      if (!has || sunday) continue;
      if (!part.body.some((b) => b.t === "mv")) problems.push(`${d}: ${lang} memory verse not found.`);
      if (!part.body.some((b) => b.t === "lab" && /Prayer|Àdúrà/.test(b.k))) problems.push(`${d}: ${lang} prayer is missing or empty.`);
      if (part.dupes) problems.push(`${d}: ${lang} has a paragraph printed twice (removed in the app).`);
      delete part.dupes;
    }
    if (e && !enPart.topic) problems.push(`${d}: English topic not found.`);
    if (y && !yoPart.topic) problems.push(`${d}: Yoruba topic not found.`);
    readings.push({ date: d, sunday, en: enPart, yo: yoPart });
  }
  return { readings, problems };
}

/** Anything after the prayer belongs to a month banner or the next day; drop it. */
function trimAfterPrayer(part: Part): Part {
  const i = part.body.findIndex((b) => b.t === "lab" && /Prayer|Àdúrà/.test(b.k));
  if (i >= 0) part.body = part.body.slice(0, i + 1);
  return part;
}

// ---------- English vs Yoruba checks (run after corrections) ----------

export const checkManual = (lessons: Lesson[]) =>
  lessons
    .filter((l) => !l.review && refsDiffer(l.en.text, l.yo.text))
    .map((l) => `Lesson ${l.n}: Bible text differs. EN "${l.en.text}" / YO "${l.yo.text}".`);

export const checkDaily = (readings: Reading[]) =>
  readings
    .filter((r) => refsDiffer(r.en.text, r.yo.text))
    .map((r) => `${r.date}: Bible text differs. EN "${r.en.text}" / YO "${r.yo.text}".`);

// ---------- shared ----------

const emptyPart = (): Part => ({ name: "", topic: "", text: "", body: [] });
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export function addDays(isoDate: string, n: number) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const refNums = (s: string) =>
  (s.match(/\d+\s*[:.]\s*\d+(\s*[-–—]\s*\d+)?/g) || []).map((x) => x.replace(/\s/g, "").replace(/[–—]/g, "-").replace(".", ":"));
const refsDiffer = (a: string, b: string) => !!a && !!b && refNums(a).join() !== refNums(b).join();
