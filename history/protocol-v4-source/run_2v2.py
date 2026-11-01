"""Two production bots and two external bots, each playing for its own win.

Reuses the 1v3 bridge with a mandatory-free-road resolution fix. Every seat pair is equally represented;
games use fresh random streams, not one shared dice sequence. No team knowledge.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import itertools
import json
import math
import random
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from run import ROOT, COLORS, Game, Ours, PublicBot, state_to_json

SEAT_PAIRS = list(itertools.combinations(range(4), 2))
OUR_COLORS = COLORS[:2]


def seed_for_pair(seed, seats):
    # Inspect only seating, never the board, dice, or result.
    while True:
        order = random.Random(seed).sample(COLORS, 4)
        if tuple(sorted(order.index(c) for c in OUR_COLORS)) == tuple(seats):
            return seed
        seed += 1


def play(task):
    ident, generation, kind, seats, seed, outdir = task
    start = time.monotonic()
    ours = []
    common = dict(id=ident, generation=generation, opponent=kind,
                  seats=[s + 1 for s in seats], seed=seed)
    try:
        for i, color in enumerate(OUR_COLORS):
            ours.append(Ours(color, generation, seed ^ (0xC4A771 + i * 7187),
                             Path(outdir) / f'error-{ident}-{color.value}.json'))
        others = [PublicBot(c, kind, seed ^ ((i + 2) * 7187))
                  for i, c in enumerate(COLORS[2:])]
        players = ours + others
        game = Game(players, seed=seed)
        assert tuple(sorted(game.state.colors.index(c) for c in OUR_COLORS)) == tuple(seats)
        winner = game.play()
        if winner is None:
            raise RuntimeError('Censored unfinished game; not counted as defeat')
        own_times = [t for p in ours for t in p.ms]
        opponent_times = [t for p in others for t in p.ms]
        phases = sum((p.phases for p in ours), collections.Counter())
        result = dict(common, status='completed', win=winner in OUR_COLORS,
                      winner=winner.value,
                      winnerSeat=game.state.colors.index(winner) + 1,
                      playerColors=[c.value for c in game.state.colors],
                      oursColors=[c.value for c in OUR_COLORS],
                      rolls=sum(a.action_type.value == 'ROLL' for a, _ in game.state.action_records),
                      seconds=time.monotonic() - start, decisions=len(own_times),
                      phases=dict(phases),
                      roadResolutionAdaptations=sum(p.road_adaptations for p in ours),
                      ownMs=sum(own_times) / max(1, len(own_times)),
                      ownMaxMs=max(own_times, default=0),
                      opponentMs=sum(opponent_times) / max(1, len(opponent_times)),
                      opponentMaxMs=max(opponent_times, default=0),
                      vp=[game.state.player_state[f'P{i}_ACTUAL_VICTORY_POINTS'] for i in range(4)])
        Path(outdir, f'game-{ident}.json').write_text(json.dumps(state_to_json(game)))
        return result
    except Exception:
        return dict(common, status='error', error=traceback.format_exc(),
                    seconds=time.monotonic() - start)
    finally:
        for player in ours:
            player.close()


def summary(rows):
    result = []
    for generation, opponent in sorted({(r['generation'], r['opponent']) for r in rows}):
        group = [r for r in rows if (r['generation'], r['opponent']) == (generation, opponent)]
        good = [r for r in group if r['status'] == 'completed']
        n = len(good)
        entry = dict(generation=generation, opponent=opponent, games=n,
                     errors=len(group) - n, neutralWinRate=0.5)
        if n:
            w = sum(r['win'] for r in good)
            p = w / n
            z = 1.96
            den = 1 + z * z / n
            mid = (p + z * z / (2 * n)) / den
            half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
            entry.update(wins=w, winRate=p, ci95=[mid - half, mid + half],
                         averageRolls=sum(r['rolls'] for r in good) / n,
                         seconds=sum(r['seconds'] for r in good),
                         seatPairs={','.join(str(s + 1) for s in seats): {
                             'games': sum(r['seats'] == [s + 1 for s in seats] for r in good),
                             'wins': sum(r['seats'] == [s + 1 for s in seats] and r['win'] for r in good)}
                             for seats in SEAT_PAIRS})
        result.append(entry)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--per-group', type=int, default=48)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--generations', default='gen0,gen1,gen2')
    parser.add_argument('--opponents', default='AB,F')
    parser.add_argument('--seed', type=int, default=2931031)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    if args.per_group <= 0 or args.per_group % 6:
        parser.error('--per-group must be a positive multiple of 6 for balanced seat pairs')
    if args.workers < 1:
        parser.error('--workers must be positive')
    generations = args.generations.split(',')
    opponents = args.opponents.split(',')
    if len(set(generations)) != len(generations) or not set(generations) <= {'gen0', 'gen1', 'gen2'}:
        parser.error('invalid generations')
    if len(set(opponents)) != len(opponents) or not set(opponents) <= {'AB', 'F'}:
        parser.error('invalid opponents')
    # Production policy is unchanged; adapter revision is explicitly recorded.
    manifest = json.loads((ROOT / 'bridge-manifest.json').read_text())
    for base, files in [(ROOT / 'frozen', manifest['files']), (ROOT, manifest['adapterFiles'])]:
        for name, expected in files.items():
            actual = hashlib.sha256((base / name).read_bytes()).hexdigest()
            if actual != expected:
                raise RuntimeError(f'Frozen trial input changed: {base / name}')
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=False)
    tasks = []
    for gi, gen in enumerate(generations):
        for oi, opp in enumerate(opponents):
            for j in range(args.per_group):
                seats = SEAT_PAIRS[j % 6]
                seed = seed_for_pair(args.seed + gi * 1000000 + oi * 100000 + j * 100, seats)
                tasks.append((len(tasks), gen, opp, seats, seed, str(out)))
    assert len({t[4] for t in tasks}) == len(tasks), 'Seed collision; choose a wider spacing'
    manifest['twoVsTwoRunnerSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    manifest['twoVsTwoCreated'] = datetime.now(timezone.utc).isoformat()
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (out / 'run_2v2.py').write_text(Path(__file__).read_text())
    (out / 'plan.json').write_text(json.dumps({
        'args': vars(args), 'tasks': tasks, 'mode': '2v2 individual free-for-all',
        'neutralWinRate': 0.5, 'seatPairs': SEAT_PAIRS,
        'information': 'public-only; separate node processes; no team hand or policy sharing',
        'dice': 'independent game seeds; not a single fixed dice sequence',
        'fallback': 'none; any adapter error invalidates game', 'productionUpdated': False,
    }, indent=2))
    rows = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(play, task) for task in tasks]
        for future in concurrent.futures.as_completed(futures):
            row = future.result()
            rows.append(row)
            with (out / 'results.jsonl').open('a') as f:
                f.write(json.dumps(row) + '\n')
            (out / 'summary.json').write_text(json.dumps(summary(rows), indent=2))
            print(json.dumps({k: row[k] for k in ('id', 'generation', 'opponent', 'status', 'seconds')}), flush=True)
    print(json.dumps(summary(rows)), flush=True)


if __name__ == '__main__':
    main()
