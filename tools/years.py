"""One year policy for catalogue, placements and bouts (Finnish calendar)."""
import datetime
from zoneinfo import ZoneInfo
START_YEAR=2020
def today(): return datetime.datetime.now(ZoneInfo('Europe/Helsinki'))
def available(now=None): return range(START_YEAR,(now or today()).year+1)
def years_for(arg='auto',now=None):
 now=now or today()
 if arg=='samples':return None
 if arg in ('all','missing') or (arg=='auto' and now.weekday()==6):return set(available(now))
 try: years={now.year if arg=='auto' else int(arg)}
 except (TypeError,ValueError):raise ValueError('Valitse auto, all, missing tai vuosiluku')
 if not years<=set(available(now)):raise ValueError(f'Valitse vuosi {START_YEAR}–{now.year}')
 return years
