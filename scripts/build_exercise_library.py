#!/usr/bin/env python3
"""Rebuild the trimmed exercise library.

public/exercises.json        the curated library the app offers when picking exercises
public/exercises-archive.json everything else from the original database; the app still
                              loads it so old workouts keep their muscles and form tips

Kept: every name in scripts/exercise-library.json, every exercise in the built-in presets
(public/index.html), and every exercise logged in data/*.json when that private export is
present (run scripts/pull.py first). Re-running is safe: both files are read back as the
source, so nothing is ever lost, and moving a name into the keep list restores it.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'public', 'exercises.json')
ARCHIVE = os.path.join(ROOT, 'public', 'exercises-archive.json')
CONFIG = os.path.join(ROOT, 'scripts', 'exercise-library.json')
INDEX = os.path.join(ROOT, 'public', 'index.html')
DATA = os.path.join(ROOT, 'data')


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def preset_names():
    html = open(INDEX).read()
    block = html[html.index('const DEFAULT_PRESETS'):]
    block = block[:block.index('];') + 2]
    return set(re.findall(r"exerciseName:'([^']+)'", block))


def history_names():
    names = set()
    if not os.path.isdir(DATA):
        return names
    for fn in os.listdir(DATA):
        if not fn.endswith('.json'):
            continue
        rows = load(os.path.join(DATA, fn), [])
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            for k, v in row.items():
                if re.search(r'exercise', k, re.I) and not re.search(r'id$', k, re.I) and isinstance(v, str) and v.strip():
                    names.add(v.strip())
    return names


def main():
    lib = load(LIB)
    archive = load(ARCHIVE, {'exercises': []})
    config = load(CONFIG)

    by_name = {}
    for ex in lib['exercises'] + archive.get('exercises', []):
        by_name.setdefault(ex['name'].lower(), ex)
    for ex in config.get('add', []):
        by_name.setdefault(ex['name'].lower(), dict(ex, added=True))

    curated = {n for group in config['keep'].values() for n in group} | {ex['name'] for ex in config.get('add', [])}
    missing = sorted(n for n in curated if n.lower() not in by_name)
    if missing:
        sys.exit('Names in exercise-library.json that are not in the database:\n  ' + '\n  '.join(missing))

    presets = preset_names()
    history = history_names()
    keep = {n.lower() for n in curated | presets | history}

    kept = sorted((ex for k, ex in by_name.items() if k in keep), key=lambda e: e['name'].lower())
    rest = sorted((ex for k, ex in by_name.items() if k not in keep), key=lambda e: e['name'].lower())

    out = {k: v for k, v in lib.items() if k not in ('exercises', 'exercises_to_merge')}
    out['exercises'] = kept
    to_merge = lib.get('exercises_to_merge', archive.get('exercises_to_merge', []))
    with open(LIB, 'w') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write('\n')
    with open(ARCHIVE, 'w') as f:
        json.dump({'exercises': rest, 'exercises_to_merge': to_merge}, f, indent=2, ensure_ascii=False)
        f.write('\n')

    unmatched_history = sorted(n for n in history if n.lower() not in by_name)
    print(f'library: {len(kept)} exercises ({len(curated)} curated, {len(presets)} preset, {len(history)} from history)')
    print(f'archive: {len(rest)} exercises')
    if not history:
        print('note: no data/ export found, so history was not checked here; the app still resolves archived names')
    if unmatched_history:
        print(f'{len(unmatched_history)} logged names are custom (not in either file): ' + ', '.join(unmatched_history[:20]))


if __name__ == '__main__':
    main()
