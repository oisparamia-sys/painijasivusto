#!/usr/bin/env python3
"""Compare official bout lists and build a separate, read-only bout dataset.

Default scope follows the competition search: current year, all years on Sundays.
Existing data.js is never changed. Run: python tools/collect-bouts.py --year all
"""
import argparse,collections,concurrent.futures,datetime,hashlib,html,json,pathlib,re,unicodedata,urllib.parse
from ligadb import get,links,clean,html_results
SAMPLES=[
 'VT/2022/FI/220524_Jaervenpaeae/indexFIN.htm',
 'FT/2022/FI/220115_Kouvola/indexENG.htm',
 'VT/2023/FI/230516_Turku/indexFIN.htm',
 'VT/2024/FI/240523_Tampere/indexFIN.htm',
 'VT/2025/FI/251204_Tampere/indexFIN.htm',
 'VT/2026/FI/260131_Helsinki/indexFIN.htm',
]
HOST='https://turniereklassisch.ringerdb.de/'
# Source legends explicitly define SV/PV/YPV and VT/VP/FI/LOUK.
# GS (Great Superiority): https://www.gmaa.ca/_files/ugd/5dc95d_1a71901c22484d369968a756d1d61060.pdf
# UWW variants: https://cdn.uww.org/2026-01/wrestling_rules.pdf
# Unmapped codes, including RE and KL, are held for review.
METHODS={'SV':'Selätys','PV':'Pistevoitto','YPV':'Ylivoimainen pistevoitto',
         'VFA':'Selätys','VPO':'Pistevoitto','VPO1':'Pistevoitto',
         'VSU':'Ylivoimainen pistevoitto','VSU1':'Ylivoimainen pistevoitto',
         'VP':'Pistevoitto','VT':'Selätys','GS':'Ylivoimainen pistevoitto',
         'FI':'Voitto vastustajan loukkaantumisen vuoksi','LOUK':'Voitto vastustajan loukkaantumisen vuoksi'}
def norm(s):return re.sub(r'\s+',' ',unicodedata.normalize('NFC',str(s))).strip().casefold()
def decode(raw):
 for encoding in ['utf-8-sig','cp1252']:
  try:return raw.decode(encoding).replace('\x00','')
  except UnicodeDecodeError:pass
 raise ValueError('Merkistöä ei tunnistettu')
class Source:
 def __init__(self,cache=None,offline=False):self.cache=pathlib.Path(cache) if cache else None;self.offline=offline
 def read(self,url):
  p=urllib.parse.urlsplit(url)
  if p.scheme!='https' or p.hostname!='turniereklassisch.ringerdb.de' or p.query or p.fragment or not re.fullmatch(r'/[A-Z]+/202[2-6]/FI/[A-Za-z0-9_-]+/[A-Za-z0-9_]+\.(?:htm|txt)',p.path):raise ValueError('Lähdeosoite ei kelpaa')
  cache=self.cache/p.path.lstrip('/') if self.cache else None
  if cache and cache.exists():return decode(cache.read_bytes())
  if self.offline:raise OSError('Lähde puuttuu testivälimuistista: '+url)
  text=get(url)
  if cache:cache.parent.mkdir(parents=True,exist_ok=True);cache.write_text(text,encoding='utf-8')
  return text
 def many(self,urls):
  def read(url):
   try:return url,self.read(url),None
   except Exception as error:return url,None,str(error)
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:return list(pool.map(read,list(dict.fromkeys(urls))))
def local_links(page,base):
 directory=urllib.parse.urlsplit(base).path.rsplit('/',1)[0]+'/'
 out=[]
 for link in links(page):
  url=urllib.parse.urljoin(base,link);p=urllib.parse.urlsplit(url)
  if p.scheme=='https' and p.hostname=='turniereklassisch.ringerdb.de' and p.path.rsplit('/',1)[0]+'/'==directory and not p.query and not p.fragment:out.append(url)
 return list(dict.fromkeys(out))
