#!/usr/bin/env python3
import http.server, urllib.request, urllib.parse, json, re, html, pathlib, webbrowser, threading
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parent
HOST='turniereklassisch.ringerdb.de'
# Verified English result pages for invalid Finnish links in the catalogue.
SOURCE_ALIASES={'https://turniereklassisch.ringerdb.de/FT/2022/FI/220115_Kouvola/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/FT/2022/FI/220115_Kouvola/indexENG.htm', 'https://turniereklassisch.ringerdb.de/FT/2022/FI/221210_Ilmajoki/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/FT/2022/FI/221210_Ilmajoki/indexENG.htm', 'https://turniereklassisch.ringerdb.de/FT/2024/FI/241207_Ilmajoki/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/FT/2024/FI/241207_Ilmajoki/indexENG.htm', 'https://turniereklassisch.ringerdb.de/FT/2025/FI/251129_Ilmajoki/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/FT/2025/FI/251129_Ilmajoki/indexENG.htm', 'https://turniereklassisch.ringerdb.de/VT/2022/FI/221210_Helsinki/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/VT/2022/FI/221210_Helsinki/indexENG.htm', 'https://turniereklassisch.ringerdb.de/VT/2024/FI/241214_Helsinki/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/VT/2024/FI/241214_Helsinki/indexENG.htm', 'https://turniereklassisch.ringerdb.de/VT/2025/FI/250906_Turku/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/VT/2025/FI/250906_Turku/indexENG.htm', 'https://turniereklassisch.ringerdb.de/VT/2025/FI/251212_Helsinki/indexFIN.htm': 'https://turniereklassisch.ringerdb.de/VT/2025/FI/251212_Helsinki/indexENG.htm'}
def get(url, fields=None):
 u=urllib.parse.urlparse(url)
 if u.scheme!='https' or u.hostname not in [HOST,'www.ringerdb.de']:raise ValueError('Lähdeosoite ei kelpaa')
 if fields is not None and (u.hostname!='www.ringerdb.de' or u.path.lower()!='/de/turniere/turnieruebersicht.aspx'):raise ValueError('Luettelon sivutusosoite ei kelpaa')
 request=url if fields is None else urllib.request.Request(url,data=urllib.parse.urlencode(fields).encode())
 with urllib.request.urlopen(request,timeout=30) as r:
  if urllib.parse.urlparse(r.url).hostname not in [HOST,'www.ringerdb.de']:raise ValueError('Tuntematon uudelleenohjaus')
  b=r.read(6*1024*1024+1)
 if len(b)>6*1024*1024:raise ValueError('Lähdetiedosto on liian suuri')
 for encoding in ['utf-8-sig','cp1252']:
  try:return b.decode(encoding).replace('\x00','')
  except UnicodeDecodeError:pass
 raise ValueError('Merkistöä ei tunnistettu')
