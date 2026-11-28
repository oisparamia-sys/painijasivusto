"""One atomic SQLite store for verified standings, bouts and archived source evidence."""
import argparse,contextlib,gzip,hashlib,json,pathlib,sqlite3,tempfile,os,unicodedata
NAME='tietokanta.sqlite.gz'
TABLES={'athlete_stats':('id','name','competitions','matches','wins','losses'),'competitions':('id','title','details'),'athletes':('id','name'),'placements':('id','athlete_id','competition_id','name','club','category','weight','place'),'matches':('id','competition_id','red','blue','winner','code','points','round'),'participants':('id','athlete_id','competition_id'),'issues':('id','source','reason'),'excluded':('id','competition_id','reason'),'source_versions':('id','source','sha256','fetched_at')}
def js(path,marker):return json.JSONDecoder().raw_decode(path.read_text().split(marker,1)[1])[0]
def encode(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'))
def cached_database(root):
 source=(pathlib.Path(root)/NAME).resolve();st=source.stat()
 directory=pathlib.Path(tempfile.gettempdir())/('paini-db-cache-'+str(os.getuid()))
 directory.mkdir(mode=0o700,exist_ok=True)
 if directory.is_symlink() or directory.stat().st_uid!=os.getuid() or directory.stat().st_mode & 0o077:raise ValueError('Tietokannan välimuistihakemisto ei ole yksityinen')
 key=hashlib.sha256((str(source)+'|'+str((st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns,st.st_ctime_ns))).encode()).hexdigest()
 file=directory/(key+'.sqlite')
 if not file.exists():
  with tempfile.NamedTemporaryFile(dir=directory,delete=False) as stream:
   temporary=pathlib.Path(stream.name)
   try:stream.write(gzip.decompress(source.read_bytes()))
   except BaseException:temporary.unlink();raise
  temporary.replace(file)
 return file
@contextlib.contextmanager
def connection(root):
 file=cached_database(root)
 db=sqlite3.connect(file.as_uri()+'?mode=ro',uri=True)
 db.create_function('paini_fold',1,lambda value:unicodedata.normalize('NFKC',str(value)).casefold(),deterministic=True)
 try:yield db
 finally:db.close()
def read(root):
 with connection(root) as db:return {**{key:json.loads(gzip.decompress(payload)) for key,payload in db.execute('select key,payload from documents')},'metadata':dict(db.execute('select key,value from metadata'))}
def stats(root):
 with connection(root) as db:return {'version':1,'revision':db.execute("select value from metadata where key='revision'").fetchone()[0],'tables':{table:db.execute('select count(*) from '+table).fetchone()[0] for table in TABLES}}
def rows(root,table,page=0,query='',sort='id-asc'):
 if table not in TABLES:raise ValueError('Tuntematon taulu')
 field,_,direction=sort.rpartition('-')
 if field not in TABLES[table] or direction not in ['asc','desc']:raise ValueError('Lajitteluperuste ei kelpaa')
 page=max(0,min(int(page),100000));query=unicodedata.normalize('NFKC',str(query)[:200]).casefold();columns=TABLES[table]
 where=' where '+' or '.join('paini_fold('+c+') like ? escape \'\\\'' for c in columns) if query else ''
 params=['%'+query.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%']*len(columns) if query else []
 with connection(root) as db:
  count=db.execute('select count(*) from '+table+where,params).fetchone()[0]
  page=min(page,max(0,(count-1)//50))
  order=('paini_fold('+field+')' if field in ['name','title','club','category'] else field)+' '+direction+', id asc'
  values=db.execute('select '+','.join(columns)+' from '+table+where+' order by '+order+' limit 50 offset ?',params+[page*50]).fetchall()
  return {'columns':columns,'rows':values,'count':count,'page':page,'pageSize':50}
def build(root='.'):
 root=pathlib.Path(root);a=root/'data.js';b=root/'ottelut-data.js';archive=root/'tietovarasto';history=archive/'lahdehistoria.jsonl';history_text=history.read_bytes().decode('utf-8') if history.exists() else ''
 revision=hashlib.sha256(b'v3\n'+a.read_bytes()+b.read_bytes()+history_text.encode()).hexdigest()
 if (root/NAME).exists():
  with connection(root) as old:previous_revision=old.execute("select value from metadata where key='revision'").fetchone()[0]
  if previous_revision==revision:return stats(root)
 data=js(a,'window.PAINI_SHARED_DATA = ');bouts=js(b,'window.PAINI_BOUTS_DATA = ')
 with tempfile.TemporaryDirectory(prefix='paini-db-build-') as temporary:
  file=pathlib.Path(temporary)/'database.sqlite';db=sqlite3.connect(file);db.execute('pragma foreign_keys=on')
  db.executescript('''
  create table metadata(key text primary key,value text not null);
  create table documents(key text primary key,payload blob not null);
  create table competitions(id text primary key,title text not null,details text not null);
  create table athletes(id text primary key,name text not null);
  create table placements(id text primary key,athlete_id text not null references athletes(id),competition_id text not null references competitions(id),name text,club text,category text,weight text,place integer);
  create table participants(id text primary key references placements(id),athlete_id text references athletes(id),competition_id text references competitions(id));
  create table matches(id text primary key,competition_id text references competitions(id),red text references participants(id),blue text references participants(id),winner text references participants(id),code text,points text,round text,check(red<>blue and winner in (red,blue)));
  create view athlete_stats as
  with sides as (
   select r.athlete_id as athlete,m.id as match_id,w.athlete_id as winner,b.athlete_id as other from matches m join participants r on r.id=m.red join participants b on b.id=m.blue join participants w on w.id=m.winner
   union all
   select b.athlete_id,m.id,w.athlete_id,r.athlete_id from matches m join participants r on r.id=m.red join participants b on b.id=m.blue join participants w on w.id=m.winner where r.athlete_id<>b.athlete_id
  ), totals as(select athlete,count(*) as matches,sum(case when athlete=winner and athlete<>other then 1 else 0 end) as wins,sum(case when athlete<>winner and athlete<>other then 1 else 0 end) as losses from sides group by athlete)
  select a.id,a.name,coalesce(c.competitions,0) as competitions,coalesce(t.matches,0) as matches,coalesce(t.wins,0) as wins,coalesce(t.losses,0) as losses from athletes a left join totals t on t.athlete=a.id left join (select athlete_id,count(distinct competition_id) as competitions from placements group by athlete_id) c on c.athlete_id=a.id;
  create table issues(id integer primary key,source text,reason text);
  create table excluded(id integer primary key,competition_id text references competitions(id),reason text);
  create table source_blobs(sha256 text primary key,content_gzip blob not null);
  create table source_versions(id text primary key,source text not null,sha256 text references source_blobs(sha256),fetched_at text);
  create index placement_athlete on placements(athlete_id);create index placement_competition on placements(competition_id);create index match_competition on matches(competition_id);create index source_url on source_versions(source);
  ''')
  db.executemany('insert into metadata values (?,?)',[('revision',revision),('data_sha256',hashlib.sha256(a.read_bytes()).hexdigest()),('bouts_sha256',hashlib.sha256(b.read_bytes()).hexdigest()),('archive_sha256',hashlib.sha256(history_text.encode()).hexdigest())])
  for key,value in [('data',data),('bouts',bouts)]:db.execute('insert into documents values (?,?)',(key,gzip.compress(encode(value).encode(),mtime=0)))
  for person in data['athleteRegistry']['athletes']:db.execute('insert into athletes values (?,?)',(person['id'],person['name']))
  for i,c in enumerate(data['competitions']):
   cid=c.get('source') or 'competition-'+str(i);db.execute('insert into competitions values (?,?,?)',(cid,c['title'],c['details']))
   db.executemany('insert into placements values (?,?,?,?,?,?,?,?)',[(r['resultId'],r['athleteId'],cid,r['name'],r['club'],r['category'],r['weight'],r['place']) for r in c['rows']])
  db.executemany('insert into participants values (?,?,?)',[(p['resultId'],p['athleteId'],p['competition']) for p in bouts['participants']])
  db.executemany('insert into matches values (?,?,?,?,?,?,?,?)',[(m['id'],m['competition'],m['red'],m['blue'],m['winner'],m['code'],encode(m.get('points')),m['round']) for m in bouts['matches']])
  db.executemany('insert into issues(source,reason) values (?,?)',[(i.get('source',''),i.get('reason','')) for i in bouts.get('issues',[])])
  db.executemany('insert into excluded(competition_id,reason) values (?,?)',[(e['competition'],e.get('reason','')) for e in bouts.get('excluded',[])])
  seen=set()
  for line in history_text.splitlines():
   e=json.loads(line);digest=e['sha256']
   if digest not in seen:
    raw=(archive/e['blob']).read_bytes()
    if hashlib.sha256(gzip.decompress(raw)).hexdigest()!=digest:raise ValueError('Lähteen tarkistussumma ei täsmää')
    db.execute('insert into source_blobs values (?,?)',(digest,raw));seen.add(digest)
   db.execute('insert into source_versions values (?,?,?,?)',(e['id'],e['source'],digest,e.get('fetchedAt')))
  assert not db.execute('pragma foreign_key_check').fetchall()
  if db.execute('select p.id from participants p join placements r on r.id=p.id where p.competition_id<>r.competition_id or p.athlete_id<>r.athlete_id limit 1').fetchone():raise ValueError('Osallistujan henkilö- tai kilpailuviittaus eroaa sijoituksesta')
  if db.execute('select m.id from matches m join participants r on r.id=m.red join participants b on b.id=m.blue join placements rp on rp.id=r.id join placements bp on bp.id=b.id where r.competition_id<>m.competition_id or b.competition_id<>m.competition_id or rp.category<>bp.category or rp.weight<>bp.weight limit 1').fetchone():raise ValueError('Ottelun kilpailu, sarja tai painoluokka ei täsmää')
  db.commit();assert db.execute('pragma integrity_check').fetchone()[0]=='ok';db.close()
  target=root/(NAME+'.tmp');target.write_bytes(gzip.compress(file.read_bytes(),compresslevel=6,mtime=0));target.replace(root/NAME)
 result=stats(root);(root/'tietokanta-tila.json').write_text(encode(result)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['build','read','stats','rows']);p.add_argument('--root',default='.');p.add_argument('--table',default='competitions');p.add_argument('--page',type=int,default=0);p.add_argument('--query',default='');p.add_argument('--sort',default='id-asc');a=p.parse_args()
 print(encode(build(a.root) if a.action=='build' else read(a.root) if a.action=='read' else stats(a.root) if a.action=='stats' else rows(a.root,a.table,a.page,a.query,a.sort)))
