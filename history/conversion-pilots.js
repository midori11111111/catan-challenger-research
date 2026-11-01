const {engine} = require("./runtime");
const RES = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"];
const RES_LOWER = Object.fromEntries(RES.map(x => [x, x.toLowerCase()]));
const DEV = {
  KNIGHT: "knight", VICTORY_POINT: "vp", ROAD_BUILDING: "roads",
  YEAR_OF_PLENTY: "plenty", MONOPOLY: "mono",
};
const DEV_ORIGINAL = { KNIGHT: 14, VICTORY_POINT: 5, ROAD_BUILDING: 2, YEAR_OF_PLENTY: 2, MONOPOLY: 2 };
const PIPS = n => n === 7 || n == null ? 0 : 6 - Math.abs(7 - n);

// Unique graph isomorphism for the shared 19-hex base board.
const CAT_NODE_TO_OUR = {
  0:30,1:31,2:32,3:20,4:19,5:18,6:42,7:43,8:44,9:33,10:34,11:22,12:21,13:10,
  14:7,15:6,16:15,17:1,18:0,19:26,20:29,21:14,22:39,23:41,24:51,25:52,26:53,
  27:45,28:46,29:35,30:36,31:37,32:23,33:24,34:11,35:12,36:13,37:8,38:9,39:2,
  40:5,41:3,42:4,43:17,44:16,45:28,46:25,47:27,48:40,49:38,50:49,51:47,52:48,53:50,
};
const OUR_NODE_TO_CAT = Object.fromEntries(Object.entries(CAT_NODE_TO_OUR).map(([a,b]) => [b, Number(a)]));
const OUR_EDGE_BY_NODES = new Map(engine.GEO.edges.map(e => [[e.a,e.b].sort((a,b)=>a-b).join(","), e.id]));
const CAT_EDGE_TO_OUR = new Map();
const OUR_EDGE_TO_CAT = new Map();
for (const [ca, oa] of Object.entries(CAT_NODE_TO_OUR)) {
  for (const [cb, ob] of Object.entries(CAT_NODE_TO_OUR)) {
    if (+ca >= +cb) continue;
    const eid = OUR_EDGE_BY_NODES.get([oa,ob].sort((a,b)=>a-b).join(","));
    if (eid == null) continue;
    const ck = [+ca,+cb].sort((a,b)=>a-b).join(",");
    CAT_EDGE_TO_OUR.set(ck, eid); OUR_EDGE_TO_CAT.set(eid, [+ca,+cb].sort((a,b)=>a-b));
  }
}
const CAT_PORT_DOCK = {0:[25,26],1:[28,29],2:[32,33],3:[35,36],4:[38,39],5:[40,44],6:[47,45],7:[48,49],8:[52,53]};

let staticMap = null;
let games = 0, decisions = 0, errors = 0, totalMs = 0, maxMs = 0;
let currentSeat = null;
const actionCounts = {};
const statsOut = process.env.CATANATRON_STATS_OUT || null;

function coordKey(c) { return c.join(","); }
function emptyHand() { return {wood:0,brick:0,sheep:0,wheat:0,ore:0}; }
function emptyDev() { return {knight:0,vp:0,roads:0,plenty:0,mono:0}; }
function colorSeat(colors, color) { const i=colors.indexOf(color); return i < 0 ? null : i + 1; }
function ourEdge(edge) { return CAT_EDGE_TO_OUR.get(edge.slice().sort((a,b)=>a-b).join(",")); }

function buildHexMaps(map) {
  const oursByAxial = new Map(engine.GEO.hexes.map(h => [`${h.q},${h.r}`, h.id]));
  const coordToOur = new Map(), catIdToOur = new Map();
  for (const t of map.tiles) {
    if (t.type !== "LAND") continue;
    const hid = oursByAxial.get(`${t.coordinate[0]},${t.coordinate[2]}`);
    if (hid == null) throw new Error(`unmapped land coordinate ${coordKey(t.coordinate)}`);
    coordToOur.set(coordKey(t.coordinate), hid); catIdToOur.set(t.id, hid);
  }
  return {coordToOur, catIdToOur};
}

