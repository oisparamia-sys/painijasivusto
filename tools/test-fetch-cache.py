import tempfile,pathlib,unittest,os
from unittest.mock import patch
import ligadb
class Response:
 url='https://turniereklassisch.ringerdb.de/VT/2020/FI/Test/indexFIN.htm'
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return b'original page'
class SharedFetch(unittest.TestCase):
 def test_two_collectors_share_one_download_and_next_scan_fetches_fresh(self):
  url=Response.url
  for _ in range(2):
   with tempfile.TemporaryDirectory() as root,patch.dict(os.environ,{'PAINI_RUN_CACHE':root}),patch.object(ligadb.urllib.request,'urlopen',return_value=Response()) as request:
    self.assertEqual(ligadb.get(url),ligadb.get(url));self.assertEqual(request.call_count,1)
 def test_catalogue_posts_with_different_page_fields_do_not_collide(self):
  with tempfile.TemporaryDirectory() as root,patch.dict(os.environ,{'PAINI_RUN_CACHE':root}),patch.object(ligadb.urllib.request,'urlopen',return_value=Response()) as request:
   url='https://www.ringerdb.de/de/turniere/Turnieruebersicht.aspx';ligadb.get(url,{'page':'1'});ligadb.get(url,{'page':'2'});self.assertEqual(request.call_count,2)
if __name__=='__main__':unittest.main()
