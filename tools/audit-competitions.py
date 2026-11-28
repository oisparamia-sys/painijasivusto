"""Re-fetch every accepted competition and retain independently inspectable evidence.

Read-only: writes only to --output, never changes accepted rows or review decisions.
"""
import argparse, collections, concurrent.futures, datetime, json, os, pathlib, re
import ligadb as L

def audit(root, output):
    root, output = pathlib.Path(root), pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    os.environ['PAINI_RUN_CACHE'] = str(output / 'cache')
    os.environ['PAINI_SOURCE_ARCHIVE'] = str(output / 'evidence')
    data = json.JSONDecoder().raw_decode((root / 'data.js').read_text().split('window.PAINI_SHARED_DATA = ', 1)[1])[0]
    def check(c):
        record = dict(source=c.get('source'), title=c['title'], details=c['details'], acceptedRows=len(c['rows']))
        try:
            incoming = L.competition(c['source'])
            # Also retain the full official TXT, including unranked participants.
            record.update(status='checked', parsed=incoming)
            index = L.get(c['source'])
            textlinks = [u for u in L.links(index) if u.endswith('_tab.txt')]
            if len(textlinks) == 1:
                url = L.urllib.parse.urljoin(c['source'], textlinks[0])
                try:
                    txt = L.tab_results(L.get(url))
                    record['txt'] = dict(source=url, **txt)
                except Exception as e:
                    record['txtError'] = str(e)
                    # One malformed TXT weight must not hide the other weights
                    # from this audit. Keep errors; do not silently import them.
                    if not isinstance(e, OSError):
                        text = L.get(url)
                        keys = {(L.clean(m[2]).casefold(), m[1].replace(',', '.')) for m in re.finditer(r'^\s*(\d+(?:[.,]\d+)?)\s*kg\t([^\t]+)\t', text, re.M | re.I)}
                        groups, errors = [], []
                        for key in sorted(keys):
                            try:
                                groups.extend(L.tab_results(text, {key})['groups'])
                            except ValueError as error:
                                errors.append(dict(category=key[0], weight=key[1], error=str(error)))
                        record['txtCheckedGroups'] = groups
                        record['txtInvalidGroups'] = errors
        except Exception as e:
            record.update(status='error', error=str(e))
        return record
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for record in pool.map(check, data['competitions']):
            records.append(record)
            (output / 'progress.json').write_text(json.dumps(records, ensure_ascii=False))
            print(f"{len(records)}/{len(data['competitions'])}: {record['status']} {record['title']}", flush=True)
    result = dict(version=1, checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), competitions=records,
                  summary=dict(collections.Counter(r['status'] for r in records)))
    (output / 'audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result['summary']

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', default=str(pathlib.Path(__file__).resolve().parents[1]))
    p.add_argument('--output', required=True)
    args = p.parse_args()
    print(json.dumps(audit(args.root, args.output)))
