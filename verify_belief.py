"""Regression: an ongoing game must never become a phantom terminal root."""
import json,subprocess
from catanatron import RandomPlayer
from catanatron.serialization import state_from_json,state_to_json
from catanatron.protocol import decide_message
from run import ROOT,COLORS,belief_game


def main():
    fixture=json.loads((ROOT/'fixtures/nonterminal-belief-diagnostic.json').read_text())
    g=state_from_json(fixture['state'],[RandomPlayer(c) for c in COLORS])
    assert g.winning_color() is None
    initial=state_to_json(g);messages=[];count=0
    for color in COLORS:
        for seed in range(128):
            b=belief_game(g,color,seed)
            assert b.winning_color() is None
            for i,c in enumerate(b.state.colors):
                assert b.state.player_state[f'P{i}_ACTUAL_VICTORY_POINTS']<10
            if seed<16:messages.append(decide_message(b,color))
            count+=1
    assert state_to_json(g)==initial
    js=r'''
const fs=require('fs'),assert=require('assert'),{convertState,setMap}=require('./conversion');
const data=JSON.parse(fs.readFileSync(0,'utf8'));setMap(data.map);
for(const m of data.messages){const s=convertState(m);
 for(let i=0;i<4;i++)assert((m.state.player_state[`P${i}_VICTORY_POINTS`]+s.dev.hands[i+1].vp)<10);
}
console.log('nonterminal estimates preserved');
'''
    p=subprocess.run(['node','-e',js],cwd=ROOT,input=json.dumps({'map':initial['map'],'messages':messages}),capture_output=True,text=True)
    assert p.returncode==0,p.stderr
    result={'passed':True,'nativeBeliefSamples':count,'challengerBeliefSamples':len(messages),'phantomTerminalRoots':0,'realStateUnchanged':True,'regression':{k:v for k,v in fixture.items() if k!='state'}}
    (ROOT/'verification-belief.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))


if __name__=='__main__':main()
