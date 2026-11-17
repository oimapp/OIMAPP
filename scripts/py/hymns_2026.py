"""Read the 2026 English and Yoruba hymn book editions (Word files) into one list.

Run from the project folder (needs python-docx):
    python scripts/py/hymns_2026.py "English.docx" "Yoruba.docx" content/out/hymns-2026.json

Each hymn comes out as one record with both languages:
    {series, number, label, category_en, category_yo, title_en, title_yo,
     text_en, text_yo, scripture_en, scripture_yo, tune}
Verses are separated by an empty line. A chorus starts with "Chorus:" (English)
or "Ègbè:" (Yoruba). The Word files mark every hymn with Heading 2 and every
section with Heading 1, so the reading is simple and exact.
"""

import json
import re
import sys

import docx

ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50}


def roman(s):
    total, prev = 0, 0
    for ch in reversed(s.upper()):
        v = ROMAN[ch]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def title_case(s):
    """'AWAKE MY SOUL AND WITH THE SUN' -> 'Awake My Soul And With The Sun' (keeps Yoruba marks)."""
    out = []
    for w in s.split():
        if w.isupper() or not any(c.islower() for c in w):
            out.append(w[:1] + w[1:].lower())
        else:
            out.append(w)
    return " ".join(out)


def is_italic(p):
    runs = [r for r in p.runs if r.text.strip()]
    return bool(runs) and all(r.italic for r in runs)


SCRIPTURE = re.compile(r'[“"”]|\d+\s*:\s*\d+|\s-\s*\d?\s*[A-Z][a-z]')
CHORUS = re.compile(r"^(CHORUS|EGBE|ÈGBÈ|ÈGBE|EGBÈ|REFRAIN)\s*[:.]?\s*", re.I)
AMEN = re.compile(r"^(AMEN|AMIN)[.!]?$", re.I)
TUNE = re.compile(r"\(FE ?\d+\)|^Tune:|C\.M\.S|\bH\.C\b|^\d+s(\s|$)|^[SCL]\.M\.?(\s|$)")
VERSE = re.compile(r"^(\d+)\s*[.)]\s+")


