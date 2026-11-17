"""No-network tests for missing numbered lists, source identity and coverage."""
import copy,importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('collector',pathlib.Path(__file__).with_name('collect-bouts.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
URL=b.HOST+'VT/2023/FI/231104_Kuru/indexFIN.htm'
def header():return '<a href="indexFIN.htm">Testi<br>Kuru, 4.11.2023</a>'
def bout(winner='A',points='4:2'):
 return '<tr><td></td><td>N1-N2<br>N 1. Kierros</td><td><a href="FIN1NR1.htm">'+('<b>A Testi</b>' if winner=='A' else 'A Testi')+'</a><br>Seura A</td><td><a href="FIN1NR2.htm">'+('<b>B Testi</b>' if winner=='B' else 'B Testi')+'</a><br>Seura B</td><td>PV '+('3:1' if winner=='A' else '1:3')+'</td><td>'+points+'</td></tr>'
def fixture(numbered=False,plain=False,unranked=False):
 rows=[{'name':name+' Testi','club':'Seura '+name,'category':'Pojat','weight':'30','place':i,'resultId':'r'+str(i),'athleteId':'a'+str(i)} for i,name in enumerate(['A','B'],1)]
 comp={'title':'Testi','details':'Kuru, 4.11.2023','source':URL,'rows':rows}
 index=header()+'<a href="FIN1tlges.htm">luettelo</a><a href="FIN130beg.htm">ottelut</a>'+('<a href="FIN1KF1.htm">numeroitu</a>' if numbered else '')
 roster=header()+'<tr><td>30 kg</td><td>Pojat</td><td>2 Osallistujaa</td></tr>'
 for i,name in enumerate(['A','B'],1):roster+='<tr><td>'+('' if unranked else str(i)+'.')+'</td><td>'+(name+' Testi' if plain else '<a href="FIN1NR'+str(i)+'.htm">'+name+' Testi</a>')+'</td><td>Seura '+name+'</td></tr>'
 pages={URL:index,URL.replace('indexFIN.htm','FIN1tlges.htm'):roster,URL.replace('indexFIN.htm','FIN130beg.htm'):header()+bout()}
 for i,name in enumerate(['A','B'],1):
  page=header()+''.join('<tr><td>'+label+'</td><td>'+value+'</td></tr>' for label,value in [('Painija',name+' Testi'),('Seura','Seura '+name),('Ikäluokka','Pojat'),('Paino','30kg')])+bout()
  pages[URL.replace('indexFIN.htm','FIN1NR'+str(i)+'.htm')]=page
 if numbered:pages[URL.replace('indexFIN.htm','FIN1KF1.htm')]=header()+bout()
 class Source(b.Source):
  def read(self,url):
   if url not in pages:raise OSError('Missing source')
   return pages[url]
 return comp,pages,Source()
class VerifiedSources(unittest.TestCase):
 def test_without_numbered_requires_both_profiles(self):
  c,p,s=fixture();meta,people,matches,excluded,issues=b.collect_event(c,s)
  self.assertEqual(len(matches),1);self.assertEqual(meta['comparisonMethod'],'both-participant-profiles');self.assertEqual(len(matches[0]['verificationSources']),2)
 def test_disagreeing_other_profile_rejects_match(self):
  c,p,s=fixture();key=URL.replace('indexFIN.htm','FIN1NR2.htm');p[key]=p[key].replace('PV 3:1','PV 1:3').replace('<b>A Testi</b>','A Testi').replace('>B Testi<','><b>B Testi</b><')
  self.assertFalse(b.collect_event(c,s)[2])
 def test_missing_other_profile_does_not_relax_checks(self):
  c,p,s=fixture();del p[URL.replace('indexFIN.htm','FIN1NR2.htm')];self.assertFalse(b.collect_event(c,s)[2])
 def test_wrong_profile_identity_or_weight_rejected(self):
  for before,after in [('>B Testi</td>','>Eri henkilö</td>'),('>30kg</td>','>32kg</td>'),('>Seura B</td>','>Toinen seura</td>')]:
   c,p,s=fixture();key=URL.replace('indexFIN.htm','FIN1NR2.htm');p[key]=p[key].replace(before,after);self.assertFalse(b.collect_event(c,s)[2])
 def test_plain_rank_list_requires_profile_identity(self):
  c,p,s=fixture(numbered=True,plain=True);self.assertEqual(len(b.collect_event(c,s)[2]),1)
  key=URL.replace('indexFIN.htm','FIN1NR1.htm');p[key]=p[key].replace('>A Testi</td>','>Eri henkilö</td>');self.assertFalse(b.collect_event(c,s)[2])
 def test_unranked_roster_only_matches_already_accepted_people(self):
  c,p,s=fixture(numbered=True,unranked=True);self.assertEqual(len(b.collect_event(c,s)[2]),1);c['rows'].pop();self.assertFalse(b.collect_event(c,s)[2])
 def test_numbered_list_remains_primary_when_present(self):
  c,p,s=fixture(numbered=True);key=URL.replace('indexFIN.htm','FIN1KF1.htm');p[key]=header()+bout(points='3:1');self.assertFalse(b.collect_event(c,s)[2])
 def test_duplicate_source_identity_is_not_attached_to_one_accepted_person(self):
  c,p,s=fixture(numbered=True);key=URL.replace('indexFIN.htm','FIN1tlges.htm');p[key]=p[key].replace('2 Osallistujaa','3 Osallistujaa')+'<tr><td>3.</td><td><a href="FIN1NR3.htm">A Testi</a></td><td>Seura A</td></tr>';self.assertFalse(b.collect_event(c,s)[2])
 def test_missing_score_remains_none(self):
  c,p,s=fixture()
  for key in p:p[key]=p[key].replace('4:2','')
  self.assertIsNone(b.collect_event(c,s)[2][0]['points'])
 def test_coverage_spans_unselected_year_and_preserves_known_failure(self):
  c,p,s=fixture();c['source']=c['source'].replace('/2023/','/2022/');data={'competitions':[c]}
  previous={'competitions':[],'participants':[],'matches':[],'excluded':[],'issues':[],'coverageMissing':[{'source':c['source'],'reason':'Tunnettu syy','checkedAt':'2026-01-01T00:00:00Z'}]}
  result,report=b.collect_auto(data,s,previous,'2026');self.assertEqual(report['summary']['attempted'],0);self.assertEqual(result['coverageMissing'][0]['reason'],'Tunnettu syy');self.assertEqual(report['summary']['coverageMissing'],1)
 def test_missing_scope_keeps_existing_events_and_fetches_only_unavailable(self):
  c,p,s=fixture(numbered=True);meta,people,matches,excluded,issues=b.collect_event(c,s);previous={'competitions':[meta],'participants':people,'matches':matches,'excluded':excluded,'issues':issues};result,report=b.collect_auto({'competitions':[c]},s,previous,'missing');self.assertEqual(report['summary']['attempted'],0);self.assertEqual(result['matches'],matches)
if __name__=='__main__':unittest.main()
