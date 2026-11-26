"""Run the same guarded import pipeline locally and in GitHub Actions."""
import argparse,subprocess,sys,os,tempfile
from years import years_for

def _run(year='auto',review_only=False):
 years_for(year)
 node=os.environ.get('PAINI_NODE','node')
 def call(*args):subprocess.run(args,check=True)
 call(node,'tools/review-data.cjs','snapshot','.','before')
 call(node,'tools/review-data.cjs','apply')
 call(node,'tools/sync-identities.cjs')
 if not review_only:
  if year!='missing':
   call(sys.executable,'tools/collect.py',year)
   call(node,'tools/update-data.cjs')
  call(node,'tools/sync-identities.cjs')
  call(sys.executable,'tools/collect-bouts.py','--year',year)
  call(node,'tools/review-data.cjs','ingest')
 call(node,'tools/check-database.cjs')
 call(sys.executable,'tools/shared-database.py','build')
 call(node,'tools/export-bouts.cjs')
 call(node,'tools/review-data.cjs','snapshot','.','after')
def run(year='auto',review_only=False):
 with tempfile.TemporaryDirectory(prefix='paini-fetch-') as temporary:
  previous=os.environ.get('PAINI_RUN_CACHE');previous_archive=os.environ.get('PAINI_SOURCE_ARCHIVE');os.environ['PAINI_RUN_CACHE']=temporary
  os.environ.setdefault('PAINI_SOURCE_ARCHIVE',os.path.abspath('tietovarasto'))
  try:return _run(year,review_only)
  finally:
   if previous is None:os.environ.pop('PAINI_RUN_CACHE',None)
   else:os.environ['PAINI_RUN_CACHE']=previous
   if previous_archive is None:os.environ.pop('PAINI_SOURCE_ARCHIVE',None)
   else:os.environ['PAINI_SOURCE_ARCHIVE']=previous_archive
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('year',nargs='?',default='auto');p.add_argument('--review-only',action='store_true');a=p.parse_args();run(a.year,a.review_only)
