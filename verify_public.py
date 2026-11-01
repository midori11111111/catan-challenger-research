"""Validate public bridge, including physical road counts and every setup seat."""
import json
from pathlib import Path
import random
import subprocess

from catanatron import Game, RandomPlayer
from catanatron.protocol import decide_message
from catanatron.serialization import state_to_json
from run import ROOT, COLORS, belief_game
from verify import verify as verify_original


def verify():
    verify_original()
    maps = []
    for seed in range(12):
        game = Game([RandomPlayer(c) for c in COLORS], seed=110031+seed)
        item = {'map': state_to_json(game)['map'], 'snapshots': []}
        for step in range(16):
            color = game.state.current_color()
            item['snapshots'].append({'step': step//2, 'message': decide_message(game,color)})
            game.play_tick()
        maps.append(item)
    js = r'''
const fs=require('fs'),assert=require('assert');
const {engine}=require('./runtime');
const {setMap,convertState,normalizeActions}=require('./conversion');
const maps=JSON.parse(fs.readFileSync(0,'utf8'));
let checked=0;
for(const item of maps){
 setMap(item.map);
 for(const x of item.snapshots){
  const m=x.message,s=convertState(m);
  assert.strictEqual(s.setup.step,x.step);
  assert.strictEqual(s.setup.queue[s.setup.step],s.currentSeat);
  assert.strictEqual(s.colors[s.currentSeat-1],m.color);
  assert.strictEqual(Object.values(s.placements).reduce((n,p)=>n+p.roads.length,0),x.step);
  const h=s.hands[s.currentSeat],ps=m.state.player_state,own=s.currentSeat-1;
  for(const r of ['wood','brick','sheep','wheat','ore'])assert.strictEqual(h[r],ps[`P${own}_${r.toUpperCase()}_IN_HAND`]);
  engine.seed(8821+checked);engine.load(s,'gen1');
  const choice=engine.pick(normalizeActions(m.playable_actions,s));
  assert(m.playable_actions[choice.index]);checked++;
 }
}
const checks=[];
for(const name of ['road-before-win','road-card-unavailable']){
 const f=JSON.parse(fs.readFileSync(`fixtures/${name}.json`,'utf8')),m=f.message;
 setMap(f.map);const s=convertState(m);
 s.rollCount=m.state.action_records.filter(r=>r[0][1]==='ROLL').length;
 engine.seed(123);engine.load(s,'gen1');const choice=engine.pick(normalizeActions(m.playable_actions,s));
 const action=m.playable_actions[choice.index];assert(choice.roadResolutionAdapted);
 assert.strictEqual(action[1],name==='road-before-win'?'BUILD_ROAD':'MARITIME_TRADE');
 checks.push({fixture:name,action,passed:true});
}
console.log(JSON.stringify({setupSnapshots:checked,allEightSetupSeatsVerified:true,ownHandsExact:true,roadRegressions:checks}));
'''
    result = subprocess.run(['node','-e',js],input=json.dumps(maps),text=True,capture_output=True,cwd=ROOT)
    if result.returncode:
        raise RuntimeError(result.stderr)
    extra = json.loads(result.stdout)
    original = json.loads((ROOT/'verification.json').read_text())
    original.update(extra)
    (ROOT/'verification-public.json').write_text(json.dumps(original,indent=2)+'\n')
    print(json.dumps(original))


if __name__=='__main__':
    verify()
