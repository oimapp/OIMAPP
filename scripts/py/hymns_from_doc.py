import docx, re, json, sys, unicodedata
d = docx.Document(sys.argv[1])
L = [p.text for p in d.paragraphs]
nfc = lambda s: unicodedata.normalize('NFC', s)

CATS = [(1,8,'Orin Owurọ'),(9,19,'Orin Alẹ'),(20,44,'Orin Ọjọ Isinmi'),(45,71,'Orin Idariji Ẹsẹ'),(72,80,'Orin Iyasi Mimọ'),(81,149,'Orin Ọpẹ'),(150,152,'Orin Iyin'),(153,166,'Orin Agbara Ẹmi Mimọ'),(167,177,'Orin Ikore'),(178,197,'Orin Bibọ Jesu'),(198,209,'Orin Ibi Kristi'),(210,213,'Orin Opin Ọdun'),(214,217,'Orin Ifihan'),(218,234,'Orin Ọdun Tuntun'),(235,285,'Orin Irònúpiwàdà (Lẹnti)'),(286,288,'Orin Isinmi Ọpẹ'),(289,308,'Orin Ọsẹ Ijiya Jesu'),(309,316,'Orin Asalẹ Ajinde'),(317,340,'Orin Ajinde Jesu'),(341,349,'Orin Igoke Re Ọrun'),(350,376,'Orin Oke Ọrun'),(377,385,'Orin Pentikọsti'),(386,387,'Orin Ọjọ Isinmi Funfun'),(388,395,'Orin Ọjọ Mẹtalọkan'),(396,408,'Orin Ọrọ Ọlọrun'),(409,436,'Orin Adura'),(437,473,'Orin Igbagbọ'),(474,478,'Orin Aabo'),(479,490,'Orin Anu ati Ipese'),(491,496,'Orin Iwosan'),(497,512,'Orin Isẹgun'),(513,525,'Orin Ifẹ si Ọlọrun'),(526,536,'Orin Ifẹ si Ọmọ Ẹnikeji'),(537,549,'Orin Iwa Mimọ'),(550,582,'Orin Irin Ajo ati Ijagun'),(583,601,'Orin Isẹ Isin'),(602,612,'Orin Ikilọ ati Ipe'),(613,623,'Orin Iribọmi'),(624,645,'Orin Imulọkanle'),(646,652,'Orin Ounjẹ Alẹ Oluwa (Idapọ Mimọ)'),(653,660,'Orin Igbeyawo'),(661,662,'Orin Isọmọ Lorukọ'),(663,688,'Orin Ọjọ Obi ati Ọmọde'),(689,693,'Orin Ifi Ipilẹ Lelẹ'),(694,697,'Orin Isile'),(698,700,'Orin Ijọ Ọlọrun loke Ọrun'),(701,726,'Orin Ajọdun'),(727,730,'Orin Ajọdun Maikẹli Mimọ'),(731,748,'Orin Kérúbù ati Séráfù'),(749,768,'Orin Isinku'),(769,773,'Orin Saaju Adura'),(774,782,'Orin Saaju Ore-Ọfẹ ati Ibukun'),(783,9999,'Orin Oniruru Igba')]
def cat(n):
    for a,b,c in CATS:
        if a <= n <= b: return c
    return ''

ROMAN = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx','xxi','xxii','xxiii','xxiv','xxv','xxvi','xxvii','xxviii','xxix','xxx','xxxi','xxxii','xxxiii','xxxiv','xxxv','xxxvi','xxxvii','xxxviii','xxxix','xl','xli','xlii','xliii','xliv','xlv','xlvi','xlvii','xlviii','xlix','l']
DYN = re.compile(r'^(?:\s*\b(?:fff|ff|f|mf|mp|pp|p|cr|cres|di|dim)\b\.?)+\s+')
AMIN = re.compile(r'\bAMIN\b', re.I)

def find(label, start=0):
    for i in range(start, len(L)):
        if L[i].strip().replace('  ', ' ').startswith(label): return i
    raise SystemExit('not found ' + label)

a_start = find('ORIN AKUNLEKỌ', 1000); m_start = a_start + 1
main_start = 2056
isoji_start = find('ORIN ISỌJI ATI IDARAYA', 30000)
isoji_end = find('PSALMU 24', isoji_start)

problems = []

def is_amin(t): return bool(AMIN.search(t)) and len(t.strip()) < 40

