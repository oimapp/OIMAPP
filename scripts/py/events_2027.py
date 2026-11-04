import json, datetime, sys
E_ = []
def ev(date, title, kind, end=None, place='', texts='', title_yo=''):
    E_.append(dict(date=date, end_date=end, title_en=title, title_yo=title_yo, kind=kind, place=place, texts=texts))
HQ = 'International Headquarters, Obaago, Igboho, Oyo State'
for q, d in [('1st', '2027-03-06'), ('2nd', '2027-06-05'), ('3rd', '2027-09-04'), ('4th', '2027-12-04')]:
    ev(d, f'District meetings ({q} quarter)', 'Meeting', title_yo=f'Ìpàdé agbègbè (ìdámẹ́rin {q[0]})')
ev('2027-03-12', 'Conference (1st meeting)', 'Conference', end='2027-03-13', place='Ona Iwa Mimo C&S Church, Titobiloluwa District, Oyo State', title_yo='Àpéjọ (ìpàdé kìíní)')
ev('2027-09-17', 'Conference (3rd meeting)', 'Conference', end='2027-09-18', place='Ona Iwa Mimo C&S Church, Okiki Ona Iwa Mimo District, Osogbo, Osun State', title_yo='Àpéjọ (ìpàdé kẹta)')
ev('2027-06-09', 'Council of Clergies (1st meeting)', 'Meeting', place=HQ, title_yo='Ìgbìmọ̀ Àwọn Àlùfáà (ìpàdé kìíní)')
ev('2027-10-30', 'Council of Clergies (2nd meeting)', 'Meeting', place=HQ, title_yo='Ìgbìmọ̀ Àwọn Àlùfáà (ìpàdé kejì)')
ev('2027-06-10', 'Annual National Convention (Ajo Nla Olodoodun)', 'Convention', end='2027-06-12', place='International Headquarters Church, Obaago, Ekun Oluwajoba, Igboho, Oyo State', title_yo='Àjọ Ńlá Ọlọ́dọọdún')
ev('2027-09-27', 'Brigade Week', 'Week', end='2027-10-03', title_yo='Ọ̀sẹ̀ Brigade')
ev('2027-07-05', 'Youth Week', 'Week', end='2027-07-11', title_yo='Ọ̀sẹ̀ Ọ̀dọ́')
ev('2027-08-19', 'Youth Camp', 'Camp', end='2027-08-22', title_yo='Àgọ́ Ọ̀dọ́')
ev('2027-08-30', 'Teenager Week', 'Week', end='2027-09-05', title_yo='Ọ̀sẹ̀ Ọ̀dọ́langba')
ev('2027-05-14', 'Student Convention', 'Convention', end='2027-05-16', title_yo='Àjọ Akẹ́kọ̀ọ́')
ev('2027-11-01', 'Student Week', 'Week', end='2027-11-07', title_yo='Ọ̀sẹ̀ Akẹ́kọ̀ọ́')
ev('2027-06-10', 'Good Women Society special anniversary', 'Anniversary', place='International Headquarters Church, Obaago, Igboho', title_yo='Ayẹyẹ Ẹgbẹ́ Àwọn Obìnrin Rere')
# Special events with Bible texts
S = [
 ('2027-01-01', None, 'New Year Day', 'Prov. 8:22-36; Rev. 27:1-6', 'Ọjọ́ Ọdún Tuntun'),
 ('2027-01-15', None, "Founder's Remembrance", 'Hosea 6:1-6; Acts 3:22-26', 'Ìrántí Olùdásílẹ̀'),
 ('2027-01-28', '2027-01-31', 'AGC of Unification of C&S Church of Nigeria', '', ''),
 ('2027-02-10', None, 'Ash Wednesday', 'Isaiah 58:3-12; Matthew 4:1-11', 'Ọjọ́rú Eérú'),
 ('2027-03-21', None, 'Palm Sunday', 'Zech. 9:11-17; Luke 19:28-36', 'Ọjọ́ Ìsinmi Ọ̀pẹ'),
 ('2027-03-26', None, 'Good Friday', 'Isaiah 53:1-12; Matt. 27:50-53', 'Ẹtì Rere'),
 ('2027-03-27', None, 'Holy Saturday', 'Isaiah 58:4-7; John 11:25-26', 'Àbámẹ́ta Mímọ́'),
 ('2027-03-28', None, 'Easter Sunday', 'Isaiah 43:18-21; Matt. 28:1-10', 'Ọjọ́ Àjíǹde'),
 ('2027-03-29', None, 'Easter Monday', 'Psalm 16:1-11; Romans 6:8-11', 'Ajé Àjíǹde'),
 ('2027-05-09', None, "Mother's Day", 'Prov. 31:10-30; 1 Peter 3:1-10', 'Ọjọ́ Àwọn Ìyá'),
 ('2027-05-27', None, "Children's Day", 'Psalms 127:3-5; Ephesians 6:1-3', 'Ọjọ́ Àwọn Ọmọdé'),
 ('2027-06-12', None, 'Democracy Day', 'Deut. 1:12-15; Romans 13:1-7', 'Ọjọ́ Ìjọba Tiwa-n-Tiwa'),
 ('2027-06-20', None, "Father's Day", 'Psalms 128:1-6; Ephesians 6:2-9', 'Ọjọ́ Àwọn Bàbá'),
 ('2027-09-09', None, 'Seraphim Day', 'Ezekiel 10:2-8; Acts 1:4-6', 'Ọjọ́ Séráfù'),
 ('2027-09-29', None, 'Holy Michael Day', 'Daniel 12:1-15; Jude 1:9-10', 'Ọjọ́ Máíkẹ́lì Mímọ́'),
 ('2027-10-01', None, 'Independence Day', 'Exodus 3:6-18; Romans 11:1-2', 'Ọjọ́ Òmìnira'),
 ('2027-10-26', '2027-10-29', 'Pilgrimage and Annual Prayer Conference', '', 'Ìrìn Àjò Mímọ́ àti Àpéjọ Àdúrà Ọdọọdún'),
 ('2027-12-12', None, 'OIM Day', 'Isaiah 35:1-10; Acts 22:14-16', 'Ọjọ́ OIM'),
 ('2027-12-24', None, 'Christmas Eve', 'Isaiah 7:13-16; Matt. 1:20-25', 'Ọjọ́ Kí Kérésìmesì'),
 ('2027-12-25', None, 'Christmas Day', 'Isaiah 9:1-7; Matt. 2:20-25', 'Ọjọ́ Kérésìmesì'),
 ('2027-12-31', None, "New Year's Eve", 'Psalm 150:1-6', 'Ọjọ́ Ìparí Ọdún'),
]
for d, end, t, tx, yo in S:
    ev(d, t, 'Special day', end=end, texts=tx, title_yo=yo)
E_.sort(key=lambda e: e['date'])
json.dump(E_, open(sys.argv[1], 'w'), indent=1, ensure_ascii=False)
for e in E_: print(e['date'], datetime.date.fromisoformat(e['date']).strftime('%a'), e['title_en'])
