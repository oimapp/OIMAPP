// Turns a lesson's body into plain text the team can edit in a box, and back again.
//
//   ## Heading
//   - list item
//   > Memory verse text | Psalms 100:4
//   Prayer: Lord, ...            (any "Label: text" line from the list below)
//   Ordinary paragraph
//
// Blocks are separated by one empty line.

export type Block =
  | { t: "h"; x: string }
  | { t: "p"; x: string }
  | { t: "li"; x: string; ordered?: boolean }
  | { t: "mv"; x: string; ref: string }
  | { t: "lab"; k: string; x: string };

export const LABELS = [
  "Prayer", "Àdúrà", "Challenge", "Ìpèníjà", "Question", "Ìbéèrè", "Conclusion", "Ìparí",
  "Introduction", "Ìfáàrà", "Assignment", "Iṣẹ́ Àmúrelé", "Instructional materials",
  "Àwọn ohun èlò ẹ̀kọ́", "Lesson objectives", "Àfojúsùn ẹ̀kọ́",
];

export function toText(body: Block[]): string {
  return body
    .map((b) => {
      switch (b.t) {
        case "h": return `## ${b.x}`;
        case "li": return `- ${b.x}`;
        case "mv": return `> ${b.x}${b.ref ? ` | ${b.ref}` : ""}`;
        case "lab": return `${b.k}: ${b.x}`;
        default: return b.x;
      }
    })
    .join("\n\n");
}

export function fromText(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const s = raw.trim().replace(/\s*\n\s*/g, " ");
    if (!s) continue;
    if (s.startsWith("## ")) { out.push({ t: "h", x: s.slice(3).trim() }); continue; }
    if (s.startsWith("- ")) { out.push({ t: "li", x: s.slice(2).trim() }); continue; }
    if (s.startsWith("> ")) {
      const [x, ref = ""] = s.slice(2).split(" | ");
      out.push({ t: "mv", x: x.trim(), ref: ref.trim() });
      continue;
    }
    const label = LABELS.find((k) => s.toLowerCase().startsWith(k.toLowerCase() + ":"));
    if (label) { out.push({ t: "lab", k: label, x: s.slice(label.length + 1).trim() }); continue; }
    out.push({ t: "p", x: s });
  }
  return out;
}