def clean_line(t):
    t = nfc(t).replace(' ', ' ')
    t = re.sub(r'\s*\)\s*(\d)\s*ce\b', r' (\1ce)', t)
    t = re.sub(r'\s*\)\s*$', '', t)
    t = re.sub(r'[ \t]+', ' ', t).strip()
    return t

TUNE = re.compile(r'\(FE\s*\d|C\.?M\.?S\.|H\.C\.|S\.S\.?&|\bt\.\s?[A-Z]|^[\d. ]+s?\.?\s*(\(|$)|\b(L|C|S|D)\.\s?M\.|\bP\.?M\b|\d+s\.?\s|M\.H\.B|BAP/HY|BR/HY|A\s?&\s?M|LINES')
QUOTE = re.compile(r'^[“"‘]|[-–]\s*[1-3]?\s*[A-Za-zÀ-ỹ]+\.?\s*\d+\s*:\s*\d')

def body_to_text(lines):
    """Turn the lines of one hymn into verses separated by empty lines. Returns (text, scripture, tune)."""
    blocks, cur, pre = [], [], []
    started = False
    for raw in lines:
        t = raw.strip()
        if not t or is_amin(t): continue
        m = re.match(r'^(\d{1,2})(?:\.(?!\d)|\t|\s{2,})\s*(.*)$', t.replace('\u00a0', ' '))
        if m and re.search(r'\(FE\s*\d', t): m = None
        if m: m = re.match(r'^(\d{1,2})[.\s]\s*(.*)$', clean_line(t))
        if m:
            started = True
            if cur: blocks.append(cur)
            rest = DYN.sub('', ' ' + m.group(2)).strip()
            cur = [rest] if rest else []
            continue
        line = DYN.sub('', ' ' + clean_line(t)).strip()
        if not line: continue
        if not started:
            pre.append(line); continue
        if re.match(r'^(Egbe|Ẹgbẹ|Ègbè|Chorus)\s*:', line, re.I):
            if cur: blocks.append(cur)
            cur = ['Ègbè: ' + re.sub(r'^(Egbe|Ẹgbẹ|Ègbè|Chorus)\s*:\s*', '', line, flags=re.I)]
            continue
        cur.append(line)
    if cur: blocks.append(cur)
    quote, tune, rest = [], [], []
    for i, line in enumerate(pre):
        if rest: rest.append(line)
        elif re.match(r'^[-–]\s*[1-3I]*\s*[A-Za-zÀ-ỹ]', line) and re.search(r'\d', line) and len(line) < 32: quote.append(line)
        elif QUOTE.search(line) and not (quote and quote[-1].rstrip().endswith(('”', '"'))) and len(' '.join(quote)) < 300: quote.append(line)
        elif TUNE.search(line) and len(line) < 60: tune.append(line)
        else: rest.append(line)
    if not started and rest:   # no numbered verses: the remaining lines are the hymn
        text = []
        for line in rest:
            if re.match(r'^(Egbe|Ẹgbẹ|Ègbè|Chorus)\s*:', line, re.I):
                text.append(''); text.append('Ègbè: ' + re.sub(r'^(Egbe|Ẹgbẹ|Ègbè|Chorus)\s*:\s*', '', line, flags=re.I)); text.append('')
            else: text.append(line)
        body = re.sub(r'\n{3,}', '\n\n', '\n'.join(text)).strip()
    else:
        if rest: blocks.insert(0, rest)
        body = '\n\n'.join('\n'.join(b) for b in blocks if b)
    return body, ' '.join(quote), ' '.join(tune)

def title_of(text):
    first = text.split('\n')[0] if text else ''
    first = re.sub(r'^Ègbè:\s*', '', first)
    first = re.sub(r'\s*\(\dce\)', '', first).strip(' ,;:.!?“”"‘’')
    # The books print the first word in capitals: "JI, ọkan mi" -> "Ji, ọkan mi"
    w = first.split(' ', 1)
    if w and w[0].isupper() and len(w[0]) > 1: w[0] = w[0].capitalize()
    t = ' '.join(w)
    return t[:1].upper() + t[1:]

out = []

