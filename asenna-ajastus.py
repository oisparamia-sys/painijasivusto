from pathlib import Path
import shutil
root=Path(__file__).resolve().parent
source=root/'kilpailuhaku.yml';target=root/'.github/workflows/kilpailuhaku.yml'
if not (root/'data.js').exists() or not (root/'athlete-registry.js').exists():raise SystemExit('Kopioi ajastuksen tiedostot ensin omaan painijasivusto-kansioosi ja aja komento siellä.')
if target.exists() and target.read_bytes()!=source.read_bytes():raise SystemExit('Ajastus on jo olemassa eri versiona. Tarkista .github/workflows/kilpailuhaku.yml ennen korvaamista.')
target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
print('Ajastus asennettu: .github/workflows/kilpailuhaku.yml. Tee Commit + Push. Avaa sitten GitHubin Actions -> Kilpailujen automaattihaku -> Run workflow.')
