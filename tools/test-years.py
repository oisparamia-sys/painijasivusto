import datetime,unittest
from years import years_for,available
class YearPolicy(unittest.TestCase):
 def test_rollover(self):
  now=datetime.datetime(2027,1,1)
  self.assertEqual(years_for('auto',now),{2027})
  self.assertEqual(years_for('all',now),set(range(2020,2028)))
 def test_sunday(self):self.assertEqual(years_for('auto',datetime.datetime(2026,11,29)),set(range(2020,2027)))
 def test_history_and_rejection(self):
  self.assertEqual(years_for('2020'),{2020});self.assertEqual(years_for('2021'),{2021})
  for year in ['2019','9999','bad']:
   with self.assertRaises(ValueError):years_for(year)
if __name__=='__main__':unittest.main()
