import importlib.util,pathlib,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('scan',pathlib.Path(__file__).with_name('run-scan.py'));s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class SharedPipeline(unittest.TestCase):
 def commands(self,year='2020',review=False):
  with patch.object(s.subprocess,'run') as run:s.run(year,review);return [c.args[0] for c in run.call_args_list]
 def test_review_does_not_fetch(self):
  commands=self.commands(review=True);self.assertFalse(any('tools/collect.py' in c or 'tools/collect-bouts.py' in c for c in commands));self.assertTrue(any('tools/check-database.cjs' in c for c in commands))
 def test_missing_only_fetches_bouts(self):
  commands=self.commands('missing');self.assertFalse(any('tools/collect.py' in c for c in commands));self.assertTrue(any('tools/collect-bouts.py' in c for c in commands))
 def test_placements_precede_bouts_and_failure_stops_export(self):
  commands=self.commands();a=next(i for i,c in enumerate(commands) if 'tools/update-data.cjs' in c);b=next(i for i,c in enumerate(commands) if 'tools/collect-bouts.py' in c);self.assertLess(a,b)
  with patch.object(s.subprocess,'run',side_effect=RuntimeError('failed')) as run:
   with self.assertRaises(RuntimeError):s.run('2020')
   self.assertEqual(run.call_count,1)
if __name__=='__main__':unittest.main()