def links(s):return list(dict.fromkeys(html.unescape(x) for x in re.findall(r'href\s*=\s*[\"\']([^\"\']+)',s,re.I)))
class CatalogForm(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.fields={};self.current=None;self.targets={};self.anchor=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='input' and a.get('name') and a.get('type','text').lower() in ['hidden','text'] and 'disabled' not in a:
   self.fields[a['name']]=a.get('value','')
  if tag=='a':self.anchor=[a,[]]
 def handle_data(self,text):
  if self.anchor is not None:self.anchor[1].append(text)
 def handle_endtag(self,tag):
  if tag!='a' or self.anchor is None:return
  a,text=self.anchor;self.anchor=None;text=''.join(text).strip()
  if not text.isdecimal():return
  page=int(text)
  if 'rgCurrentPage' in a.get('class','').split():self.current=page
  target=re.fullmatch(r"javascript:__doPostBack\('([^']+)',''\)",a.get('href',''))
  if target and 'dgrTurnieruebersicht' in target[1]:self.targets[page]=target[1]

def catalog_page(s):
 form=CatalogForm();form.feed(s)
 # The source lists the total number of catalogue records, not result links.
 info=re.search(r'\brgInfoPart[^>]*>(.*?)</div>',s,re.S|re.I)
 counts=re.findall(r'<strong>\s*(\d+)\s*</strong>',info[1],re.I) if info else []
 records=len(re.findall(r'<tr\b[^>]*\bclass=["\'](?:rgRow|rgAltRow)["\']',s,re.I))
 # RingerDB omits the pager entirely when all records fit on one page.
 if not info and 'rgPager' not in s and 'dgrTurnieruebersicht' in s and 0<records<=50:
  form.current=1;return form,records,1,records
 if len(counts)!=2 or form.current is None:raise ValueError('Luettelon sivumäärää ei tunnistettu; hakua ei merkitä täydelliseksi')
 total,number=int(counts[0]),int(counts[1])
 if not 1<=form.current<=number<=40:raise ValueError('Luettelon sivumäärä ei kelpaa')
 records=len(re.findall(r'<tr\b[^>]*\bclass=["\'](?:rgRow|rgAltRow)["\']',s,re.I))
 return form,total,number,records

def catalog(year):
 if year not in range(2022,2027):raise ValueError('Valitse vuosi 2022–2026')
 u=f'https://www.ringerdb.de/de/turniere/Turnieruebersicht.aspx?Saison={year}&land=FI&ZB=E'
 s=get(u);urls=[];expected=None;record_count=0;previous=0
 while True:
  form,total,pages,records=catalog_page(s)
  if form.current!=previous+1:raise ValueError('Luettelon sivutus ei edennyt; hakua ei merkitä täydelliseksi')
  if expected is None:expected=(total,pages)
  if expected!=(total,pages):raise ValueError('Luettelo muuttui kesken haun; kokeile myöhemmin uudelleen')
  record_count+=records
  for link in links(s):
   link=link.replace('http://','https://').replace('www.liga-db.de/Turniere/','turniereklassisch.ringerdb.de/')
   if re.match(r'https://turniereklassisch\.ringerdb\.de/[A-Z]+/'+str(year)+r'/FI/[^/]+/index(?:FIN|ENG)\.htm$',link,re.I):
    urls.append(SOURCE_ALIASES.get(link,link))
  previous=form.current
  if previous==pages:break
  target=form.targets.get(previous+1)
  if not target or not form.fields.get('__VIEWSTATE'):raise ValueError('Luettelon seuraavaa sivua ei voitu avata')
  fields={**form.fields,'__EVENTTARGET':target,'__EVENTARGUMENT':''}
  s=get(u,fields)
 if record_count!=expected[0]:raise ValueError('Luettelon rivimäärä ei täsmää; kaikkia sivuja ei voitu varmistaa')
 if not urls:raise ValueError('Luettelosta ei löytynyt tuloslinkkejä. Lähteen rakenne voi olla muuttunut.')
 return sorted(set(urls))
def clean(value):
 return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',value))).strip()
def html_results(page):
 groups=[];current=None
 for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',page,re.I|re.S):
  cells=[clean(x) for x in re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.I|re.S)]
  if len(cells)<3:continue
  weight=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*kg',cells[0],re.I)
  if weight:
   count=re.fullmatch(r'(\d+) (?:Osallistujaa?|Participants?)',cells[2],re.I)
   if not count and cells[2]:raise ValueError('Painoluokan osallistujamäärää ei tunnistettu')
   current=dict(weight=weight[1].replace(',','.'),category=cells[1],count=int(count[1]) if count else None,rows=[],unranked=0,people=[]);groups.append(current)
  elif current:
   rank=re.fullmatch(r'(\d+)\.',cells[0])
   # Dq is an official non-numeric outcome, never a finishing place.
   nonnumeric=cells[0] in ['', '0.', '0'] or cells[0].casefold()=='dq'
   if rank and int(rank[1])>0 and cells[1] and cells[2]:current['rows'].append([cells[0],cells[1],cells[2]])
   elif cells[0].lower()=='tyhjä':continue
   elif re.search(r'NR\d+\.htm',tr,re.I) or (len(cells)==3 and nonnumeric and cells[1] and cells[2]):
    if not nonnumeric or not cells[1] or not cells[2]:raise ValueError('Osallistujarivin rakennetta ei tunnistettu')
    current['unranked']+=1
   if (rank and int(rank[1])>0) or (nonnumeric and cells[1] and cells[2]):current['people'].append((cells[1].casefold(),cells[2].casefold()))
 for group in groups:
  if group['count'] is not None and len(group['rows'])+group['unranked']!=group['count']:raise ValueError('HTML-tulosmäärä ei täsmää painoluokassa '+group['weight'])
 return groups

