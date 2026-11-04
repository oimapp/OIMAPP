import docx, re, json, sys
d = docx.Document(sys.argv[1])
ps = d.paragraphs
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def numbered(p):
    ppr = p._p.pPr
    return ppr is not None and ppr.find(W+'numPr') is not None

PHONE = re.compile(r'(?:\+?\d{3}[\s-]?)?0?\d{9,11}')
TITLES = r"(Baba Aladura|Most Snr|Most Senior|Gen\.|General|MSA|SMII|MII|Special|Sp\.|Snr\.?|Senior|Rev[’'`]?d|Rev\.|Apostle|Apos|Apo\.|Ap\.|Prophetess|Prophet|Pro\.|Prop\.|Prts|Pst|Pastor|Evang|Evangelist|Alad|Aladura|Ald\.|Brig|Brigade|L/L|Leader|Ldr|Elder|Eldr|Mother|Lady|Bro\.|Mrs)"
TITLE_RE = re.compile(r'\b' + TITLES)

def cols(t):
    t = t.replace('—', '--')
    parts = re.split(r'\t+|\s{3,}|-{2,}|\s-\s|^-\s|\s-$', t)
    return [x.strip(' -,') for x in parts if x and x.strip(' -,')]

def take_phones(t):
    phones = []
    def rep(m):
        s = m.group(0)
        digits = re.sub(r'\D', '', s)
        if len(digits) >= 10:
            phones.append(s.strip()); return ' '
        return s
    t = re.sub(r'\+?\d[\d\s-]{8,16}\d', rep, t)
    return t, phones

def split_name_leader(c):
    m = TITLE_RE.search(c)
    if m and m.start() > 2:
        return c[:m.start()].strip(' ,-'), c[m.start():].strip()
    return c, ''

districts = []
council = []
cur = None
mode = None
i = 0
in_council = False
for idx, p in enumerate(ps):
    raw = p.text
    t = raw.strip()
    if not t:
        continue
    if t.startswith('MEMBERS OF THE NATIONAL EXECUTIVE COUNCIL'):
        in_council = True; continue
    if t.startswith('DISTRICTS, LOCAL CHURCHES'):
        in_council = False; continue
    if in_council:
        c = cols(raw)
        if c and re.match(r'^\d+\.?$', c[0]) and len(c) >= 2:
            post = c[1]; name = ' '.join(c[2:]).strip()
            if not name and ' - ' in post: post, name = post.split(' - ', 1)
            council.append({'post': post.strip(), 'name': name})
        elif c and re.match(r'^\d+', c[0]):
            m = re.match(r'^(\d+)\.?\s+(.*)$', t)
            if m:
                rest = m.group(2)
                if ' - ' in rest: post, name = rest.split(' - ', 1)
                else: post, name = rest, ''
                council.append({'post': post.strip(), 'name': name.strip()})
        elif council:
            council[-1]['name'] = (council[-1]['name'] + ' ' + t).strip()
        continue
    up = re.sub(r'^\d+\.\s*', '', t)
    if re.search(r'\b(DISTR?I+CT|ANNEXE?)\b', up) and up == up.upper() and len(up) < 70 and not up.startswith('ADMIN') and 'EXECUTIVE' not in up:
        up = up.replace('DISTRIICT', 'DISTRICT')
        cur = {'name': re.sub(r'\s+', ' ', up.rstrip('.')).title().replace('Oflife', 'Of Life').replace(',', ', ').replace('  ', ' '), 'kind': 'annex' if 'ANNEX' in up else 'district', 'admin_hq': '', 'officers': [], 'churches': []}
        districts.append(cur); mode = 'br'; continue
    if cur is None:
        continue
    if re.match(r'^Admini?s?t?r?a?t?i?ve? (Sub-)?Head ?[Qq]uarters', t) or t.startswith('Administive'):
        cur['admin_hq'] = t.split(':', 1)[1].strip() if ':' in t else ''
        cur['admin_hq'] = re.sub(r'^Address:\s*', '', cur['admin_hq'])
        mode = 'hq'; continue
    if re.search(r'EXECUTIVES?\s+(OFFICERS|HEADQUARTERS)', t):
        mode = 'off'; continue
    if re.search(r'BRANCH(ES)? AND LEADERS?', t):
        mode = 'br'; continue
    if mode == 'hq':
        cur['admin_hq'] = (cur['admin_hq'] + ' ' + t).strip(); continue
    lettered = re.match(r'^[a-z]\.\s+', t)
    if lettered:
        raw = re.sub(r'^\s*[a-z]\.\s+', '', raw)
    new = numbered(p) or bool(lettered)
    text, phones = take_phones(raw)
    c = cols(text)
    if mode == 'off':
        if new or not cur['officers']:
            role = c[0] if c else ''
            name = ' '.join(c[1:])
            if not name:
                r2, n2 = split_name_leader(role)
                if n2: role, name = r2, n2
            cur['officers'].append({'role': role.rstrip(' -'), 'name': name, 'phone': ', '.join(phones)})
        else:
            o = cur['officers'][-1]
            o['name'] = (o['name'] + ' ' + ' '.join(c)).strip()
            if phones: o['phone'] = ', '.join(filter(None, [o['phone']] + phones))
    elif mode == 'br':
        if new or not cur['churches']:
            if len(c) >= 2:
                name, leader = c[0], ' '.join(c[1:])
            elif c:
                name, leader = split_name_leader(c[0])
            else:
                name, leader = '', ''
            cur['churches'].append({'name': name, 'leader': leader, 'phone': ', '.join(phones)})
        else:
            ch = cur['churches'][-1]
            if len(c) >= 2:
                ch['name'] = (ch['name'] + ' ' + c[0]).strip(); ch['leader'] = (ch['leader'] + ' ' + ' '.join(c[1:])).strip()
            elif c:
                # A lone word under a church: a leader title means it belongs to the leader, else to the place name
                if TITLE_RE.match(c[0]) or c[0].startswith('(') or (ch['leader'] and re.search(TITLES + r'\s*$', ch['leader'])): ch['leader'] = (ch['leader'] + ' ' + c[0]).strip()
                elif ch['leader'] and not ch['name'].endswith(','): ch['name'] = (ch['name'] + ', ' + c[0]).strip()
                else: ch['name'] = (ch['name'] + ' ' + c[0]).strip()
            if phones: ch['phone'] = ', '.join(filter(None, [ch['phone']] + phones))

