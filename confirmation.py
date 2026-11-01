"""Fixed-size public-information 2+2 confirmation; no training or promotion.

One independently randomized game per observation. All six seat pairs balanced.
Source hashes are checked on resume. Stop after current games with a STOP file.
"""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
import math
import os
from pathlib import Path
import platform
import random
import signal
from statistics import NormalDist
import sys
import time

import run_2v2 as arena
from run import AlphaBetaPlayer, PublicBot

ROOT = Path(__file__).resolve().parent
SOURCE_FILES = ['confirmation.py', 'run.py', 'run_2v2.py', 'verify.py',
                'verify_public.py', 'verify_belief.py', 'runtime.js', 'driver.js', 'conversion.js',
                'bot.js', 'belief.py', 'manifest.json', 'bridge-manifest.json', 'requirements.txt']
GENERATIONS=('gen0',)
OPPONENTS=('AB_FULL','F')
GAMES_PER_GROUP=600
GROUPS=len(GENERATIONS)*len(OPPONENTS)
TOTAL_GAMES=GAMES_PER_GROUP*GROUPS
MASTER_SEED=941031001


class ConfirmationOpponent(PublicBot):
    def __init__(self, color, kind, seed):
        if kind not in ('AB_FULL', 'F'):
            raise ValueError(kind)
        super().__init__(color, 'AB' if kind == 'AB_FULL' else kind, seed)
        if kind == 'AB_FULL':
            # Upstream default: depth two, base evaluation, no action filtering.
            self.bot = AlphaBetaPlayer(color, AlphaBetaPlayer.Params(depth=2, prunning=False))


def source_hashes():
    names = SOURCE_FILES + [str(x.relative_to(ROOT)) for x in sorted((ROOT/'frozen').glob('*')) if x.is_file()]
    return {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names}


def play(task):
    random.seed(task[4] ^ 0x51C4A7)
    arena.PublicBot = ConfirmationOpponent
    result = arena.play(task)
    result['analysisBlock'] = task[0] % 600 // 6
    return result


def intervals(w, n, alpha=.05):
    if not n:
        return None
    z = NormalDist().inv_cdf(1-alpha/2)
    p = w/n
    den = 1+z*z/n
    mid = (p+z*z/(2*n))/den
    half = z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
    return [max(0., mid-half), min(1., mid+half)]


def analyze(rows, planned_groups=GROUPS):
    result = arena.summary(rows)
    for item in result:
        n = item['games']
        if n:
            # Simultaneous finite-sample bound, valid for independent bounded
            # outcomes even when the six fixed seat strata have different rates.
            eps = math.sqrt(math.log(2*planned_groups/.05)/(2*n))
            p = item['winRate']
            item['familywiseHoeffding95'] = [max(0., p-eps), min(1., p+eps)]
            item['familywiseWilson95'] = intervals(item['wins'], n, .05/planned_groups)
            item['confirmedAdvantage'] = n == GAMES_PER_GROUP and item['errors'] == 0 and p-eps > .5
    return result


def load_rows(out):
    path = out/'results.jsonl'
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def write_json(path, value):
    temp = path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value, indent=2)+'\n')
    temp.replace(path)


def prepare(out):
    out.mkdir(parents=True, exist_ok=False)
    tasks = []
    for gi, gen in enumerate(GENERATIONS):
        for oi, opp in enumerate(OPPONENTS):
            for j in range(GAMES_PER_GROUP):
                seats = arena.SEAT_PAIRS[j % 6]
                seed = arena.seed_for_pair(MASTER_SEED + gi*10000000 + oi*1000000 + j*100, seats)
                tasks.append((len(tasks), gen, opp, seats, seed, 'data/confirmation'))
    assert len({t[4] for t in tasks}) == TOTAL_GAMES
    plan = dict(created=datetime.now(timezone.utc).isoformat(), games=TOTAL_GAMES, gamesPerGroup=GAMES_PER_GROUP,
                groups=GROUPS, generations=GENERATIONS, tasks=tasks, masterSeed=MASTER_SEED, neutralWinRate=.5,
                protocolRevision='v5: only pre-existing public default gen0; previous v4 campaign excluded in full',
                primaryRule='For each of two predeclared groups, simultaneous Hoeffding 95% lower bound > 0.5; report both.',
                precision='Wilson 95% interval worst-case half width about 4 percentage points at n=600.',
                information='Public information with separate private-hand beliefs; no team sharing.',
                opponent='AB_FULL: depth=2, prunning=False, value_fn=base; F: base ValueFunction.',
                seedPolicy='New independent games; no outcome or board selection; balance only initial seats.',
                invalidGameRule='Any adapter error or unfinished game halts new submissions; no selective replacement.',
                stoppingRule=f'Fixed {TOTAL_GAMES} games; no stopping based on favorable interim win rates.',
                hashes=source_hashes(), python=platform.python_version(), node=os.popen('node --version').read().strip(),
                pythonHashSeed=os.environ.get('PYTHONHASHSEED'),
                dependencies={x: version(x) for x in ['catanatron','networkx','click','rich']},
                productionUpdated=False)
    write_json(out/'plan.json', plan)
    write_json(out/'status.json', dict(status='prepared', completed=0, planned=TOTAL_GAMES))
    return plan


