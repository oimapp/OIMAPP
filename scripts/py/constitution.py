"""Read the Church Constitution (English) and the Òfin (Yoruba) Word files into sections.

Run from the project folder (needs python-docx):
    python scripts/py/constitution.py "CONSTITUTION.docx" "OFIN.docx" content/out/constitution.json

Output: {"en": [section, ...], "yo": [section, ...]} where a section is
    {"n": 1, "title": "1. NAME", "body": [{"t": "p", "x": "..."}, ...]}
Body blocks use the same shapes as the other books: h (sub-heading), p (paragraph), li (list item).
"""

import json
import re
import sys

import docx

SECTION = re.compile(r"^(\d+)\s*[a-zA-Zẹ]?\s*[.:/]?\s*(\d+)?\s*\S")


def bold(p):
    runs = [r for r in p.runs if r.text.strip()]
    return bool(runs) and all(r.bold for r in runs)


def clean(t):
    t = t.replace("\t", " ")
    t = re.sub(r"[  ]{2,}", " ", t)
    t = re.sub(r"[-_.]{6,}", " ", t)
    return t.strip()


def read(path):
    d = docx.Document(path)
    sections, cur, started = [], None, False
    for p in d.paragraphs:
        t = clean(p.text)
        if not t:
            continue
        is_head = bold(p) and SECTION.match(t) and len(t) < 120 and p.style.name != "List Paragraph" or (
            bold(p) and re.match(r"^\d+\s*[a-zA-Zẹ]?\.", t) and len(t) < 120)
        if is_head:
            started = True
            cur = {"n": len(sections) + 1, "title": t.rstrip(":").strip(), "body": []}
            sections.append(cur)
            continue
        if not started:
            continue
        if bold(p) and len(t) < 100:
            cur["body"].append({"t": "h", "x": t.rstrip(":").strip()})
        elif p.style.name == "List Paragraph":
            cur["body"].append({"t": "li", "x": t, "ordered": False})
        else:
            cur["body"].append({"t": "p", "x": t})
    return sections


def main():
    en_path, yo_path, out_path = sys.argv[1:4]
    out = {"en": read(en_path), "yo": read(yo_path)}
    json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for lang in ("en", "yo"):
        empty = [s["title"] for s in out[lang] if not s["body"]]
        print(f"{lang}: {len(out[lang])} sections; with no text: {empty}")


if __name__ == "__main__":
    main()