def read(path, lang):
    d = docx.Document(path)
    hymns, cat, cur = [], "", None
    stop = False
    for p in d.paragraphs:
        t = p.text.strip()
        style = p.style.name
        if style == "Heading 1":
            if re.search(r"INDEX|ATỌKA|ATOKA", t, re.I):
                stop = True
            cat = t
            continue
        if stop:
            continue
        if style == "Heading 2":
            m = re.match(r"^(?:KNEELING SONG|ORIN AKUNL\S*)\s+([IVXL]+)$", t, re.I)
            if m:
                cur = {"series": "akunleko", "number": roman(m.group(1)), "label": m.group(1).upper()}
            else:
                m = re.match(r"^(?:HYMN|ORIN)\s+(\d+)$", t, re.I)
                if not m:
                    cur = None
                    continue
                cur = {"series": "main", "number": int(m.group(1)), "label": ""}
            cur.update({"category": cat, "title": "", "scripture": [], "tune": [], "blocks": []})
            hymns.append(cur)
            continue
        if cur is None or not t:
            continue
        if not cur["title"] and not cur["blocks"] and cur["series"] == "main" and not is_italic(p) and not VERSE.match(t):
            cur["title"] = title_case(t)
            continue
        if not cur["blocks"] and cur.get("_quote"):
            cur["scripture"].append(t)
            if re.search(r'[”"]|\d+\s*:\s*\d+', t):
                cur["_quote"] = False
            continue
        # "772.  C.M.S 526 7s (FE 805)": the hymn number printed again before the tune line.
        hm = VERSE.match(t)
        if not cur["blocks"] and hm and int(hm.group(1)) == cur["number"] and cur["series"] == "main":
            rest = t[hm.end():]
            if TUNE.search(rest) or rest[:1] in '“"(':
                t = rest
        if not cur["blocks"] and not VERSE.match(t) and (TUNE.search(t) or t[:1] in '“"'):
            if t[:1] in '“"':
                cur["scripture"].append(t)
                cur["_quote"] = not re.search(r'.[”"]|\d+\s*:\s*\d+', t[1:])
            else:
                cur["tune"].append(t)
            continue
        if not cur["blocks"] and is_italic(p):
            if re.match(r"^PART\s+[IVX]+$", t, re.I):
                continue
            (cur["scripture"] if SCRIPTURE.search(t) else cur["tune"]).append(t)
            continue
        if re.match(r"^PART\s+[IVX]+$", t, re.I):
            continue
        if AMEN.match(t):
            continue
        m = VERSE.match(t)
        c = CHORUS.match(t)
        if m:
            cur["blocks"].append([t[m.end():]])
        elif c:
            label = "Chorus:" if lang == "en" else "Ègbè:"
            cur["blocks"].append([f"{label} {t[c.end():]}".strip()])
        elif cur["blocks"] and not cur.get("_closed"):
            cur["blocks"][-1].append(t)
        else:
            cur["blocks"].append([t])
    out = {}
    for h in hymns:
        # Tune or Bible lines that slipped into the first verse.
        while h["blocks"] and h["blocks"][0]:
            first = h["blocks"][0][0]
            if TUNE.search(first) and len(first) < 60:
                h["tune"].append(first)
                h["blocks"][0].pop(0)
            elif first[:1] in '“"':
                while h["blocks"][0]:
                    line = h["blocks"][0].pop(0)
                    h["scripture"].append(line)
                    if re.search(r'.[”"]|\d+\s*:\s*\d+', line[1:]):
                        break
            else:
                break
            if not h["blocks"][0]:
                h["blocks"].pop(0)
        text = "\n\n".join("\n".join(b) for b in h["blocks"])
        if not h["title"]:
            first = h["blocks"][0][0] if h["blocks"] else ""
            first = CHORUS.sub("", first)
            h["title"] = first.rstrip(",.;:!") if first else ""
        out[(h["series"], h["number"])] = {
            "series": h["series"], "number": h["number"], "label": h["label"],
            "category": title_case(h["category"]), "title": h["title"], "text": text,
            "scripture": " ".join(h["scripture"]), "tune": " ".join(h["tune"]),
        }
    return out


def main():
    en_path, yo_path, out_path = sys.argv[1:4]
    en, yo = read(en_path, "en"), read(yo_path, "yo")
    keys = sorted(set(en) | set(yo), key=lambda k: (k[0] != "akunleko", k[1]))
    rows, problems = [], []
    for k in keys:
        e, y = en.get(k), yo.get(k)
        if not e or not y:
            problems.append(f"{k[0]} {k[1]}: only in {'English' if e else 'Yoruba'}")
        if (e and not e["text"]) or (y and not y["text"]):
            problems.append(f"{k[0]} {k[1]}: no words in {'English' if e and not e['text'] else 'Yoruba'}")
        base = e or y
        rows.append({
            "series": k[0], "number": k[1], "label": base["label"],
            "category_en": e["category"] if e else "", "category_yo": y["category"] if y else "",
            "title_en": e["title"] if e else "", "title_yo": y["title"] if y else "",
            "text_en": e["text"] if e else "", "text_yo": y["text"] if y else "",
            "scripture_en": e["scripture"] if e else "", "scripture_yo": y["scripture"] if y else "",
            "tune": (y or e)["tune"] or (e or y)["tune"],
        })
    json.dump(rows, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    main_n = sum(1 for r in rows if r["series"] == "main")
    kneel_n = sum(1 for r in rows if r["series"] == "akunleko")
    print(f"{main_n} hymns and {kneel_n} kneeling songs written to {out_path}")
    for p in problems:
        print("CHECK:", p)


if __name__ == "__main__":
    main()