function allocateMatrix(rowIds, rowTotals, colTotals, weights) {
  const rows=rowIds.length, cols=RES.length, x=Array.from({length:rows},(_,i)=>
    Array.from({length:cols},(_,j)=>Math.max(0.01,(weights[i]&&weights[i][j])||0.01)));
  for(let it=0;it<80;it++){
    for(let i=0;i<rows;i++){const z=x[i].reduce((a,b)=>a+b,0)||1;for(let j=0;j<cols;j++)x[i][j]*=rowTotals[i]/z;}
    for(let j=0;j<cols;j++){let z=0;for(let i=0;i<rows;i++)z+=x[i][j];z=z||1;for(let i=0;i<rows;i++)x[i][j]*=colTotals[j]/z;}
  }
  const ints=x.map(r=>r.map(Math.floor));
  const rr=rowTotals.map((n,i)=>n-ints[i].reduce((a,b)=>a+b,0));
  const cc=colTotals.map((n,j)=>n-ints.reduce((s,r)=>s+r[j],0));
  while(rr.some(n=>n>0)){
    let best=null;
    for(let i=0;i<rows;i++)if(rr[i]>0)for(let j=0;j<cols;j++)if(cc[j]>0){
      const f=x[i][j]-Math.floor(x[i][j]);if(!best||f>best.f)best={i,j,f};
    }
    if(!best)break; ints[best.i][best.j]++;rr[best.i]--;cc[best.j]--;
  }
  return {fractional:x, integers:ints};
}

