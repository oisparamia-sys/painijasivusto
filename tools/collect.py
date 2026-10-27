import json,sys,concurrent.futures,datetime
from ligadb import catalog,competition
arg=sys.argv[1] if len(sys.argv)>1 else 'auto'
now=datetime.datetime.now(datetime.timezone.utc)
years=list(range(2022,2027)) if arg=='all' or (arg=='auto' and now.weekday()==6) else [min(2026,max(2022,now.year))] if arg=='auto' else [int(arg)]
if not all(y in range(2022,2027) for y in years):raise ValueError('Vuosi ei kelpaa')
urls=[];errors=[]
for year in years:
 try:urls+=catalog(year)
 except Exception as e:errors.append({'source':str(year),'error':str(e)})
def fetch(url):
 try:return competition(url)
 except Exception as e:return {'source':url,'error':str(e)}
items=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for item in pool.map(fetch,sorted(set(urls))):
  if 'error' in item:errors.append(item)
  else:items.append(item)
json.dump({'items':items,'errors':errors},open('collected.json','w'),ensure_ascii=False)
print(f'Lähteitä {len(set(urls))}, luettu {len(items)}, virheitä {len(errors)}',flush=True)
if not items:raise RuntimeError('Ei tarkistettavia lähteitä; aineistoa ei muutettu')