def confirmed_weight(group, pageurl, category_link, available_links):
 # The aggregate list may be stale while the individual weight list is final.
 if not group['unranked']:return group
 prefix=category_link.rsplit('/',1)[-1].removesuffix('tlges.htm')
 expected=prefix+group['weight']+'.htm'
 candidates=[link for link in available_links if link.rsplit('/',1)[-1]==expected]
 if len(set(candidates))!=1:return group
 weighturl=urllib.parse.urljoin(pageurl,candidates[0])
 # Do not lose the already validated other weights if a fallback is unavailable.
 try:groups=html_results(get(weighturl))
 except (OSError, ValueError):return group
 if len(groups)!=1:raise ValueError('Painoluokan erillisen tuloslistan rakenne on ristiriitainen')
 final=groups[0]
 if final['weight']!=group['weight'] or final['category'].casefold()!=group['category'].casefold():raise ValueError('Painoluokan erillinen tuloslista ei vastaa sarjaa')
 if final['unranked']:return group
 if final['count'] is None or final['count']!=group['count'] or len(final['rows'])!=group['count']:raise ValueError('Painoluokan erillisen tuloslistan osallistujamäärä ei täsmää')
 # Compare actual identities, not row order: final standings reorder entrants.
 people=lambda rows:sorted((clean(row[1]).casefold(),clean(row[2]).casefold()) for row in rows)
 if people(final['rows'])!=sorted(group['people']):raise ValueError('Painoluokan erillisen tuloslistan osallistujat eivät täsmää')
 return final

def usable_tab(text):
 active=False;found=False
 for line in text.splitlines():
  if not line.strip():continue
  if re.match(r'^\s*\d+(?:[.,]\d+)?\s*kg\s*\t',line,re.I):active=True;continue
  if not active:continue
  cells=[c.strip() for c in line.split('\t')]
  while cells and not cells[0]:cells.pop(0)
  if cells and cells[0].casefold() in ['tyhjä','tyhja']:continue
  if len(cells)!=3 or not re.fullmatch(r'[1-9]\d*\.',cells[0]) or not cells[1] or not cells[2]:return False
  found=True
 return active and found

def style_code(value):
 # Accept explicit source labels only; never infer style from event name or age.
 label=re.sub(r'[\s\-\u2010-\u2015]+',' ',value.casefold()).strip()
 return {'kr.room.':'greco','greco roman':'greco','greco roman style':'greco',
         'vapaa':'freestyle','free style':'freestyle','freestyle':'freestyle'}.get(label)

