"""Audit the distributed compressed record archive, without loose game files."""
import gzip
import hashlib
import json
import math
from pathlib import Path

from confirmation import ROOT, analyze, source_hashes, TOTAL_GAMES, GAMES_PER_GROUP


def equivalent(a,b):
    if isinstance(a,dict):return a.keys()==b.keys() and all(equivalent(a[k],b[k]) for k in a)
    if isinstance(a,list):return len(a)==len(b) and all(equivalent(x,y) for x,y in zip(a,b))
    if isinstance(a,float):return math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12)
    return a==b


def main():
    out=ROOT/'data/confirmation'
    v=json.loads((out/'validation.json').read_text())
    plan=json.loads((out/'plan.json').read_text())
    assert plan['hashes']==source_hashes()
    rows=[json.loads(x) for x in (out/'results.jsonl').read_text().splitlines()]
    assert len(rows)==TOTAL_GAMES and len({r['id'] for r in rows})==TOTAL_GAMES
    assert all(r['status']=='completed' for r in rows)
    assert hashlib.sha256((out/'results.jsonl').read_bytes()).hexdigest()==v['resultsSha256']
    assert hashlib.sha256((out/'games.jsonl.gz').read_bytes()).hexdigest()==v['gameArchiveSha256']
    indexed={r['id']:r for r in rows};seen=set()
    with gzip.open(out/'games.jsonl.gz','rt') as f:
        for line in f:
            x=json.loads(line);i=x['id'];game=x['game'];r=indexed[i]
            assert i not in seen;seen.add(i)
            winner=game['colors'].index(r['winner'])
            assert game['player_state'][f'P{winner}_ACTUAL_VICTORY_POINTS']>=10
            assert r['win']==(r['winner'] in r['oursColors'])
            assert sorted(game['colors'].index(c)+1 for c in r['oursColors'])==r['seats']
    assert len(seen)==TOTAL_GAMES
    summary=analyze(rows)
    assert equivalent(summary,json.loads((out/'summary.json').read_text()))
    assert all(g['games']==GAMES_PER_GROUP and all(s['games']==100 for s in g['seatPairs'].values()) for g in summary)
    print(json.dumps({'passed':True,'games':len(seen),'sourceHashesVerified':True,'archiveVerified':True,'summaryRecomputed':True}))


if __name__=='__main__':main()