def check_header(page,competition):
 anchor=re.search(r'<a\b[^>]*href\s*=\s*["\']index(?:FIN|ENG)\.htm["\'][^>]*>(.*?)</a>',page,re.I|re.S)
 if not anchor:raise ValueError('Kilpailun otsikko puuttuu')
 parts=re.split(r'<br\s*/?>',anchor[1],flags=re.I)
 if len(parts)!=2 or norm(clean(parts[0]))!=norm(competition['title']) or norm(clean(parts[1]))!=norm(competition['details']):raise ValueError('Lähdesivun kilpailu ei vastaa aineistoa')
def side(cell,base):
 anchor=re.search(r'<a\b[^>]*href\s*=\s*["\']([^"\']+NR\d+\.htm)["\'][^>]*>(.*?)</a>',cell,re.I|re.S)
 if not anchor:raise ValueError('Painijan lähdetunnus puuttuu')
 url=urllib.parse.urljoin(base,anchor[1])
 if url not in local_links('<a href="'+html.escape(anchor[1],quote=True)+'">x</a>',base):raise ValueError('Painijaviittaus johtaa eri kilpailuun')
 return {'name':clean(anchor[2]),'club':clean(cell[anchor.end():]),'profile':url,'bold':bool(re.search(r'<b\b',anchor[2],re.I))}
def parse_bouts(page,base):
 out=[];rejected=[]
 for position,tr in enumerate(re.findall(r'<tr\b[^>]*>(.*?)</tr>',page,re.I|re.S)):
  cells=re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.I|re.S)
  if not any(re.search(r'NR\d+\.htm',cell,re.I) for cell in cells):continue
  try:
   candidates=[(i,re.fullmatch(r'([A-ZÄÖÜ]+\d?)\s+(\d+)\s*:\s*(\d+)',clean(c))) for i,c in enumerate(cells)]
   candidates=[(i,m) for i,m in candidates if m]
   if len(candidates)!=1:raise ValueError('Ottelutulos puuttuu tai on epäselvä')
   i,m=candidates[0]
   if i<3 or i+1>=len(cells):raise ValueError('Ottelurivin rakenne ei kelpaa')
   red,blue=side(cells[i-2],base),side(cells[i-1],base)
   if red['profile']==blue['profile']:raise ValueError('Ottelussa sama painijatunnus kahdesti')
   rp,bp=int(m[2]),int(m[3]);winner='red' if rp>bp else 'blue' if bp>rp else None
   bold='red' if red['bold'] and not blue['bold'] else 'blue' if blue['bold'] and not red['bold'] else None
   if winner is None or winner!=bold:raise ValueError('Voittajamerkinnät ovat ristiriidassa')
   value=clean(cells[i+1]);score=re.fullmatch(r'(\d+)\s*:\s*(\d+)',value)
   if value and not score:raise ValueError('Teknisiä pisteitä ei tunnistettu')
   out.append({'round':clean(cells[i-3]),'red':red,'blue':blue,'code':m[1],'classification':[rp,bp],'points':[int(score[1]),int(score[2])] if score else None,'winner':winner,'source':base,'position':position})
  except ValueError as error:rejected.append({'source':base,'reason':str(error),'position':position})
 return out,rejected

def bout_key(row):return (row['round'],row['red']['profile'],row['blue']['profile'])
def same_bout(a,b):
 return all(a[k]==b[k] for k in ['code','classification','points','winner']) and all(norm(a[c][k])==norm(b[c][k]) for c in ['red','blue'] for k in ['name','club'])
def club_key(value):
 # Only normalize an explicit trailing ISO country suffix: Club (FIN) == Club FIN.
 # Never replace a club with a country or infer another club from the name.
 return norm(re.sub(r'\(([A-Z]{3})\)\s*$',r'\1',value))
