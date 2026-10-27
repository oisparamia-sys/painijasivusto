#!/usr/bin/env python3
import http.server, urllib.request, urllib.parse, json, re, html, pathlib, webbrowser, threading
ROOT=pathlib.Path(__file__).resolve().parent
HOST='turniereklassisch.ringerdb.de'
def get(url):
 u=urllib.parse.urlparse(url)
 if u.scheme!='https' or u.hostname not in [HOST,'www.ringerdb.de']:raise ValueError('Lähdeosoite ei kelpaa')
 with urllib.request.urlopen(url,timeout=30) as r:
  if urllib.parse.urlparse(r.url).hostname not in [HOST,'www.ringerdb.de']:raise ValueError('Tuntematon uudelleenohjaus')
  b=r.read(6*1024*1024+1)
 if len(b)>6*1024*1024:raise ValueError('Lähdetiedosto on liian suuri')
 for encoding in ['utf-8-sig','cp1252']:
  try:return b.decode(encoding).replace('\x00','')
  except UnicodeDecodeError:pass
 raise ValueError('Merkistöä ei tunnistettu')
def links(s):return list(dict.fromkeys(html.unescape(x) for x in re.findall(r'href\s*=\s*[\"\']([^\"\']+)',s,re.I)))
def catalog(year):
 if year not in range(2022,2027):raise ValueError('Valitse vuosi 2022–2026')
 u=f'https://www.ringerdb.de/de/turniere/Turnieruebersicht.aspx?Saison={year}&land=FI&ZB=E'
 s=get(u);urls=[]
 for link in links(s):
  link=link.replace('http://','https://').replace('www.liga-db.de/Turniere/','turniereklassisch.ringerdb.de/')
  if re.match(r'https://turniereklassisch\.ringerdb\.de/[A-Z]+/'+str(year)+r'/FI/[^/]+/index(?:FIN|ENG)\.htm$',link,re.I):
   urls.append(re.sub(r'index(?:FIN|ENG)\.htm$','indexFIN.htm',link,flags=re.I))
 if not urls:raise ValueError('Luettelosta ei löytynyt tuloslinkkejä. Lähteen rakenne voi olla muuttunut.')
 return sorted(set(urls))
def competition(url):
 if not re.fullmatch(r'https://turniereklassisch\.ringerdb\.de/[A-Z]+/202[2-6]/FI/[^/?#]+/indexFIN\.htm',url):raise ValueError('Kilpailuosoite ei kelpaa')
 s=get(url);alllinks=links(s);raw=[x for x in alllinks if '_tab.txt' in x]
 if len(raw)!=1:raise ValueError('Tab-eroteltua tulosluetteloa ei löytynyt')
 rawurl=urllib.parse.urljoin(url,raw[0]);text=get(rawurl);pages=[]
 for link in alllinks:
  if 'tlges.htm' not in link:continue
  pageurl=urllib.parse.urljoin(url,link);plain=html.unescape(re.sub('<[^>]+>',' ',get(pageurl)));plain=re.sub(r'\s+',' ',plain)
  m=re.search(r'Täyd\. tulosluettelo (.*) - (.*?) \((\d+) Osallistujaa\)',plain)
  if not m:raise ValueError('Sarjan osallistujamäärää tai painimuotoa ei voitu varmistaa')
  style={'Kr.room.':'greco','Vapaa':'freestyle'}.get(m[2])
  if not style:raise ValueError('Tuntematon painimuoto: '+m[2])
  pages.append(dict(category=m[1],style=style,count=int(m[3]),url=pageurl))
 if not pages:raise ValueError('Sarjakohtaisia tulosluetteloita ei löytynyt')
 return dict(text=text,source=url,textSource=rawurl,pages=pages)
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
