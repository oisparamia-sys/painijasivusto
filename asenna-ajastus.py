from pathlib import Path
root=Path(__file__).resolve().parent
workflow=root/'.github/workflows/kilpailuhaku.yml'
if not workflow.exists():raise SystemExit('Ajastuksen tiedosto puuttuu projektista.')
print('Ajastus on jo projektissa: .github/workflows/kilpailuhaku.yml. Vanhaa kopiota ei asenneta sen päälle. Kilpailu- ja otteluhaku käyttävät tools/run-scan.py-työkalua.')
