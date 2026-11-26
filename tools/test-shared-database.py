import importlib.util,pathlib,tempfile,json,gzip,hashlib,unittest
spec=importlib.util.spec_from_file_location('database',pathlib.Path(__file__).with_name('shared-database.py'));D=importlib.util.module_from_spec(spec);spec.loader.exec_module(D)
class SharedDatabase(unittest.TestCase):
 def fixture(self,root):
  data={'version':1,'athleteRegistry':{'athletes':[{'id':'a','name':'A'},{'id':'b','name':'B'}],'history':[{'old':'keep'}]},'competitions':[{'source':'event','title':'Test','details':'2020','rows':[{'resultId':i,'athleteId':i,'name':i,'club':'Club','category':'U17','weight':'50','place':n} for n,i in enumerate(['a','b'],1)]}]}
  bouts={'participants':[{'resultId':i,'athleteId':i,'competition':'event'} for i in ['a','b']],'matches':[{'id':'m','competition':'event','red':'a','blue':'b','winner':'a','code':'PV','points':[4,2],'round':'1'}],'issues':[{'source':'source','reason':'Missing'}],'excluded':[]}
  (root/'data.js').write_text('window.PAINI_SHARED_DATA = '+json.dumps(data)+';');(root/'ottelut-data.js').write_text('window.PAINI_BOUTS_DATA = '+json.dumps(bouts)+';');return data,bouts
 def test_roundtrip_and_read_only_browsing(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=pathlib.Path(temporary);data,bouts=self.fixture(root);D.build(root);saved=D.read(root);self.assertEqual(saved['data'],data);self.assertEqual(saved['bouts'],bouts);self.assertEqual(D.rows(root,'matches')['rows'][0][6],'[4,2]');self.assertEqual(D.rows(root,'placements',query='Club')['count'],2);self.assertEqual(D.rows(root,'athlete_stats')['rows'][0][3],1)
   with D.connection(root) as db:
    with self.assertRaises(Exception):db.execute('delete from placements')
   with self.assertRaises(ValueError):D.rows(root,'placements;drop table matches')
 def test_bad_foreign_key_cannot_replace_accepted_database(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=pathlib.Path(temporary);_,bouts=self.fixture(root);D.build(root);before=(root/D.NAME).read_bytes();bouts['matches'][0]['winner']='missing';(root/'ottelut-data.js').write_text('window.PAINI_BOUTS_DATA = '+json.dumps(bouts)+';')
   with self.assertRaises(Exception):D.build(root)
   self.assertEqual((root/D.NAME).read_bytes(),before)
 def test_source_versions_keep_exact_evidence_and_reject_corruption(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=pathlib.Path(temporary);self.fixture(root);archive=root/'tietovarasto';archive.mkdir();raw=b'original';digest=hashlib.sha256(raw).hexdigest();(archive/'source.gz').write_bytes(gzip.compress(raw));(archive/'lahdehistoria.jsonl').write_text(json.dumps({'id':'s','source':'https://example.test','sha256':digest,'blob':'source.gz'})+'\n');D.build(root)
   with D.connection(root) as db:self.assertEqual(gzip.decompress(db.execute('select content_gzip from source_blobs').fetchone()[0]),raw)
   (archive/'source.gz').write_bytes(gzip.compress(b'changed'));(root/'data.js').write_text((root/'data.js').read_text()+' ')
   with self.assertRaises(ValueError):D.build(root)
if __name__=='__main__':unittest.main()
