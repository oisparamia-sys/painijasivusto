"""Classify every existing import note and source issue against archived evidence.
Read-only: never approves a placement or invents a missing result.
"""
import pathlib,json,gzip,re,collections,hashlib
from ligadb import html_results,clean
ROOT=pathlib.Path(__file__).resolve().parents[1]
def parse_js(file,marker):return json.JSONDecoder().raw_decode((ROOT/file).read_text().split(marker,1)[1])[0]
def audit():
 archive={}
 for line in (ROOT/'tietovarasto/lahdehistoria.jsonl').read_text().splitlines():
  e=json.loads(line);archive[e['source']]=e
 def source(url):
  e=archive.get(url)
  if not e:return None
  blob=ROOT/'tietovarasto'/e['blob']
  if not blob.exists():return None
  raw=gzip.decompress(blob.read_bytes())
  if hashlib.sha256(raw).hexdigest()!=e['sha256']:raise ValueError('Lähdearkiston tarkistussumma ei täsmää')
  for encoding in ['utf-8-sig','cp1252']:
   try:return raw.decode(encoding)
   except UnicodeDecodeError:pass
 data=parse_js('data.js','window.PAINI_SHARED_DATA = ')
 old=json.loads((ROOT/'ottelut-raportti.json').read_text())
 issues=[]
 for i in old['sourceIssues']:
  page=source(i['source']);reason=i['reason'];status='requires-source-review';evidence={}
  if reason.startswith('Painoluokan ottelulinkki puuttuu:') and page:
   try:
    groups=html_results(page)
    matches=[g for g in groups if reason.endswith(g['category']+' '+g['weight'])]
    if len(matches)==1:
     g=matches[0];people=len(g['rows'])+g['unranked'];evidence={'ranked':len(g['rows']),'unranked':g['unranked'],'declared':g['count']}
     status='no-opponent' if people<=1 else 'missing-bout-link'
   except ValueError as e:evidence={'error':str(e)}
  elif reason.startswith('Ottelutulos puuttuu tai on epäselvä'):status='unconfirmed-outcome'
  elif reason.startswith('Sama nimi, seura'):status='ambiguous-source-identity'
  elif '404' in reason:status='source-not-found'
  elif 'timed out' in reason:status='retry-network'
  issues.append({**i,'classification':status,'archivedEvidence':bool(page),'evidence':evidence,'sourceSha256':archive.get(i['source'],{}).get('sha256')})
 partial=[]
 for c in data['competitions']:
  if not c.get('importNotes'):continue
  partial.append({'source':c['source'],'title':c['title'],'details':c['details'],'acceptedRows':len(c['rows']),'notes':c['importNotes']})
 result={'version':1,'partialCompetitions':partial,'issues':issues,'summary':{'partialCompetitions':len(partial),'sourceIssues':len(issues),'classifications':dict(collections.Counter(i['classification'] for i in issues)),'withoutArchivedEvidence':sum(not i['archivedEvidence'] for i in issues)}}
 out=ROOT/'tarkistukset';out.mkdir(exist_ok=True);(out/'lahdeaineisto.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result['summary'],ensure_ascii=False))
if __name__=='__main__':audit()