def status(out):
    plan = json.loads((out/'plan.json').read_text())
    rows = load_rows(out)
    live = json.loads((out/'status.json').read_text())
    live.update(completed=sum(r['status']=='completed' for r in rows),
                errors=sum(r['status']!='completed' for r in rows), planned=plan['games'])
    print(json.dumps(live, indent=2))


def run(out, workers):
    if os.environ.get('PYTHONHASHSEED') != '0':
        raise RuntimeError('Start with PYTHONHASHSEED=0 for reproducible set iteration.')
    plan = json.loads((out/'plan.json').read_text()) if out.exists() else prepare(out)
    if plan['hashes'] != source_hashes():
        raise RuntimeError('Source hash mismatch; do not resume with changed policy/adapter.')
    rows = load_rows(out)
    if any(r['status']!='completed' for r in rows):
        raise RuntimeError('Prior invalid game: audit and create a new protocol, do not selectively replace it.')
    ids = {r['id'] for r in rows}
    assert len(ids)==len(rows)
    tasks = [tuple(t[:-1])+(str(out),) for t in plan['tasks'] if t[0] not in ids]
    if not tasks:
        status(out)
        return
    lock = out/'RUNNING'
    try:
        fd = os.open(lock, os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:
        raise RuntimeError('RUNNING lock exists; check saved PID before removing a stale lock.')
    os.write(fd, str(os.getpid()).encode());os.close(fd)
    stop = False
    def request_stop(*_):
        nonlocal stop
        stop = True
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    started = time.monotonic()
    initial = len(rows)
    pool = concurrent.futures.ProcessPoolExecutor(max_workers=workers)
    pending = {}
    iterator = iter(tasks)
    def state(label):
        elapsed = time.monotonic()-started
        count = len(rows)-initial
        rate = count/max(.001,elapsed)
        return dict(status=label, completed=sum(r['status']=='completed' for r in rows),
                    planned=TOTAL_GAMES, errors=sum(r['status']!='completed' for r in rows),
                    workers=workers, pid=os.getpid(), gamesPerSecond=round(rate,3),
                    etaMinutes=round((TOTAL_GAMES-len(rows))/rate/60,1) if rate else None,
                    updated=datetime.now(timezone.utc).isoformat(), productionUpdated=False)
    try:
        write_json(out/'status.json', state('running'))
        while True:
            stop = stop or (out/'STOP').exists()
            while not stop and len(pending)<workers:
                task = next(iterator, None)
                if task is None:break
                pending[pool.submit(play, task)] = task[0]
            if not pending:break
            done, _ = concurrent.futures.wait(pending, timeout=5,
                                              return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                pending.pop(future)
                row = future.result()
                rows.append(row)
                with (out/'results.jsonl').open('a') as f:
                    f.write(json.dumps(row)+'\n');f.flush()
                if row['status']!='completed':stop=True
            write_json(out/'summary.json', analyze(rows))
            write_json(out/'status.json', state('stopping' if stop else 'running'))
        label = 'completed' if len(rows)==TOTAL_GAMES and all(r['status']=='completed' for r in rows) else ('failed' if any(r['status']!='completed' for r in rows) else 'paused')
        write_json(out/'status.json', state(label))
        print(json.dumps(state(label)), flush=True)
    finally:
        pool.shutdown(wait=True)
        lock.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare','run','status','stop','resume'])
    parser.add_argument('--out', default=str(ROOT/'data/confirmation'))
    parser.add_argument('--workers', type=int, default=12)
    args = parser.parse_args()
    if args.workers<1:parser.error('positive worker count required')
    out = Path(args.out).resolve()
    if args.command=='prepare':prepare(out);status(out)
    elif args.command=='status':status(out)
    elif args.command=='stop':(out/'STOP').touch();status(out)
    else:
        if args.command=='resume':(out/'STOP').unlink(missing_ok=True)
        run(out,args.workers)


if __name__=='__main__':
    main()
