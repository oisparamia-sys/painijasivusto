"""Recheck every reported bout source issue; never infer or approve a bout."""
import argparse, collections, concurrent.futures, importlib.util, json, os, pathlib, re
import ligadb as L
spec = importlib.util.spec_from_file_location('bout_collector', pathlib.Path(__file__).with_name('collect-bouts.py'))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)

def audit(root, output):
    root, output = pathlib.Path(root), pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    os.environ['PAINI_RUN_CACHE'] = str(output / 'cache')
    os.environ['PAINI_SOURCE_ARCHIVE'] = str(output / 'evidence')
    report = json.loads((root / 'ottelut-raportti.json').read_text())
    sources = sorted({i['source'] for i in report['sourceIssues']})
    def fetch(url):
        try:
            return url, L.get(url), None
        except Exception as e:
            return url, None, str(e)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pages = {url: (page, error) for url, page, error in pool.map(fetch, sources)}
    records = []
    for issue in report['sourceIssues']:
        page, error = pages[issue['source']]
        record = dict(issue, fetchError=error)
        if error:
            record['classification'] = 'unavailable-source'
        elif issue['reason'].startswith('Ottelutulos puuttuu'):
            rows = re.findall(r'<tr\b[^>]*>(.*?)</tr>', page, re.I | re.S)
            position = issue.get('position', -1)
            row = rows[position] if 0 <= position < len(rows) else ''
            record['sourceText'] = L.clean(row)
            profiles = set(re.findall(r'href\s*=\s*["\']([^"\']+NR\d+\.htm)', row, re.I))
            record['participantLinks'] = len(profiles)
            parsed, rejected = B.parse_bouts(page, issue['source'])
            record['classification'] = 'single-participant-row' if len(profiles) == 1 else 'unconfirmed-outcome'
            if any(r['position'] == position for r in parsed):
                record['classification'] = 'now-parsed-requires-collector-verification'
        elif issue['reason'].startswith('Painoluokan ottelulinkki'):
            groups = L.html_results(page)
            matches = [g for g in groups if issue['reason'].endswith(g['category'] + ' ' + g['weight'])]
            record['groups'] = [{k: g[k] for k in ['category', 'weight', 'count', 'unranked']} for g in matches]
            record['classification'] = 'no-opponent' if len(matches) == 1 and matches[0]['count'] == 1 else 'missing-bout-link'
        else:
            record['classification'] = 'ambiguous-source-identity'
        records.append(record)
    result = dict(version=1, sourceCount=len(sources), issues=records,
                  summary=dict(collections.Counter(r['classification'] for r in records)))
    (output / 'bout-issues.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['summary']), flush=True)

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', default=str(pathlib.Path(__file__).resolve().parents[1]))
    p.add_argument('--output', required=True)
    a = p.parse_args()
    audit(a.root, a.output)
