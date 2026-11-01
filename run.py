"""Small external pilot: immutable production policy; independent random games.

Both native opponents and OURS receive sampled hidden information derived only
from public information. The unmodified Catanatron engine owns all actual rules.
No LLM calls, training, or production changes. Errors invalidate a game.
"""
import argparse, collections, concurrent.futures, hashlib, json, math, os
from pathlib import Path
import random, select, subprocess, time, traceback
from catanatron import Game, Color
from catanatron.models.player import Player
from catanatron.models.enums import RESOURCES, DEVELOPMENT_CARDS, ActionRecord
from catanatron.models.decks import starting_devcard_bank
from catanatron.players.value import ValueFunctionPlayer
from catanatron.players.minimax import AlphaBetaPlayer
from catanatron.protocol import before_message, decide_message, parse_decide_reply
from catanatron.serialization import state_to_json, client_view
from belief import sample_development_hands

ROOT=Path(__file__).resolve().parent
COLORS=list(Color)[:4]

def belief_game(game, color, seed):
    # Treat client_view's exact remaining deck composition as SECRET too.
    view=client_view(state_to_json(game),color)
    rng=random.Random(seed)
    own=view['colors'].index(color.value)
    ps=view['player_state']; prefix=f'P{own}_'
    g=game.copy();s=g.state;s.player_state=dict(ps)
    g.seed=0;g.random=random.Random(rng.getrandbits(64));s.random=g.random
    resources=[]
    for j,r in enumerate(RESOURCES):
        n=19-view['resource_freqdeck'][j]-ps[prefix+r+'_IN_HAND']
        assert n>=0
        resources.extend([r]*n)
    rng.shuffle(resources)
    unseen=starting_devcard_bank()
    for k in DEVELOPMENT_CARDS:
        count=ps[prefix+k+'_IN_HAND']+sum(ps[f'P{i}_PLAYED_{k}'] for i in range(4))
        for _ in range(count):unseen.remove(k)
    others=[i for i in range(4) if i!=own]
    counts=[ps[f'P{i}_NUM_DEVELOPMENT_CARDS_IN_HAND'] for i in others]
    caps=[max(0,9-ps[f'P{i}_VICTORY_POINTS']) for i in others]
    sampled,deck=sample_development_hands(unseen,counts,caps,len(game.state.development_listdeck),rng)
    sampled=dict(zip(others,sampled))
    for i in range(4):
        if i==own:continue
        pre=f'P{i}_';n=ps[pre+'NUM_RESOURCES_IN_HAND']
        hand=resources[:n];del resources[:n]
        for r in RESOURCES:s.player_state[pre+r+'_IN_HAND']=hand.count(r)
        cards=sampled[i]
        for k in DEVELOPMENT_CARDS:
            s.player_state[pre+k+'_IN_HAND']=cards.count(k)
            if k!='VICTORY_POINT':s.player_state[pre+k+'_OWNED_AT_START']=bool(cards.count(k))
        s.player_state[pre+'ACTUAL_VICTORY_POINTS']=ps[pre+'VICTORY_POINTS']+cards.count('VICTORY_POINT')
        assert s.player_state[pre+'ACTUAL_VICTORY_POINTS']<10
    assert not resources
    s.development_listdeck=deck
    # Do not expose historical hidden card draws/steals to native search either.
    s.action_records=[ActionRecord(a,None if a.color!=color and a.action_type.value in ('BUY_DEVELOPMENT_CARD','MOVE_ROBBER') else result) for a,result in game.state.action_records]
    g.playable_actions=game.playable_actions
    return g

class PublicBot(Player):
    def __init__(self,color,kind,seed):
        super().__init__(color);self.rng=random.Random(seed);self.ms=[]
        self.bot=(AlphaBetaPlayer(color,AlphaBetaPlayer.Params(depth=2,prunning=True)) if kind=='AB' else ValueFunctionPlayer(color))
    def decide(self,game,actions):
        if len(actions)==1:return actions[0]
        projected=belief_game(game,self.color,self.rng.getrandbits(64))
        t=time.monotonic();action=self.bot.decide(projected,actions)
        self.ms.append((time.monotonic()-t)*1000)
        if action not in actions:raise RuntimeError('Native opponent returned illegal action')
        return action

class Ours(Player):
    def __init__(self,color,generation,seed,error_file):
        super().__init__(color);self.rng=random.Random(seed);self.ms=[];self.phases=collections.Counter()
        self.generation=generation;self.road_adaptations=0
        env=dict(os.environ,ARENA_ERROR_FILE=str(error_file))
        self.proc=subprocess.Popen(['node',str(ROOT/'bot.js'),generation],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1,env=env)
        self.send({'type':'hello'});self.receive()
    def send(self,m):self.proc.stdin.write(json.dumps(m)+'\n');self.proc.stdin.flush()
    def receive(self):
        spent=0.;last=time.monotonic()
        while True:
            ready=select.select([self.proc.stdout],[],[],1)[0]
            now=time.monotonic();elapsed=now-last;last=now
            # Long OS suspension/scheduling gaps are not active response wait.
            if elapsed<=5:spent+=elapsed
            if ready:break
            if self.proc.poll() is not None:raise RuntimeError('Production process exited')
            if spent>120:raise RuntimeError('Production decision timeout (120 active-wait seconds)')
        line=self.proc.stdout.readline()
        if not line:raise RuntimeError('Production process exited')
        x=json.loads(line)
        if 'error' in x:raise RuntimeError(x['error'])
        return x
    def before(self,game):
        m=before_message(belief_game(game,self.color,self.rng.getrandbits(64)),self.color)
        m['policy_seed']=self.rng.getrandbits(32);self.send(m)
    def decide(self,game,actions):
        # Send forced moves too: every mapping is checked, no fallback decisions.
        projected=belief_game(game,self.color,self.rng.getrandbits(64))
        self.send(decide_message(projected,self.color));reply=self.receive()
        self.ms.append(reply['ms']);self.phases[reply['phase']]+=1
        self.road_adaptations+=int(reply.get('roadResolutionAdapted',False))
        return parse_decide_reply(reply,actions)
    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:self.proc.kill();self.proc.wait()