def ranked_profiles(page,base):
 category=None;weight=None;out=[]
 for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',page,re.I|re.S):
  cells=re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.I|re.S)
  if len(cells)<3:continue
  match=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*kg',clean(cells[0]),re.I)
  if match:weight=match[1].replace(',','.');category=clean(cells[1]);continue
  rank=re.fullmatch(r'([1-9]\d*)\.',clean(cells[0]))
  if category is None or (not rank and clean(cells[0])):continue
  anchor=re.search(r'<a\b[^>]*href\s*=\s*["\']([^"\']+NR\d+\.htm)["\'][^>]*>(.*?)</a>',cells[1],re.I|re.S)
  if not anchor:
   if rank:out.append({'category':category,'weight':weight,'name':clean(cells[1]),'club':clean(cells[2]),'profile':None,'ranked':True})
   continue
  profile=urllib.parse.urljoin(base,anchor[1])
  if profile not in local_links('<a href="'+html.escape(anchor[1],quote=True)+'">x</a>',base):continue
  out.append({'category':category,'weight':weight,'name':clean(anchor[2]),'club':clean(cells[2]),'profile':profile,'ranked':bool(rank)})
 return out

def profile_info(page):
 fields={}
 for label,value in re.findall(r'<td\b[^>]*>([^<>]+)</td>\s*<td\b[^>]*>(.*?)</td>',page,re.I|re.S):
  key=norm(clean(label))
  if key in ['painija','seura','ikäluokka','paino']:
   if key in fields:raise ValueError('Painijaprofiilin tunnistetieto toistuu')
   fields[key]=clean(value)
 if not all(fields.get(k) for k in ['painija','seura','ikäluokka','paino']):raise ValueError('Painijaprofiilin tunnistetiedot puuttuvat')
 weight=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*kg',fields['paino'],re.I)
 if not weight:raise ValueError('Painijaprofiilin painoluokkaa ei tunnistettu')
 return {'name':fields['painija'],'club':fields['seura'],'category':fields['ikäluokka'],'weight':weight[1].replace(',','.')}

def profile_agrees(info,person,row):
 return info and norm(info['name'])==norm(person['name']) and club_key(info['club'])==club_key(person['club']) and norm(info['category'])==norm(row['category']) and info['weight']==row['weight']