# --- Orin Akunlẹkọ (roman numbers)
i, k = a_start + 1, 0
starts = []
while i < main_start:
    t = L[i].strip()
    m = re.match(r'^([ivxl]+)\.?(\s|$)', t, re.I)
    if m and k < len(ROMAN) and m.group(1).lower() == ROMAN[k]:
        starts.append((i, ROMAN[k], k + 1)); k += 1
    elif m and m.group(1).lower() in ROMAN[k:k+3]:
        j = ROMAN.index(m.group(1).lower()); problems.append(f'Akunlẹkọ: number {ROMAN[k]} missing before {m.group(1)}')
        k = j; starts.append((i, ROMAN[k], k + 1)); k += 1
    i += 1
for n, (s, lab, num) in enumerate(starts):
    e = starts[n + 1][0] if n + 1 < len(starts) else main_start
    first = re.sub(r'^([ivxl]+)\.?', '', L[s].strip(), flags=re.I)
    body = ([first] if re.search(r'[A-Za-zỌẸṢ]{3,}', first) and not re.match(r'^\s*\d+s', first.strip()) else []) + L[s + 1:e]
    text, quote, _t = body_to_text(body)
    out.append({'series': 'akunleko', 'number': num, 'label': lab, 'title_yo': title_of(text), 'text_yo': text, 'scripture': quote, 'tune': '', 'category': 'Orin Akúnlẹ̀kọ'})

# --- Main hymns
starts, expect, prev = [], 1, 'AMIN'
for i in range(main_start, isoji_start):
    t = L[i].strip()
    if not t: continue
    m = re.match(r'^(\d{1,3})(?!\s*\.)(?=[\s(]|$)', t)
    if m:
        n = int(m.group(1))
        after_amin = is_amin(prev) or i == main_start or (prev == prev.upper() and len(prev) > 3 and not re.search(r'\d', prev))
        if n == expect or (after_amin and expect <= n <= expect + 3):
            if n != expect: problems.append(f'Hymn {expect}' + (f' to {n-1}' if n - 1 > expect else '') + ' not found (jumped to %d)' % n)
            starts.append((i, n)); expect = n + 1
        elif after_amin and expect - 1 <= n <= expect + 3:
            problems.append(f'Line "{t[:40]}" after hymn {expect-1} has number {n}; treated as hymn {expect}')
            starts.append((i, expect)); expect += 1
    prev = t
for n, (s, num) in enumerate(starts):
    e = starts[n + 1][0] if n + 1 < len(starts) else isoji_start
    head = L[s].strip()
    tune = re.sub(r'^\d{1,3}\s*', '', head)
    tune = re.sub(r'\s+', ' ', tune).strip()
    lines = [x for x in L[s + 1:e] if not re.match(r'^\s*ORIN [A-ZỌẸṢÀ-Ỹ ()]+\s*$', x)]
    text, quote, t2 = body_to_text(lines)
    tune = (tune + ' ' + t2).strip()
    if not text: problems.append(f'Hymn {num}: no words found')
    printed = re.match(r'^(\d{1,3})', head).group(1)
    if int(printed) != num: problems.append(f'Printed {printed} stored as {num}')
    out.append({'series': 'main', 'number': num, 'label': str(num), 'title_yo': title_of(text), 'text_yo': text, 'scripture': quote, 'tune': tune, 'category': cat(num)})

# --- Orin Isọji
starts, expect = [], 1
for i in range(isoji_start + 1, isoji_end):
    t = L[i].strip()
    m = re.match(r'^(\d{1,2})(?:\s+[A-Za-z0-9. ]{0,14})?$', t)
    if m and int(m.group(1)) in (expect, expect + 1):
        n = int(m.group(1))
        if n != expect: problems.append(f'Isọji {expect} not found')
        starts.append((i, n)); expect = n + 1
for n, (s, num) in enumerate(starts):
    e = starts[n + 1][0] if n + 1 < len(starts) else isoji_end
    text, quote, _t = body_to_text(L[s + 1:e])
    out.append({'series': 'isoji', 'number': num, 'label': str(num), 'title_yo': title_of(text), 'text_yo': text, 'scripture': quote, 'tune': '', 'category': 'Orin Isọji ati Idaraya Ẹmi'})

json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(h['series'] for h in out))
mains = [h['number'] for h in out if h['series'] == 'main']
print('main first/last', mains[:3], mains[-3:], 'missing', sorted(set(range(1, max(mains) + 1)) - set(mains))[:40])
print('PROBLEMS', len(problems)); print('\n'.join(problems[:60]))
open(sys.argv[3], 'w').write('\n'.join(problems))