def competition(url):
 url=SOURCE_ALIASES.get(url,url)
 if not re.fullmatch(r'https://turniereklassisch\.ringerdb\.de/[A-Z]+/202[2-6]/FI/[^/?#]+/index(?:FIN|ENG)\.htm',url):raise ValueError('Kilpailuosoite ei kelpaa')
 s=get(url);alllinks=links(s);raw=[u for u in alllinks if '_tab.txt' in u]
 pages=[];generated=[];warnings=[];recovered=False
 for link in alllinks:
  if 'tlges.htm' not in link:continue
  pageurl=urllib.parse.urljoin(url,link);page=get(pageurl);plain=clean(page)
  m=re.search(r'(?:Täyd\. tulosluettelo|List of winners complete|Result list complete) (.*?) \((\d+) (?:Osallistujaa?|Participants?)\)',plain,re.I)
  groups=html_results(page)
  if m:
   # Age ranges can contain the same separator as the style suffix.
   # Split the header at its final separator, never inside '11 - 13v'.
   heading=m[1].rsplit(' - ',1)
   if len(heading)!=2:raise ValueError('Sarjaotsikon painimuotoa ei tunnistettu')
   category,style=heading;count=int(m[2])
  elif groups:
   if any(g['count'] is None for g in groups):raise ValueError('Osallistujamäärää ei ole ilmoitettu sarjalle eikä kaikille painoluokille')
   categories=set(g['category'] for g in groups)
   if len(categories)!=1:raise ValueError('HTML-sivun ikäluokat ovat ristiriidassa')
   category=next(iter(categories));count=sum(g['count'] for g in groups)
   # Only an explicit style word in the official category is accepted.
   style='Vapaa' if re.search(r'\bvapaa(?:paini)?\b',category,re.I) else 'Kr.room.' if re.search(r'\bkr[. ]|kreikkalais',category,re.I) else ''
  else:raise ValueError('Sarjaluettelo on tyhjä tai sen rakenne ei kelpaa')
  code=style_code(style)
  if not code:raise ValueError('Painimuotoa ei ole ilmoitettu lähteessä: '+category)
  if sum(len(g['rows'])+g['unranked'] for g in groups)!=count:raise ValueError('Sarjan ja painoluokkien osallistujamäärät eroavat')
  if any(g['category'].casefold()!=category.casefold() for g in groups):raise ValueError('Sarjan otsikko ja painoluokat eroavat')
  for g in groups:
   if g['count'] is None:g['count']=len(g['rows'])+g['unranked']
  original_unranked=sum(g['unranked'] for g in groups)
  groups=[confirmed_weight(g,pageurl,link,links(page)) for g in groups]
  recovered=recovered or sum(g['unranked'] for g in groups)<original_unranked
  complete=[]
  for g in groups:
   if g['unranked']:
    warnings.append(dict(category=category,weight=g['weight'],excluded=len(g['rows'])+g['unranked'],unranked=g['unranked'],source=pageurl))
   else:complete.append(g)
  if complete:
   pages.append(dict(category=category,style=code,count=sum(len(g['rows']) for g in complete),url=pageurl));generated+=complete
 if not pages:
  if warnings:raise ValueError('Tulosluetteloissa ei ole vielä vahvistettuja sijoituksia')
  if any(re.search(r'mld\d+\.htm$', u, re.I) for u in alllinks):raise ValueError('Lähteessä on vain osallistujalistat, ei vahvistettuja tuloksia')
  raise ValueError('Sarjakohtaisia tulosluetteloita ei löytynyt')
 # HTML is the fallback for sources that do not publish a tab-separated file.
 rawtext=None;rawurl=''
 if len(raw)==1:
  rawurl=urllib.parse.urljoin(url,raw[0])
  try:rawtext=get(rawurl)
  except Exception:rawtext=None
 # The downloadable file may include friendship classes absent from the
 # official category pages. Use only validated HTML results in that case.
 if rawtext is not None:
  known={(g['category'].casefold(),g['weight']) for g in generated}
  for line in rawtext.splitlines():
   h=re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*kg\t([^\t]+)\t\((\d+) Osallistujaa\)\s*',line,re.I)
   if not h:continue
   category=h[2].strip();weight=h[1].replace(',','.')
   if (category.casefold(),weight) not in known and not any(w['category'].casefold()==category.casefold() and w['weight']==weight for w in warnings):
    if not re.search(r'ystävyys',category,re.I):raise ValueError('Tekstitiedoston sarjalle ei löytynyt vahvistettua HTML-tulosluetteloa: '+category)
    warnings.append(dict(category=category,weight=weight,excluded=int(h[3]),unranked=0,source=rawurl))
 if rawtext is not None and not warnings and not recovered and usable_tab(rawtext):text=rawtext
 else:
  header=re.search(r'<a\b[^>]*href\s*=\s*["\']index(?:FIN|ENG)\.htm["\'][^>]*>(.*?)</a>',s,re.I|re.S)
  if not header:raise ValueError('Kilpailun nimeä ja päivämäärää ei tunnistettu')
  parts=re.split(r'<br\s*/?>',header[1],flags=re.I)
  if len(parts)!=2:raise ValueError('Kilpailun otsikon rakenne ei kelpaa')
  title,details=map(clean,parts)
  if not title or not re.search(r'\d{1,2}[./]\d{1,2}[./]20\d{2}',details):raise ValueError('Kilpailun päivämäärä puuttuu')
  lines=[title,details,'']
  for group in generated:
   lines.append(group['weight']+' kg\t'+group['category']+'\t('+str(group['count'])+' Osallistujaa)')
   lines += ['\t'+'\t'.join(row) for row in group['rows']]
  text='\n'.join(lines);rawurl=''
 return dict(text=text,source=url,textSource=rawurl,pages=pages,warnings=warnings)
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  parsed=urllib.parse.urlparse(self.path)
  if parsed.path.startswith('/api/'):
   try:
    q=urllib.parse.parse_qs(parsed.query)
    if parsed.path=='/api/catalog':result=catalog(int(q['year'][0]))
    elif parsed.path=='/api/competition':result=competition(q['url'][0])
    else:raise ValueError('Tuntematon toiminto')
    body=json.dumps(result,ensure_ascii=False).encode();self.send_response(200)
   except Exception as e:body=json.dumps({'error':str(e)},ensure_ascii=False).encode();self.send_response(400)
   self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body);return
  super().do_GET()
def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);u=f'http://127.0.0.1:{server.server_port}/automaattihaku.html';print('Avaa selaimessa:',u,flush=True);threading.Timer(1,lambda:webbrowser.open(u)).start()
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
if __name__=='__main__':main()