def collect_event(competition,source):
 url=competition['source'];index=source.read(url);check_header(index,competition)
 available=local_links(index,url);category_urls=[u for u in available if u.endswith('tlges.htm')]
 numbered_urls=[u for u in available if re.search(r'KF\d+\.htm$',u,re.I)]
 if not category_urls:raise ValueError('Sarjojen osallistujaluettelot eivät ole saatavilla')
 weight_info={};issues=[];roster={};plain_roster={};unranked_profiles=set()
 participant_index=collections.defaultdict(list)
 for row in competition['rows']:participant_index[(norm(row['category']),str(row['weight']),norm(row['name']),club_key(row['club']))].append(row)
 for pageurl,page,error in source.many(category_urls):
  if error:issues.append({'source':pageurl,'reason':error});continue
  try:
   check_header(page,competition);groups=html_results(page)
   persons=ranked_profiles(page,pageurl)
   identity_counts=collections.Counter((norm(p['category']),p['weight'],norm(p['name']),club_key(p['club'])) for p in persons)
   for person in persons:
    if identity_counts[(norm(person['category']),person['weight'],norm(person['name']),club_key(person['club']))]!=1:
     issues.append({'source':pageurl,'reason':'Sama nimi, seura ja sarja esiintyy lähteen osallistujaluettelossa useasti'});continue
    found=participant_index[(norm(person['category']),person['weight'],norm(person['name']),club_key(person['club']))]
    if len(found)==1:
     if person['profile'] is None:
      plain_roster[(norm(person['category']),person['weight'],norm(person['name']),club_key(person['club']))]={'result':found[0],'name':person['name'],'club':person['club']}
      continue
     if not person['ranked']:unranked_profiles.add(person['profile'])
     key=(person['profile'],norm(person['category']),person['weight'])
     if key in roster:raise ValueError('Toistuva painijaviittaus sarjan tulosluettelossa')
     roster[key]={'result':found[0],'name':person['name'],'club':person['club']}
   prefix=pageurl.removesuffix('tlges.htm')
   found=local_links(page,pageurl)+available
   for group in groups:
    expected=prefix+group['weight']+'beg.htm'
    if expected not in found:
     issues.append({'source':pageurl,'reason':'Painoluokan ottelulinkki puuttuu: '+group['category']+' '+group['weight']});continue
    if expected in weight_info:raise ValueError('Toistuva painoluokan ottelulinkki')
    weight_info[expected]={'category':group['category'],'weight':group['weight']}
  except ValueError as error:issues.append({'source':pageurl,'reason':str(error)})
 weights=[];numbered=[]
 for pageurl,page,error in source.many(list(weight_info)+numbered_urls):
  if error:issues.append({'source':pageurl,'reason':error});continue
  try:
   check_header(page,competition);rows,failed=parse_bouts(page,pageurl);issues.extend(failed)
   if pageurl in weight_info:
    for row in rows:row.update(weight_info[pageurl])
    weights.extend(rows)
   else:numbered.extend(rows)
  except ValueError as error:issues.append({'source':pageurl,'reason':str(error)})
 # If the numbered list is absent, compare each weight-list bout with BOTH
 # participants' own pages. Also verify profile identities when ranking pages
 # have no profile links or show participants without ranks. No ranks are inferred.
 profile_urls=set()
 for row in weights:
  for colour in ['red','blue']:
   person=row[colour];key=(person['profile'],norm(row['category']),row['weight'])
   if not numbered_urls or person['profile'] in unranked_profiles or key not in roster and (norm(row['category']),row['weight'],norm(person['name']),club_key(person['club'])) in plain_roster:profile_urls.add(person['profile'])
 profiles={}
 for pageurl,page,error in source.many(sorted(profile_urls)):
  if error:issues.append({'source':pageurl,'reason':error});continue
  try:
   check_header(page,competition);info=profile_info(page);rows,failed=parse_bouts(page,pageurl);issues.extend(failed)
   by_key=collections.defaultdict(list)
   for parsed in rows:
    if pageurl not in [parsed['red']['profile'],parsed['blue']['profile']]:raise ValueError('Profiilissa on muun painijan ottelu')
    by_key[bout_key(parsed)].append(parsed)
   profiles[pageurl]={'info':info,'rows':by_key}
  except ValueError as error:issues.append({'source':pageurl,'reason':str(error)})
 numbered_map=collections.defaultdict(list)
 for row in numbered:numbered_map[bout_key(row)].append(row)
 weight_counts=collections.Counter(bout_key(row) for row in weights)
 approved=[];excluded=[];used={}
 for row in weights:
  reason=None;people=[]
  for colour in ['red','blue']:
   person=row[colour];verified=roster.get((person['profile'],norm(row['category']),row['weight']))
   if verified is None:
    verified=plain_roster.get((norm(row['category']),row['weight'],norm(person['name']),club_key(person['club'])))
    if verified and not profile_agrees(profiles.get(person['profile'],{}).get('info'),person,row):verified=None
   if person['profile'] in unranked_profiles and not profile_agrees(profiles.get(person['profile'],{}).get('info'),person,row):verified=None
   if verified is None or norm(person['name'])!=norm(verified['name']) or club_key(person['club'])!=club_key(verified['club']):reason='Painijan lähdetunnus, nimi tai seura ei vastaa sarjan tulosluetteloa'
   else:people.append(verified['result'])
  peers=numbered_map[bout_key(row)]
  if not numbered_urls:
   profile_peers=[]
   for colour in ['red','blue']:
    person=row[colour];profile=profiles.get(person['profile'],{})
    candidates=profile.get('rows',{}).get(bout_key(row),[])
    if not profile_agrees(profile.get('info'),person,row) or len(candidates)!=1 or not same_bout(row,candidates[0]):
     reason='Painoluokan ottelu ja molempien painijoiden profiilit eivät täsmää';break
    profile_peers.append(candidates[0])
   if len(profile_peers)==2:peers=[profile_peers[0]]
  if weight_counts[bout_key(row)]!=1 or len(peers)!=1:reason='Ottelu ei esiinny täsmälleen kerran vertailtavissa lähteissä'
  elif not same_bout(row,peers[0]):reason='Lähdeluetteloiden nimet tai ottelutulokset eroavat'
  if row['code'] not in METHODS:reason='Voittotavan lyhenne vaatii tarkistamista: '+row['code']
  if reason:
   excluded.append({'competition':url,'people':[p['resultId'] for p in people],'source':row['source'],'reason':reason});continue
  red,blue=people
  if red['resultId']==blue['resultId']:excluded.append({'competition':url,'people':[red['resultId'],blue['resultId']],'source':row['source'],'reason':'Ottelun molemmat puolet yhdistyvät samaan painijatunnukseen'});continue
  for p in people:used[p['resultId']]={'competition':url,**{k:p[k] for k in ['resultId','athleteId','category','weight']}}
  token=json.dumps([url,*bout_key(row)],ensure_ascii=False,separators=(',',':'))
  approved.append({'id':'ottelu-'+hashlib.sha256(token.encode()).hexdigest()[:20],'competition':url,'category':row['category'],'weight':row['weight'],'round':row['round'].split(' ',1)[-1],'red':red['resultId'],'blue':blue['resultId'],'winner':red['resultId'] if row['winner']=='red' else blue['resultId'],'code':row['code'],'points':row['points'],'source':row['source'],'comparisonSource':peers[0]['source'],**({'verificationSources':[row['red']['profile'],row['blue']['profile']]} if not numbered_urls else {})})
 # Include identified participants of rejected bouts too, for accurate exclusion notices.
 all_people={row['resultId']:{'competition':url,**{k:row[k] for k in ['resultId','athleteId','category','weight']}} for row in competition['rows']}
 unmatched=sum(1 for row in numbered if bout_key(row) not in weight_counts)
 stats={'candidateMatches':len(weights),'accepted':len(approved),'excluded':len(excluded),'unmatchedNumbered':unmatched,'unreadable':len(issues)}
 meta={'key':url,'title':competition['title'],'details':competition['details'],'year':int(re.search(r'/20\d{2}/',url)[0].strip('/')),'stats':stats,'comparisonMethod':'numbered-list' if numbered_urls else 'both-participant-profiles'}
 return meta,list(all_people.values()),approved,excluded,issues

