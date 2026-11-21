"""Regression tests; no network requests. Run: python tools/test-collect-bouts.py."""
import copy,datetime,importlib.util,pathlib,tempfile,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('bouts',pathlib.Path(__file__).with_name('collect-bouts.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
U=b.HOST+b.SAMPLES[0];V=b.HOST+b.SAMPLES[-1]
def sample(url=U):
 people=[{'competition':url,'resultId':'r'+str(i),'athleteId':'p'+str(i),'category':'Pojat','weight':'30'} for i in [1,2]]
 match={'id':'m1','competition':url,'red':'r1','blue':'r2','winner':'r1','code':'PV','points':[2,1],'category':'Pojat','weight':'30','round':'1','source':url,'comparisonSource':url}
 meta={'key':url,'year':int(url.split('/')[4]),'title':'Testi','details':'Testi','stats':{'accepted':1,'excluded':0,'unmatchedNumbered':0,'unreadable':0}}
 return meta,people,[match],[],[]
def shared(url=U):
 meta,people,*_=sample(url)
 return {'version':1,'competitions':[{'source':url,'title':'Testi','details':'Testi','rows':[{**p,'name':'Nimi','club':'Seura'} for p in people]}]}
def old(url=U):
 meta,people,matches,excluded,issues=sample(url)
 return {'version':2,'checkedAt':'2026-01-01T00:00:00+00:00','competitions':[meta],'participants':people,'matches':matches,'excluded':excluded,'issues':issues}
class AutomaticImport(unittest.TestCase):
 def run_import(self,data=None,previous=None,year='all',event=None,error=None):
  with patch.object(b,'collect_event',side_effect=error,return_value=event or sample()):
   return b.collect_auto(data or shared(),object(),previous,year)
 def test_fresh_import_and_repeat(self):
  a,r=self.run_import();c,s=self.run_import(previous=a)
  self.assertEqual(a['matches'],c['matches']);self.assertEqual(s['summary']['updated'],1)
 def test_network_failure_preserves_matches(self):
  p=old();a,r=self.run_import(previous=p,error=OSError('offline'))
  self.assertEqual(a['matches'],p['matches']);self.assertEqual(r['summary']['preserved'],1)
 def test_new_failure_does_not_create_empty_competition(self):
  a,r=self.run_import(error=OSError('offline'))
  self.assertFalse(a['competitions']);self.assertEqual(r['summary']['failed'],1)
 def test_smaller_import_and_changed_result_preserve_old(self):
  for kind in ['missing','changed']:
   candidate=sample()
   if kind=='missing':candidate[2].clear()
   else:candidate[2][0]['points']=[3,2]
   a,r=self.run_import(previous=old(),event=candidate)
   self.assertEqual(a['matches'],old()['matches']);self.assertEqual(r['summary']['preserved'],1)
 def test_unselected_year_is_not_fetched(self):
  with patch.object(b,'collect_event') as fetch:
   a,r=b.collect_auto(shared(),object(),old(),'2026')
   fetch.assert_not_called();self.assertEqual(a['matches'],old()['matches']);self.assertEqual(r['summary']['attempted'],0)
 def test_new_year_merges_without_dropping_old_year(self):
  data=shared();new=shared(V)
  # Result IDs are global, so use different IDs for the second event.
  event=sample(V)
  for p in event[1]:p['resultId']+='b';p['athleteId']+='b'
  for p in new['competitions'][0]['rows']:p['resultId']+='b';p['athleteId']+='b'
  event[2][0].update(id='m2',red='r1b',blue='r2b',winner='r1b')
  data['competitions']+=new['competitions']
  a,r=self.run_import(data,old(),'2026',event)
  self.assertEqual(len(a['matches']),2);self.assertEqual({c['year'] for c in a['competitions']},{2022,2026})
 def test_changed_identity_blocks_publication(self):
  data=shared();data['competitions'][0]['rows'][0]['athleteId']='different'
  with self.assertRaisesRegex(ValueError,'painijaviittaus muuttui'):self.run_import(data,old())
 def test_registry_merge_is_explicitly_resolved(self):
  data=shared();data['competitions'][0]['rows'][0]['athleteId']='merged'
  data['athleteRegistry']={'athletes':[{'id':'p1','mergedInto':'merged'},{'id':'merged'}]}
  a,r=self.run_import(data,old(),error=OSError('offline'))
  self.assertEqual(a['participants'][0]['athleteId'],'merged')
 def test_duplicate_and_invalid_references_are_rejected(self):
  for kind in ['duplicate','wrong-winner','wrong-competition','negative-score']:
   data=old()
   if kind=='duplicate':data['matches']*=2
   elif kind=='wrong-winner':data['matches'][0]['winner']='r3'
   elif kind=='wrong-competition':data['participants'][0]['competition']=V
   else:data['matches'][0]['points']=[-1,0]
   with self.assertRaises(ValueError):b.validate(data)
 def test_namesakes_in_same_profile_keep_their_distinct_bout_participants(self):
  data=old();data['participants'][1]['athleteId']=data['participants'][0]['athleteId']
  b.validate(data)
  data['matches'][0]['blue']=data['matches'][0]['red']
  with self.assertRaises(ValueError):b.validate(data)
 def test_atomic_write_and_previous_load(self):
  import json
  with tempfile.TemporaryDirectory() as d:
   path=pathlib.Path(d)/'bouts.js';b.atomic_write(path,'window.PAINI_BOUTS_DATA = '+json.dumps(old())+';')
   self.assertEqual(b.load_previous(path)['matches'],old()['matches']);self.assertFalse(path.with_name('bouts.js.tmp').exists())
 def test_schedule_scope(self):
  self.assertEqual(b.years_for('auto',datetime.datetime(2026,11,16)),{2026})
  self.assertEqual(b.years_for('auto',datetime.datetime(2026,11,22)),set(range(2022,2027)))
 def test_comma_in_competition_directory_is_collected_and_reported(self):
  url=b.HOST+'LM/2023/FI/231028_Vaasa,Teeriniemenpainisali/indexFIN.htm'
  result,report=self.run_import(data=shared(url),event=sample(url),year='missing')
  self.assertEqual(report['summary']['attempted'],1)
  self.assertEqual(result['competitions'][0]['key'],url)
  self.assertEqual(report['summary']['coverageMissing'],0)
  result,report=self.run_import(data=shared(url),error=OSError('offline'),year='missing')
  self.assertEqual(report['summary']['failed'],1)
  self.assertEqual(result['coverageMissing'][0]['source'],url)
  self.assertEqual(result['coverageMissing'][0]['reason'],'offline')
 def test_comma_source_can_be_read_from_cache_without_weakening_other_url_checks(self):
  url=b.HOST+'LM/2026/FI/261107_Vaasa,Teeriniemenpainisali/indexFIN.htm'
  with tempfile.TemporaryDirectory() as directory:
   source=b.Source(directory,offline=True)
   cache=pathlib.Path(directory)/'LM/2026/FI/261107_Vaasa,Teeriniemenpainisali/indexFIN.htm'
   cache.parent.mkdir(parents=True);cache.write_text('Vaasan tulokset',encoding='utf-8')
   self.assertEqual(source.read(url),'Vaasan tulokset')
   for invalid in [url.replace('https:','http:'),url.replace('ringerdb.de/','ringerdb.de.evil/'),url+'?x=1',url+'#x',url.replace('indexFIN.htm','../indexFIN.htm')]:
    with self.assertRaises(ValueError):source.read(invalid)
if __name__=='__main__':unittest.main()
