'use strict';
const fs=require('node:fs');
const {engine}=require('./runtime');
const {convertState,normalizeActions,setMap}=require('./conversion');
const generation=process.argv[2]||'gen1';
if(!['gen0','gen1','gen2'].includes(generation))throw Error('Unknown generation');
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
  let m;
  try{
    m=JSON.parse(line);
    if(m.type==='hello')return process.stdout.write(JSON.stringify({protocol_version:1,name:'production-'+generation,observe:false})+'\n');
    if(m.type==='before'){setMap(m.state.map);engine.seed(m.policy_seed);return;}
    if(m.type!=='decide')return;
    const begin=performance.now(),state=convertState(m);
    // Count actual dice rolls, not turns (knights before rolling are separate).
    state.rollCount=m.state.action_records.filter(r=>r[0][1]==='ROLL').length;
    engine.load(state,generation);
    const actions=normalizeActions(m.playable_actions,state),result=engine.pick(actions);
    process.stdout.write(JSON.stringify({action:m.playable_actions[result.index],ms:performance.now()-begin,phase:state.phase,generation,roadResolutionAdapted:result.roadResolutionAdapted})+'\n');
  }catch(error){
    fs.writeFileSync(process.env.ARENA_ERROR_FILE||'/tmp/catan-arena-error.json',JSON.stringify({message:m,error:error.stack},null,2));
    process.stdout.write(JSON.stringify({error:error.stack})+'\n');
  }
});