def load_data(path):
 text=pathlib.Path(path).read_text();marker='window.PAINI_SHARED_DATA = '
 if marker not in text:raise ValueError('data.js-tiedoston muoto ei kelpaa')
 data,_=json.JSONDecoder().raw_decode(text.split(marker,1)[1])
 if data.get('version')!=1 or not isinstance(data.get('competitions'),list):raise ValueError('Kilpailuaineisto ei kelpaa')
 return data

def collect(data,source):
 result={'version':2,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'competitions':[],'participants':[],'matches':[],'excluded':[],'issues':[],'errors':[],'methodLabels':METHODS}
 for path in SAMPLES:
  url=HOST+path;candidates=[c for c in data['competitions'] if c.get('source')==url]
  if len(candidates)!=1:result['errors'].append({'source':url,'reason':'Koekilpailua ei löytynyt yksikäsitteisesti aineistosta'});continue
  try:
   meta,people,matches,excluded,issues=collect_event(candidates[0],source)
   result['competitions'].append(meta);result['participants'].extend(people);result['matches'].extend(matches);result['excluded'].extend(excluded);result['issues'].extend(issues)
   print(meta['year'],meta['title'],json.dumps(meta['stats'],ensure_ascii=False),flush=True)
  except (OSError,ValueError) as error:result['errors'].append({'source':url,'reason':str(error)})
 if len({m['id'] for m in result['matches']})!=len(result['matches']):raise ValueError('Toistuva ottelutunnus')
 if not result['matches']:raise ValueError('Yhtään ottelua ei voitu vahvistaa; vanhaa otteluaineistoa ei korvattu')
 return result

