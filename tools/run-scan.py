"""Run the same guarded import pipeline locally and in GitHub Actions."""
import argparse,subprocess,sys,os
from years import years_for

def run(year='auto',review_only=False):
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
 call(node,'tools/export-bouts.cjs')
 call(node,'tools/review-data.cjs','snapshot','.','after')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('year',nargs='?',default='auto');p.add_argument('--review-only',action='store_true');a=p.parse_args();run(a.year,a.review_only)