def seed_for_seat(seed,seat):
    # Probe only the initial seating draw; do not cherry-pick boards or dice.
    while random.Random(seed).sample(COLORS,4).index(COLORS[0])!=seat:seed+=1
    return seed

def play(task):
    ident,generation,kind,seat,seed,outdir=task
    seed=seed_for_seat(seed,seat);start=time.monotonic();ours=None
    try:
        ours=Ours(COLORS[0],generation,seed^0xC4A771,Path(outdir)/f'error-{ident}.json')
        players=[ours]+[PublicBot(c,kind,seed^(i*7187)) for i,c in enumerate(COLORS[1:],1)]
        game=Game(players,seed=seed)
        assert game.state.colors.index(COLORS[0])==seat
        winner=game.play()
        if winner is None:raise RuntimeError('Censored unfinished game; not counted as defeat')
        rolls=sum(a.action_type.value=='ROLL' for a,_ in game.state.action_records)
        times=[t for p in players[1:] for t in p.ms]
        result=dict(id=ident,generation=generation,opponent=kind,seat=seat+1,seed=seed,
          status='completed',win=winner==COLORS[0],winner=winner.value,rolls=rolls,
          seconds=time.monotonic()-start,decisions=len(ours.ms),phases=dict(ours.phases),roadResolutionAdaptations=ours.road_adaptations,
          ownMs=sum(ours.ms)/max(1,len(ours.ms)),ownMaxMs=max(ours.ms,default=0),
          opponentMs=sum(times)/max(1,len(times)),opponentMaxMs=max(times,default=0),
          vp=[game.state.player_state[f'P{i}_ACTUAL_VICTORY_POINTS'] for i in range(4)])
        Path(outdir,f'game-{ident}.json').write_text(json.dumps(state_to_json(game)))
        return result
    except Exception:
        return dict(id=ident,generation=generation,opponent=kind,seat=seat+1,seed=seed,status='error',error=traceback.format_exc(),seconds=time.monotonic()-start)
    finally:
        if ours:ours.close()

def summary(rows):
    out=[]
    for gen,opp in sorted({(r['generation'],r['opponent']) for r in rows}):
        group=[r for r in rows if (r['generation'],r['opponent'])==(gen,opp)];good=[r for r in group if r['status']=='completed']
        n=len(good);w=sum(r['win'] for r in good)
        if not n:out.append(dict(generation=gen,opponent=opp,games=0,errors=len(group)));continue
        p=w/n;z=1.96;den=1+z*z/n;mid=(p+z*z/(2*n))/den;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
        out.append(dict(generation=gen,opponent=opp,games=n,wins=w,winRate=p,ci95=[mid-half,mid+half],errors=len(group)-n,
          averageRolls=sum(r['rolls'] for r in good)/n,seconds=sum(r['seconds'] for r in good),
          seats={str(s):{'games':sum(r['seat']==s for r in good),'wins':sum(r['seat']==s and r['win'] for r in good)} for s in range(1,5)}))
    return out

def main():
    p=argparse.ArgumentParser();p.add_argument('--per-group',type=int,default=16);p.add_argument('--workers',type=int,default=4)
    p.add_argument('--generations',default='gen1,gen2');p.add_argument('--opponents',default='AB,F');p.add_argument('--out',required=True);p.add_argument('--seed',type=int,default=731031)
    args=p.parse_args();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=False)
    tasks=[]
    for gi,gen in enumerate(args.generations.split(',')):
      for oi,opp in enumerate(args.opponents.split(',')):
       for j in range(args.per_group):tasks.append((len(tasks),gen,opp,j%4,args.seed+gi*100000+oi*10000+j*100,str(out)))
    Path(out,'plan.json').write_text(json.dumps({'args':vars(args),'tasks':tasks,'information':'public-only, independently sampled hidden hands/deck for ALL players','fallback':'none; any adapter error invalidates game','productionUpdated':False},indent=2))
    rows=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
      for result in pool.map(play,tasks):
        rows.append(result)
        with Path(out,'results.jsonl').open('a') as f:f.write(json.dumps(result)+'\n')
        Path(out,'summary.json').write_text(json.dumps(summary(rows),indent=2))
        print(json.dumps({k:result[k] for k in ('id','generation','opponent','status','seconds')},ensure_ascii=False),flush=True)
    print(json.dumps(summary(rows)),flush=True)
if __name__=='__main__':main()