def load_previous(path):
 path=pathlib.Path(path)
 if not path.exists():return None
 marker='window.PAINI_BOUTS_DATA = '
 text=path.read_text(encoding='utf-8')
 if marker not in text:raise ValueError('Vanhan otteluaineiston muoto ei kelpaa')
 value,_=json.JSONDecoder().raw_decode(text.split(marker,1)[1])
 if value.get('version')!=2:raise ValueError('Vanhan otteluaineiston versio ei kelpaa')
 validate(value)
 return value

def validate(data):
 competitions={c['key'] for c in data['competitions']}
 if len(competitions)!=len(data['competitions']):raise ValueError('Toistuva kilpailutunnus')
 people={p['resultId']:p for p in data['participants']}
 if len(people)!=len(data['participants']):raise ValueError('Toistuva tulostunnus')
 ids=set()
 for m in data['matches']:
  if m['id'] in ids or m['competition'] not in competitions:raise ValueError('Ottelun tunnus tai kilpailu ei kelpaa')
  ids.add(m['id'])
  for side in ['red','blue']:
   p=people.get(m[side])
   if not p or p['competition']!=m['competition'] or p['category']!=m['category'] or str(p['weight'])!=str(m['weight']):raise ValueError('Ottelun tulosviittaus ei kelpaa')
  if m['winner'] not in [m['red'],m['blue']] or m['red']==m['blue']:raise ValueError('Ottelun painijat eivät kelpaa')
  if m['code'] not in METHODS or (m['points'] is not None and (len(m['points'])!=2 or any(type(x)!=int or x<0 for x in m['points']))):raise ValueError('Ottelutulos ei kelpaa')

def years_for(arg,now=None):
 now=now or datetime.datetime.now(datetime.timezone.utc)
 if arg=='samples':return None
 if arg in ['all','missing'] or (arg=='auto' and now.weekday()==6):return set(range(2022,2027))
 years={min(2026,max(2022,now.year))} if arg=='auto' else {int(arg)}
 if not years<=set(range(2022,2027)):raise ValueError('Valitse vuosi 2022–2026')
 return years

