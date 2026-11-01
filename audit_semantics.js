// Read-only probes add state getters to an in-memory copy, never to match code.
'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert'),zlib=require('node:zlib'),readline=require('node:readline');
const {convertState,setMap}=require('./conversion');
const runtime=fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8');
const needle="fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'),mod.filename);";
assert(runtime.includes(needle));
const getter="\nmodule.exports.inspect=()=>Object.fromEntries([1,2,3,4].map(p=>[p,{roads:placements[p].roads.size,settlements:placements[p].settlements.size,cities:placements[p].cities.size,longestRoad:longestRoadOf(p),publicVp:buildingVpOf(p)+(game.lr.holder===p?2:0)+(game.la.holder===p?2:0)}]));";
const augmented=runtime.replace(needle,"fs.readFileSync(path.join(__dirname,'driver.js'),'utf8')+"+JSON.stringify(getter)+",mod.filename);");
const mod=new Module(path.join(__dirname,'audit-runtime.cjs'));
mod.filename=path.join(__dirname,'audit-runtime.cjs');mod.paths=Module._nodeModulePaths(__dirname);mod._compile(augmented,mod.filename);
const out=path.join(__dirname,'data/confirmation');
const rows=fs.readFileSync(path.join(out,'results.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.status==='completed');
const chosen=process.argv.includes('--all')?rows:rows.filter((r,i)=>i%Math.max(1,Math.floor(rows.length/80))===0).slice(0,80);
let players=0;const lengths=[];
function inspect(row,raw){
 // The full archive omits the count-only fields that client_view adds to the
 // decision protocol. Reconstruct those public counts before conversion.
 for(let i=0;i<4;i++){
  const pre=`P${i}_`;
  raw.player_state[pre+'NUM_RESOURCES_IN_HAND']=['WOOD','BRICK','SHEEP','WHEAT','ORE'].reduce((n,r)=>n+raw.player_state[pre+r+'_IN_HAND'],0);
  raw.player_state[pre+'NUM_DEVELOPMENT_CARDS_IN_HAND']=['KNIGHT','VICTORY_POINT','ROAD_BUILDING','YEAR_OF_PLENTY','MONOPOLY'].reduce((n,r)=>n+raw.player_state[pre+r+'_IN_HAND'],0);
 }
 raw.development_listdeck=Object.fromEntries([...new Set(raw.development_listdeck)].map(card=>[card,raw.development_listdeck.filter(x=>x===card).length]));
 setMap(raw.map);const color=raw.colors[raw.current_player_index];
 const state=convertState({state:raw,color,allowTerminal:true});mod.exports.engine.load(state,row.generation);
 for(let i=0;i<4;i++){
  assert.strictEqual(Object.values(state.hands[i+1]).reduce((n,x)=>n+x,0),raw.player_state[`P${i}_NUM_RESOURCES_IN_HAND`]);
  assert.strictEqual(Object.values(state.dev.hands[i+1]).reduce((n,x)=>n+x,0),raw.player_state[`P${i}_NUM_DEVELOPMENT_CARDS_IN_HAND`]);
 }
 for(const [j,r] of ['wood','brick','sheep','wheat','ore'].entries())assert.strictEqual([1,2,3,4].reduce((n,p)=>n+state.hands[p][r],0)+raw.resource_freqdeck[j],19);
 const view=mod.exports.inspect();
 for(let i=0;i<4;i++){
  const p=view[i+1],ps=raw.player_state,pre=`P${i}_`;
  assert.strictEqual(p.roads,15-ps[pre+'ROADS_AVAILABLE']);
  assert.strictEqual(p.settlements,5-ps[pre+'SETTLEMENTS_AVAILABLE']);
  assert.strictEqual(p.cities,4-ps[pre+'CITIES_AVAILABLE']);
  assert.strictEqual(p.publicVp,ps[pre+'VICTORY_POINTS']);
  const native=ps[pre+'LONGEST_ROAD_LENGTH'];
  if(p.longestRoad!==native)lengths.push({id:row.id,seat:i+1,exactTrail:p.longestRoad,nativeCached:native});
  players++;
 }
}
async function main(){
 if(chosen.length&&fs.existsSync(path.join(out,`game-${chosen[0].id}.json`))){
  for(const row of chosen)inspect(row,JSON.parse(fs.readFileSync(path.join(out,`game-${row.id}.json`),'utf8')));
 }else{
  const selected=new Map(chosen.map(r=>[r.id,r]));let found=0;
  const stream=readline.createInterface({input:fs.createReadStream(path.join(out,'games.jsonl.gz')).pipe(zlib.createGunzip()),crlfDelay:Infinity});
  for await(const line of stream){const item=JSON.parse(line),row=selected.get(item.id);if(row){inspect(row,item.game);found++;}}
  assert.strictEqual(found,chosen.length);
 }
 const result={pieceCountsAndPublicScoresMatch:true,reconstructedHandCountsAndBankTotalsMatch:true,games:chosen.length,playerViews:players,nativeVsExactRoadLengthDifferences:lengths};
 fs.writeFileSync(path.join(__dirname,'verification-semantics.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,nativeVsExactRoadLengthDifferences:lengths.length}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