def clean(s): return re.sub(r'\s+', ' ', s).strip(' ,-')
STATES = ['Oyo','Osun','Ogun','Ondo','Ekiti','Kwara','Kogi','Lagos','Niger','Kaduna','Benue','Abuja','FCT','Edo','Delta','Plateau','Nasarawa','Kano','Rivers','Akwa Ibom','Anambra','Enugu','Imo','Abia','Bayelsa','Cross River','Ebonyi','Taraba','Adamawa','Bauchi','Borno','Gombe','Jigawa','Katsina','Kebbi','Sokoto','Yobe','Zamfara']
for dd in districts:
    dd['admin_hq'] = clean(dd['admin_hq'])
    st = ''
    hq = dd['admin_hq'] + ' ' + dd['name']
    for c, name in [('Cote', "Côte d'Ivoire"), ('Benin', 'Republic of Benin'), ('Niamey', 'Niger Republic'), ('Ghana', 'Ghana'), ('United Kingdom', 'United Kingdom')]:
        if c.lower() in hq.lower(): st = name; break
    if not st:
        for town, s2 in [('Badagry', 'Lagos'), ('Ilorin', 'Kwara'), ('Ibadan', 'Oyo'), ('Osogbo', 'Osun'), ('Abeokuta', 'Ogun')]:
            if town.lower() in hq.lower(): st = s2 + ' State'; break
    if not st:
        for s in STATES:
            if re.search(r'\b' + s + r'\b', dd['admin_hq'], re.I): st = s + (' State' if s not in ('Abuja','FCT') else ''); break
    dd['state'] = st
    for o in dd['officers']:
        for k in o: o[k] = clean(o[k])
    dd['officers'] = [o for o in dd['officers'] if o['role']]
    for ch in dd['churches']:
        for k in ch: ch[k] = clean(ch[k])
    out = []
    for ch in dd['churches']:
        if not ch['name']: continue
        if not ch['leader']:
            m = re.search(r'\s*[–-]\s*(?=' + TITLES + ')', ch['name'])
            if m: ch['name'], ch['leader'] = ch['name'][:m.start()].strip(' ,'), ch['name'][m.end():].strip()
        m = re.match(r'^(.*?)-(Capt\..*)$', ch['name'])
        if m: ch['name'], ch['leader'] = m.group(1).strip(), (m.group(2) + ' ' + ch['leader']).strip()
        if out and TITLE_RE.match(ch['name']) and not out[-1]['leader']:
            out[-1]['leader'] = ch['name'].strip(' /'); out[-1]['phone'] = ', '.join(filter(None, [out[-1]['phone'], ch['phone']])); continue
        ch['leader'] = ch['leader'].strip(' /–-')
        out.append(ch)
    dd['churches'] = out
for c in council:
    c['post'] = clean(c['post']); c['name'] = clean(c['name'])
json.dump({'districts': districts, 'council': council}, open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
print(len(districts), 'districts/annexes;', sum(len(x['churches']) for x in districts), 'churches;', sum(len(x['officers']) for x in districts), 'officers;', len(council), 'council')
for dd in districts: print(f"{dd['kind'][:3]} {dd['name'][:38]:38} | {dd['state']:18} | off {len(dd['officers']):2} | ch {len(dd['churches']):3} | {dd['admin_hq'][:50]}")
