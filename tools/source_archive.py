"""Keep exact fetched LigaDB result pages once per URL/content version."""
import gzip,hashlib,json,os,pathlib,threading,datetime,urllib.parse
_lock=threading.Lock()
_seen=None

def archive_response(url,raw):
 global _seen
 root=os.environ.get('PAINI_SOURCE_ARCHIVE')
 if not root or urllib.parse.urlsplit(url).hostname!='turniereklassisch.ringerdb.de':return
 digest=hashlib.sha256(raw).hexdigest();key=hashlib.sha256((url+'\n'+digest).encode()).hexdigest()
 directory=pathlib.Path(root);index=directory/'lahdehistoria.jsonl'
 with _lock:
  if _seen is None:
   _seen=set()
   if index.exists():
    for line in index.read_text(encoding='utf-8').splitlines():
     if line:_seen.add(json.loads(line)['id'])
  if key in _seen:return
  blob=directory/'lahteet'/(digest+'.gz');blob.parent.mkdir(parents=True,exist_ok=True)
  if not blob.exists():
   temporary=blob.with_suffix('.tmp');temporary.write_bytes(gzip.compress(raw,mtime=0));temporary.replace(blob)
  with index.open('a',encoding='utf-8') as stream:stream.write(json.dumps({'id':key,'source':url,'sha256':digest,'blob':'lahteet/'+digest+'.gz','bytes':len(raw),'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},ensure_ascii=False,separators=(',',':'))+'\n')
  _seen.add(key)
