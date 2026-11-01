import json, random, subprocess
from pathlib import Path
from catanatron import Game, RandomPlayer
from catanatron.models.enums import RESOURCES, DEVELOPMENT_CARDS
from catanatron.serialization import state_from_json, state_to_json
from run import ROOT, COLORS, belief_game, PublicBot

def verify():
    players=[RandomPlayer(c) for c in COLORS]
    game=state_from_json(json.loads((ROOT/'smoke-02/game-0.json').read_text()),players)
    own=game.state.colors.index(COLORS[0]);others=[i for i in range(4) if i!=own]
    changed=game.copy();changed.state.player_state=dict(game.state.player_state)
    ps=changed.state.player_state
    # Preserve every public resource total, changing just who holds each card.
    swapped=False
    for a in others:
      for b in others:
       for r in RESOURCES:
        for q in RESOURCES:
         if a!=b and r!=q and ps[f'P{a}_{r}_IN_HAND'] and ps[f'P{b}_{q}_IN_HAND']:
          ps[f'P{a}_{r}_IN_HAND']-=1;ps[f'P{b}_{r}_IN_HAND']+=1
          ps[f'P{b}_{q}_IN_HAND']-=1;ps[f'P{a}_{q}_IN_HAND']+=1;swapped=True;break
        if swapped:break
       if swapped:break
      if swapped:break
    assert swapped
    changed.state.development_listdeck=list(reversed(game.state.development_listdeck))
    changed.seed=999;changed.random=random.Random(999);changed.state.random=changed.random
    assert state_to_json(belief_game(game,COLORS[0],732))==state_to_json(belief_game(changed,COLORS[0],732))
    # Change the unknown card composition as well as the deck order.
    game_dev=Game(players,seed=553)
    other=next(i for i,c in enumerate(game_dev.state.colors) if c!=COLORS[0])
    card=game_dev.state.development_listdeck.pop()
    game_dev.state.player_state[f'P{other}_{card}_IN_HAND']+=1
    changed=game_dev.copy();changed.state.player_state=dict(game_dev.state.player_state)
    changed.state.development_listdeck=list(game_dev.state.development_listdeck)
    others=[i for i,c in enumerate(game_dev.state.colors) if c!=COLORS[0]]
    swapdev=False
    for a in others:
      for k in DEVELOPMENT_CARDS:
       if changed.state.player_state[f'P{a}_{k}_IN_HAND']:
        for q in changed.state.development_listdeck:
         if q!=k:
          changed.state.player_state[f'P{a}_{k}_IN_HAND']-=1
          changed.state.player_state[f'P{a}_{q}_IN_HAND']+=1
          changed.state.development_listdeck.remove(q);changed.state.development_listdeck.append(k)
          swapdev=True;break
       if swapdev:break
      if swapdev:break
    assert swapdev
    assert state_to_json(belief_game(game_dev,COLORS[0],732))==state_to_json(belief_game(changed,COLORS[0],732))
    # Native search must never consume the real game's RNG (upstream copy shares it).
    fresh=Game(players,seed=283)
    before=state_to_json(fresh)
    native=PublicBot(fresh.state.current_color(),'AB',881)
    native.decide(fresh,fresh.playable_actions)
    assert state_to_json(fresh)==before
    data={'maps':[]}
    for seed in range(12):
      g=Game(players,seed=seed);m=g.state.board.map
      data['maps'].append({'map':state_to_json(g)['map'],
        'land':[{'coordinate':list(coord),'nodes':list(tile.nodes.values())} for coord,tile in m.land_tiles.items()],
        'ports':{k or '3:1':list(v) for k,v in m.port_nodes.items()}})
    js="""
const fs=require('fs'),assert=require('assert');
const {engine}=require('./runtime'),{CAT_NODE_TO_OUR}=require('./conversion');
const g=engine.GEO,x=JSON.parse(fs.readFileSync(0,'utf8'));
const docks={0:[25,26],1:[28,29],2:[32,33],3:[35,36],4:[38,39],5:[40,44],6:[47,45],7:[48,49],8:[52,53]};
for(const m of x.maps){
 for(const t of m.land){const h=g.hexes.find(h=>h.q===t.coordinate[0]&&h.r===t.coordinate[2]);
  const actual=Object.keys(g.vertex_hexes).map(Number).filter(v=>g.vertex_hexes[v].includes(h.id)).sort((a,b)=>a-b);
  assert.deepStrictEqual(t.nodes.map(n=>CAT_NODE_TO_OUR[n]).sort((a,b)=>a-b),actual);}
 const ports={};for(const t of m.map.tiles.filter(t=>t.type==='PORT')){const k=t.resource||'3:1';(ports[k]??=[]).push(...docks[t.id]);}
 for(const k of Object.keys(ports))assert.deepStrictEqual(ports[k].sort((a,b)=>a-b),m.ports[k].sort((a,b)=>a-b));
}
console.log('topology and all nine ports match on 12 boards');
"""
    p=subprocess.run(['node','-e',js],input=json.dumps(data),text=True,cwd=ROOT,capture_output=True)
    assert p.returncode==0,p.stderr
    result={'hiddenResourceSwapInvariant':True,'hiddenDevCompositionInvariant':True,'futureRngHidden':True,
      'nativeSearchDoesNotChangeRealStateOrDiceRng':True,'geometryBoards':12,'portsChecked':108}
    (ROOT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
if __name__=='__main__':verify()
