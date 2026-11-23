"""Verify numeric partial standings and official TXT-only friendship results."""
import copy,unittest
from unittest.mock import patch
import ligadb as L
BASE='https://turniereklassisch.ringerdb.de/VT/2026/FI/260101_Helsinki/'
URL=BASE+'indexFIN.htm'
HEADER='<a href="indexFIN.htm">Testi<br>Helsinki, 1.1.2026</a>'
def category(rows,count=None):
 count=len(rows) if count is None else count
 return HEADER+'<div>Täyd. tulosluettelo Pojat - Vapaa ('+str(count)+' Osallistujaa)</div><table><tr><td>30 kg</td><td>Pojat</td><td>'+str(len(rows))+' Osallistujaa</td></tr>'+''.join('<tr><td>'+rank+'</td><td>'+name+'</td><td>Seura</td></tr>' for rank,name in rows)+'</table>'
def text(rows,category='Ystävyysottelu',count=None):
 return 'Testi\nHelsinki, 1.1.2026\n90 kg\t'+category+'\t('+str(len(rows) if count is None else count)+' Osallistujaa)\n'+'\n'.join('\t'+'\t'.join(row) for row in rows)
def run(html=None,txt=None,link='FIN1_tab.txt'):
 index=HEADER;pages={}
 if html is not None:index+='<a href="FIN1tlges.htm">Pojat</a>';pages[BASE+'FIN1tlges.htm']=html
 if txt is not None:index+='<a href="'+link+'">TXT</a>';pages[L.urllib.parse.urljoin(URL,link)]=txt
 pages[URL]=index
 with patch.object(L,'get',side_effect=lambda url:pages[url]):return L.competition(URL)
class PartialStandings(unittest.TestCase):
 def test_placed_row_is_kept_without_guessing_an_unplaced_row(self):
  result=run(html=category([('1.','A Testi'),('','B Testi')]))
  self.assertIn('1.\tA Testi\tSeura',result['text']);self.assertNotIn('B Testi',result['text'])
  self.assertEqual(result['pages'][0]['count'],1)
  self.assertEqual(result['warnings'][0]['included'],1);self.assertEqual(result['warnings'][0]['excluded'],1)
 def test_dq_is_not_a_place_and_does_not_hide_other_standings(self):
  result=run(html=category([('1.','A Testi'),('Dq','B Testi')]))
  self.assertIn('A Testi',result['text']);self.assertNotIn('B Testi',result['text'])
  self.assertEqual(result['warnings'][0]['unranked'],1)
 def test_category_total_conflict_keeps_the_existing_strict_rule(self):
  with self.assertRaisesRegex(ValueError,'osallistujamäärät eroavat'):run(html=category([('1.','A Testi')],count=2))
 def test_unplaced_participants_alone_do_not_create_results(self):
  with self.assertRaisesRegex(ValueError,'vahvistettuja sijoituksia'):run(html=category([('','A Testi'),('','B Testi')]))
 def test_txt_only_standings_have_an_explicit_source_and_unknown_style(self):
  result=run(txt=text([('1.','A Testi','Seura'),('2.','B Testi','Seura')]))
  self.assertEqual(result['textSource'],BASE+'FIN1_tab.txt')
  self.assertEqual(result['pages'][0]['style'],'unknown');self.assertEqual(result['pages'][0]['verification'],'official-txt')
  self.assertEqual(result['pages'][0]['count'],2);self.assertFalse(result['warnings'])
 def test_txt_partial_standings_keep_only_numeric_places(self):
  result=run(txt=text([('1.','A Testi','Seura'),('B Testi','Seura')]))
  self.assertIn('A Testi',result['text']);self.assertNotIn('B Testi',result['text'])
  self.assertEqual(result['warnings'][0]['included'],1);self.assertEqual(result['warnings'][0]['excluded'],1)
 def test_txt_can_add_multiple_weights_without_duplicate_category_pages(self):
  txt=text([('1.','A Testi','Seura')])+'\n91 kg\tYstävyysottelu\t(1 Osallistujaa)\n\t1.\tB Testi\tSeura\n'
  result=run(txt=txt);self.assertEqual(len(result['pages']),1);self.assertEqual(result['pages'][0]['count'],2)
 def test_superfinal_is_supported_with_no_inferred_style(self):
  result=run(txt=text([('1.','A Testi','Seura')],category='Superfinaali'))
  self.assertEqual(result['pages'][0]['style'],'unknown')
 def test_txt_count_mismatch_and_duplicate_rows_are_rejected(self):
  for txt in [text([('1.','A Testi','Seura')],count=2),text([('1.','A Testi','Seura'),('1.','A Testi','Seura')])]:
   with self.subTest(txt=txt),self.assertRaises(ValueError):run(txt=txt)
 def test_txt_participant_list_is_not_treated_as_standings(self):
  with self.assertRaisesRegex(ValueError,'vahvistettuja sijoituksia'):run(txt=text([('A Testi','Seura'),('B Testi','Seura')]))
 def test_txt_wrong_event_and_foreign_directory_are_rejected(self):
  for txt,link in [(text([('1.','A Testi','Seura')]).replace('Testi\n','Eri kilpailu\n',1),'FIN1_tab.txt'),(text([('1.','A Testi','Seura')]),'../Muu/FIN1_tab.txt')]:
   with self.subTest(link=link),self.assertRaises(ValueError):run(txt=txt,link=link)
 def test_unrelated_txt_category_still_requires_html_verification(self):
  with self.assertRaisesRegex(ValueError,'HTML-tulosluetteloa'):run(txt=text([('1.','A Testi','Seura')],category='Miehet'))
 def test_invalid_unrelated_txt_rows_do_not_replace_verified_html_standings(self):
  txt=text([('1.','A Testi','Seura')])+'\n30 kg\tPojat\t(1 Osallistujaa)\n\t1.\tEri nimi\t\tRikkinäinen rivi\n'
  result=run(html=category([('1.','HTML Testi')]),txt=txt)
  self.assertIn('HTML Testi',result['text']);self.assertIn('A Testi',result['text']);self.assertNotIn('Eri nimi',result['text'])
if __name__=='__main__':unittest.main()
