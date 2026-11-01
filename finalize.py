"""Validate all fixed-budget observations and export public machine-readable data."""
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

from confirmation import ROOT, analyze, source_hashes, TOTAL_GAMES, GROUPS, GAMES_PER_GROUP
from run import RESOURCES, DEVELOPMENT_CARDS


def main():
    out=ROOT/'data/confirmation'
    plan=json.loads((out/'plan.json').read_text())
    rows=[json.loads(x) for x in (out/'results.jsonl').read_text().splitlines()]
    assert len(rows)==plan['games']==TOTAL_GAMES, len(rows)
    assert {r['id'] for r in rows}==set(range(TOTAL_GAMES))
    assert all(r['status']=='completed' for r in rows)
    assert plan['hashes']==source_hashes(), 'Confirmation code changed'
    summary=analyze(rows)
    assert len(summary)==GROUPS
    for g in summary:
        assert g['games']==GAMES_PER_GROUP and g['errors']==0
        assert len(g['seatPairs'])==6
        assert all(v['games']==100 for v in g['seatPairs'].values())
    maps=set();multi_threshold=[];short_awards=[]
    byid={r['id']:r for r in rows}
    with (out/'games.jsonl.gz').open('wb') as raw:
        with gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as archive:
            for i in range(TOTAL_GAMES):
                r=byid[i];task=plan['tasks'][i]
                assert (r['generation'],r['opponent'],r['seed'])==(task[1],task[2],task[4])
                assert r['seats']==[s+1 for s in task[3]]
                assert r['win']==(r['winner'] in r['oursColors'])
                game=json.loads((out/f'game-{i}.json').read_text())
                own_indices=[game['colors'].index(c) for c in r['oursColors']]
                assert sorted(j+1 for j in own_indices)==r['seats']
                winner=game['colors'].index(r['winner'])
                ps=game['player_state']
                assert ps[f'P{winner}_ACTUAL_VICTORY_POINTS']>=10
                if sum(ps[f'P{k}_ACTUAL_VICTORY_POINTS']>=10 for k in range(4))>1:multi_threshold.append(i)
                if any(ps[f'P{k}_HAS_ROAD'] and ps[f'P{k}_LONGEST_ROAD_LENGTH']<5 for k in range(4)):short_awards.append(i)
                for j,res in enumerate(RESOURCES):
                    assert game['resource_freqdeck'][j]+sum(ps[f'P{k}_{res}_IN_HAND'] for k in range(4))==19
                devs=len(game['development_listdeck'])
                devs+=sum(ps[f'P{k}_{card}_IN_HAND']+ps[f'P{k}_PLAYED_{card}'] for k in range(4) for card in DEVELOPMENT_CARDS)
                assert devs==25
                physical={tuple(sorted(e)):c for e,c in game['board']['roads']}
                assert len(physical)*2==len(game['board']['roads'])
                assert all(sum(c==color for c in physical.values())<=15 for color in game['colors'])
                maps.add(hashlib.sha256(json.dumps(game['map'],sort_keys=True).encode()).hexdigest())
                payload=json.dumps({'id':i,'game':game},separators=(',',':')).encode()+b'\n'
                archive.write(payload)
    (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    with (out/'results.csv').open('w',newline='') as f:
        fields=['id','generation','opponent','seed','seatPair','win','winner','rolls','seconds','decisions','roadResolutionAdaptations']
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for r in sorted(rows,key=lambda r:r['id']):
            item={k:r[k] for k in fields if k!='seatPair'};item['seatPair']=','.join(map(str,r['seats']));w.writerow(item)
    validation=dict(passed=True,checkedAt=datetime.now(timezone.utc).isoformat(),
                    games=TOTAL_GAMES,errors=0,distinctSeeds=len({r['seed'] for r in rows}),distinctBoards=len(maps),
                    allSeatPairsBalanced=True,allWinnersVerified=True,
                    resourceConservationVerified=True,developmentCardConservationVerified=True,
                    roadPieceLimitsVerified=True,sourceHashesVerified=True,
                    multipleTenPointTerminalGameIds=multi_threshold,
                    roadAwardBelowFiveGameIds=short_awards,
                    roadRuleAdaptations=sum(r['roadResolutionAdaptations'] for r in rows),
                    decisions=sum(r['decisions'] for r in rows),
                    protocolSha256=hashlib.sha256((out/'plan.json').read_bytes()).hexdigest(),
                    resultsSha256=hashlib.sha256((out/'results.jsonl').read_bytes()).hexdigest(),
                    gameArchiveSha256=hashlib.sha256((out/'games.jsonl.gz').read_bytes()).hexdigest(),
                    productionUpdated=False)
    (out/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
    print(json.dumps(validation,indent=2))
    for g in summary:
        print(g['generation'],g['opponent'],g['wins'],g['games'],g['winRate'],g['ci95'],g['familywiseHoeffding95'])


if __name__=='__main__':main()