def collect_auto(data,source,previous,year='auto'):
 years=years_for(year);now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 result={'version':2,'checkedAt':now,'competitions':[],'participants':[],'matches':[],'excluded':[],'issues':[],'errors':[],'methodLabels':METHODS}
 report={'version':1,'checkedAt':now,'scope':year,'events':[],'summary':{},'proposals':[],'unchangedTargets':[]}
 current=collections.defaultdict(list)
 for c in data['competitions']:
  if c.get('source'):current[c['source']].append(c)
 previous=previous or {'competitions':[],'participants':[],'matches':[],'excluded':[],'issues':[]}
 oldmeta={c['key']:c for c in previous['competitions']}
 # Resolve registry merges only through explicit registry links.
 registry={a['id']:a for a in data.get('athleteRegistry',{}).get('athletes',[])}
 def canonical(id):
  seen=set()
  while registry.get(id,{}).get('mergedInto'):
   if id in seen:raise ValueError('Painijarekisterin yhdistämiskehä')
   seen.add(id);id=registry[id]['mergedInto']
  return id
 def old_event(url):
  if url not in oldmeta:return None
  if len(current[url])!=1:raise ValueError('Vanhan otteluaineiston kilpailu puuttuu tai on moninkertainen: '+url)
  rows={r['resultId']:r for r in current[url][0]['rows']};people=[]
  for p in previous['participants']:
   if p['competition']!=url:continue
   row=rows.get(p['resultId'])
   if not row or canonical(row['athleteId'])!=canonical(p['athleteId']) or row['category']!=p['category'] or str(row['weight'])!=str(p['weight']):raise ValueError('Vanhan otteluaineiston painijaviittaus muuttui; aineistoa ei julkaista: '+url)
   people.append({**p,'athleteId':row['athleteId']})
  return (oldmeta[url],people,[m for m in previous['matches'] if m['competition']==url],[e for e in previous['excluded'] if e['competition']==url],[i for i in previous['issues'] if i.get('source','').startswith(url.rsplit('/',1)[0]+'/')])
 urls=set(oldmeta)
 for url in current:
  match=re.fullmatch(r'https://turniereklassisch\.ringerdb\.de/[A-Z]+/(202[2-6])/FI/[A-Za-z0-9_-]+/index(?:FIN|ENG)\.htm',url)
  if match and ((years is None and url.removeprefix(HOST) in SAMPLES) or (years is not None and int(match[1]) in years)):urls.add(url)
 for url in sorted(urls):
  old=old_event(url)
  match=re.search(r'/(202[2-6])/FI/',url)
  selected=(year!='missing' or url not in oldmeta) and bool(match) and ((years is None and url.removeprefix(HOST) in SAMPLES) or (years is not None and int(match[1]) in years))
  status='unchanged';reason=None;event=old
  if selected:
   try:
    if len(current[url])!=1:raise ValueError('Kilpailua ei löytynyt yksikäsitteisesti')
    candidate=collect_event(current[url][0],source)
    if not candidate[2]:raise ValueError('Yhtään ottelua ei voitu vahvistaa')
    # A changed result for an old bout needs manual review, not an automatic overwrite.
    if old:
     incoming={m['id']:m for m in candidate[2]}
     for m in old[2]:
      new=incoming.get(m['id'])
      if not new or any(new[k]!=m[k] for k in ['red','blue','winner','code','points','category','weight','round','source']):
       report['proposals'].append({'target':url,'before':dict(zip(['meta','participants','matches','excluded','issues'],old)),'after':dict(zip(['meta','participants','matches','excluded','issues'],candidate))})
       raise ValueError('Aiempi ottelu puuttuu tai sen tulos muuttui; vanhat ottelut säilytettiin ja muutos vietiin hyväksyntäjonoon')
    meta,people,matches,excluded,issues=candidate
    event=({**meta,'checkedAt':now},people,matches,excluded,issues);status='updated'
    report['unchangedTargets'].append(url)
   except Exception as error:
    reason=str(error);status='preserved' if old else 'failed'
    result['errors'].append({'source':url,'reason':reason})
   report['events'].append({'source':url,'status':status,'matches':len(event[2]) if event else 0,'reason':reason})
   print(status,url,len(event[2]) if event else 0,reason or '',flush=True)
  if event:
   meta,people,matches,excluded,issues=event
   result['competitions'].append(meta);result['participants'].extend(people);result['matches'].extend(matches);result['excluded'].extend(excluded);result['issues'].extend(issues)
 validate(result)
 counts=collections.Counter(e['status'] for e in report['events'])
 report['summary']={**{k:counts[k] for k in ['updated','preserved','failed']},'attempted':len(report['events']),'competitions':len(result['competitions']),'matches':len(result['matches']),'excluded':len(result['excluded']),'sourceIssues':len(result['issues'])}
 report['excluded']=result['excluded']
 report['sourceIssues']=result['issues']
 available={c['key'] for c in result['competitions']}
 previous_missing={c['source']:c for c in previous.get('coverageMissing',[])}
 attempts={e['source']:e for e in report['events']}
 missing=[]
 for url,items in sorted(current.items()):
  match=re.fullmatch(r'https://turniereklassisch\.ringerdb\.de/[A-Z]+/(202[2-6])/FI/[A-Za-z0-9_-]+/index(?:FIN|ENG)\.htm',url)
  if not match or url in available or len(items)!=1:continue
  c=items[0];attempt=attempts.get(url);saved=previous_missing.get(url,{})
  missing.append({'source':url,'title':c['title'],'details':c['details'],'year':int(match[1]),'checkedAt':now if attempt else saved.get('checkedAt'),'reason':attempt['reason'] if attempt else saved.get('reason','Kilpailun ottelut eivät ole vielä mukana. Tätä kilpailua ei tarkistettu tässä ajossa.')})
 result['coverageMissing']=missing;report['coverageMissing']=missing
 report['summary']['coverageMissing']=len(missing)
 result['searchSummary']=report['summary']
 report['years']={str(y):{'competitions':sum(c['year']==y for c in result['competitions']),'matches':sum(m['competition'] in {c['key'] for c in result['competitions'] if c['year']==y} for m in result['matches'])} for y in range(2022,2027)}
 return result,report