function convertState(message) {
  const s=message.state, colors=s.colors, ownSeat=colorSeat(colors,message.color);
  const {coordToOur}=buildHexMaps(staticMap);
  const board={};
  for(const t of staticMap.tiles)if(t.type==="LAND"){
    const hid=coordToOur.get(coordKey(t.coordinate));
    board[hid]={resource:t.resource?RES_LOWER[t.resource]:"desert",number:t.number};
  }
  const ports={};
  for(const t of staticMap.tiles)if(t.type==="PORT"){
    const eid=ourEdge(CAT_PORT_DOCK[t.id]);
    if(eid==null)throw new Error(`unmapped port ${t.id}`);
    ports[eid]=t.resource?RES_LOWER[t.resource]:"3:1";
  }
  const placements={};for(let p=1;p<=4;p++)placements[p]={settlements:[],cities:[],roads:[]};
  for(const [nid,color,type] of s.board.buildings){const p=colorSeat(colors,color),v=CAT_NODE_TO_OUR[nid];
    if(p&&v!=null)placements[p][type==="CITY"?"cities":"settlements"].push(v);}
  for(const [edge,color] of s.board.roads){const p=colorSeat(colors,color),e=ourEdge(edge);if(p&&e!=null)placements[p].roads.push(e);}

  const ps=s.player_state, ownIndex=ownSeat-1, own=emptyHand();
  RES.forEach(r=>own[RES_LOWER[r]]=ps[`P${ownIndex}_${r}_IN_HAND`]||0);
  const hands={1:emptyHand(),2:emptyHand(),3:emptyHand(),4:emptyHand()};hands[ownSeat]=own;
  const others=[1,2,3,4].filter(p=>p!==ownSeat);
  const rowTotals=others.map(p=>ps[`P${p-1}_NUM_RESOURCES_IN_HAND`]||0);
  const colTotals=RES.map((r,j)=>Math.max(0,19-(s.resource_freqdeck[j]||0)-own[RES_LOWER[r]]));
  const weights=others.map(p=>RES.map(r=>{
    let w=0;for(const kind of ["settlements","cities"]){const mult=kind==="cities"?2:1;
      for(const v of placements[p][kind])for(const hid of engine.GEO.vertex_hexes[String(v)]||[]){const b=board[hid];if(b&&b.resource===RES_LOWER[r])w+=PIPS(b.number)*mult;}}
    return w+0.25;
  }));
  const alloc=allocateMatrix(others,rowTotals,colTotals,weights),pubBelief={};pubBelief[ownSeat]={...own};
  others.forEach((p,i)=>{RES.forEach((r,j)=>{hands[p][RES_LOWER[r]]=alloc.integers[i][j];});
    pubBelief[p]=Object.fromEntries(RES.map((r,j)=>[RES_LOWER[r],alloc.fractional[i][j]]));});

  const dev={deck:[],hands:{},bought:{},played:{}},army={};
  for(let p=1;p<=4;p++){dev.hands[p]=emptyDev();dev.bought[p]=emptyDev();dev.played[p]=emptyDev();
    for(const [up,lo] of Object.entries(DEV)){dev.played[p][lo]=ps[`P${p-1}_PLAYED_${up}`]||0;}army[p]=dev.played[p].knight;}
  for(const [up,n] of Object.entries(s.development_listdeck||{}))for(let i=0;i<n;i++)dev.deck.push(DEV[up]);
  for(const [up,lo] of Object.entries(DEV))dev.hands[ownSeat][lo]=ps[`P${ownIndex}_${up}_IN_HAND`]||0;
  const devRows=others.map(p=>ps[`P${p-1}_NUM_DEVELOPMENT_CARDS_IN_HAND`]||0);
  const devNames=Object.keys(DEV), unknownCols=devNames.map(up=>Math.max(0,DEV_ORIGINAL[up]-(s.development_listdeck[up]||0)
    -dev.hands[ownSeat][DEV[up]]-[1,2,3,4].reduce((z,p)=>z+dev.played[p][DEV[up]],0)));
  const devAlloc=allocateMatrix(others,devRows,unknownCols,others.map(()=>devNames.map(()=>1)));
  others.forEach((p,i)=>devNames.forEach((up,j)=>dev.hands[p][DEV[up]]=devAlloc.integers[i][j]));
  for(const [up,lo] of Object.entries(DEV)){
    const atStart=ps[`P${ownIndex}_${up}_OWNED_AT_START`];
    dev.bought[ownSeat][lo]=atStart?0:dev.hands[ownSeat][lo];
  }

  let lrHolder=null,laHolder=null;
  for(let p=1;p<=4;p++){if(ps[`P${p-1}_HAS_ROAD`])lrHolder=p;if(ps[`P${p-1}_HAS_ARMY`])laHolder=p;}
  const prompt=s.current_prompt,rolled=!!ps[`P${s.current_player_index}_HAS_ROLLED`];
  let phase=prompt==="BUILD_INITIAL_SETTLEMENT"||prompt==="BUILD_INITIAL_ROAD"?"setup":prompt==="DISCARD"?"discard":prompt==="MOVE_ROBBER"?"robber":prompt==="PLAY_TURN"?(rolled?"main":"roll"):"other";
  let setup=null;
  if(phase==="setup"){
    const queue=[1,2,3,4,4,3,2,1], roadsDone=s.board.roads.length;
    let lastSettle=null;for(let i=s.action_records.length-1;i>=0;i--){const a=s.action_records[i][0];if(a[0]===message.color&&a[1]==="BUILD_SETTLEMENT"){lastSettle=CAT_NODE_TO_OUR[a[2]];break;}}
    setup={queue,step:Math.min(7,roadsDone),phase:prompt==="BUILD_INITIAL_ROAD"?"road":"settle",lastSettle};
  }
  let dice=null;for(let i=s.action_records.length-1;i>=0;i--){const [a,result]=s.action_records[i];if(a[1]==="ROLL"&&result){dice=result[0]+result[1];break;}}
  return {board,ports,placements,hands,pubBelief,dev,army,currentSeat:s.current_player_index+1,
    vpToWin:s.game.vps_to_win,lr:{holder:lrHolder,len:lrHolder?(ps[`P${lrHolder-1}_LONGEST_ROAD_LENGTH`]||0):0},
    la:{holder:laHolder,count:laHolder?army[laHolder]:0},robber:coordToOur.get(coordKey(s.board.robber_coordinate)),
    dice,rolled,devPlayed:!!ps[`P${s.current_player_index}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`],
    freeRoads:s.free_roads_available||0,rollCount:s.num_turns||0,phase,setup,resume:s.is_moving_knight?(rolled?"main":"roll"):null,
    colors,coordToOur};
}

function normalizeActions(raw, converted) {
  const {colors,coordToOur}=converted;
  return raw.map((a,index)=>{
    const [color,type,value]=a,z={index,raw:a,type};
    if(type==="BUILD_SETTLEMENT"||type==="BUILD_CITY")z.vertex=CAT_NODE_TO_OUR[value];
    else if(type==="BUILD_ROAD")z.edge=ourEdge(value);
    else if(type==="MOVE_ROBBER"){z.hex=coordToOur.get(coordKey(value[0]));z.victim=value[1]?colorSeat(colors,value[1]):null;}
    else if(type==="DISCARD_RESOURCE"||type==="PLAY_MONOPOLY")z.resource=RES_LOWER[value];
    else if(type==="PLAY_YEAR_OF_PLENTY")z.resources=value.map(r=>RES_LOWER[r]);
    else if(type==="MARITIME_TRADE"){z.give=RES_LOWER[value.find(Boolean)];z.get=RES_LOWER[value[value.length-1]];}
    return z;
  });
}


module.exports={convertState,normalizeActions,setMap:m=>{staticMap=m;},CAT_NODE_TO_OUR};
