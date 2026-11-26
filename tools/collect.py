import json,sys,concurrent.futures,datetime
from ligadb import catalog,competition
arg=sys.argv[1] if len(sys.argv)>1 else 'auto'
from years import years_for
years=sorted(years_for(arg))
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