def atomic_write(path,text):
 path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True)
 temporary=path.with_name(path.name+'.tmp')
 temporary.write_text(text,encoding='utf-8');temporary.replace(path)

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--data',default='data.js');parser.add_argument('--output',default='ottelut-data.js');parser.add_argument('--report',default='ottelut-raportti.json');parser.add_argument('--cache');parser.add_argument('--offline',action='store_true');parser.add_argument('--year',default='auto',choices=['auto','all','missing','samples','2022','2023','2024','2025','2026'])
 args=parser.parse_args()
 result,report=collect_auto(load_data(args.data),Source(args.cache,args.offline),load_previous(args.output),args.year)
 atomic_write(args.report,json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 lines=['# Otteluhaun raportti', '', 'Tarkistettu: '+report['checkedAt'], '', '```json',json.dumps(report['summary'],ensure_ascii=False,indent=2),'```','', 'Kaikki ottelukohtaiset huomiot: [JSON-raportti](ottelut-raportti.json).','','## Vuosikattavuus','']
 for y,v in report['years'].items():lines.append(f"- {y}: {v['competitions']} kilpailua, {v['matches']} ottelua")
 lines+=['','## Tarkistettavat kilpailut','']
 for e in report['events']:
  if e['status'] in ['preserved','failed']:lines.append('- '+e['source']+' — '+e['status']+': '+str(e['reason']))
 if not any(e['status'] in ['preserved','failed'] for e in report['events']):lines.append('Ei epäonnistuneita kilpailuja.')
 lines+=['','## Koko aineiston kilpailut ilman vahvistettuja otteluita','']
 for item in report['coverageMissing']:lines.append('- '+item['title']+' · '+item['details']+' — '+item['source']+' — '+item['reason'])
 if not report['coverageMissing']:lines.append('Kaikista nykyisen kilpailuaineiston soveltuvista lähteistä on vahvistettuja otteluita. Yksittäisiä otteluita voi silti puuttua.')
 lines+=['','## Ottelukohtaiset huomiot','']
 for item in (report['excluded']+report['sourceIssues'])[:200]:lines.append('- '+item.get('source','')+' — '+item['reason'])
 if len(report['excluded'])+len(report['sourceIssues'])>200:lines.append('Näytetään ensimmäiset 200 huomiota. Kaikki huomiot löytyvät JSON-raportista.')
 atomic_write(pathlib.Path(args.report).with_suffix('.md'),'\n'.join(lines)+'\n')
 if result['matches']:
  content=json.dumps(result,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
  atomic_write(args.output,'"use strict";\nwindow.PAINI_BOUTS_DATA = '+content+';\n')
 print(json.dumps(report['summary'],ensure_ascii=False),flush=True)
if __name__=='__main__':main()
