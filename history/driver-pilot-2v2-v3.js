// Executes frozen production decision functions in a disposable shadow state.
// Only actions already legal in the external engine may be returned.
render=()=>{};updateGamePanel=()=>{};toast=()=>{};snapshotTurn=()=>{};glog=()=>{};
function arenaLoad(s,generation='gen1'){
  board=s.board;ports=s.ports;numPlayers=4;resetPlacements();active=s.currentSeat;
  _msCache={};_supCache=null;_supKey=null;
  for(let p=1;p<=4;p++){
    for(const k of ['settlements','cities','roads'])placements[p][k]=new Set(s.placements[p][k]);
    seatAI[p]=generation==='gen0'?'strong':generation;
  }
  game={order:[1,2,3,4],idx:s.currentSeat-1,vpToWin:10,hands:s.hands,dev:s.dev,army:s.army,
    lr:s.lr,la:s.la,robber:s.robber,dice:s.dice,rolled:s.rolled,devPlayed:s.devPlayed,
    freeRoads:s.freeRoads,resume:s.resume,phase:s.phase,setup:s.setup,
    discardQueue:s.phase==='discard'?[{p:s.currentSeat,need:1}]:[],stealCands:[],ask:null,
    ai:new Set([1,2,3,4]),log:[],turns:[],diceCount:s.rollCount,rollCount:s.rollCount,
    _acts:[],_actionFrames:[],_actionLogMark:0,_researchCapture:[],pubBelief:s.pubBelief,pubHandDist:{}};
  for(let p=1;p<=4;p++)game.pubHandDist[p]={[RES5.map(r=>game.hands[p][r]).join(',')]:1};
  _applyVariant(s.currentSeat);
}
function arenaPick(actions){
  const p=cur(),find=(t,f=()=>true)=>actions.find(a=>a.type===t&&f(a));
  let selected=null,roadResolutionAdapted=false;
  if(game.phase==='setup'){
    if(game.setup.phase==='settle'){
      const B=computeBest(),v=setupLearnedPick(p,B,B.ranked[0]);
      selected=find('BUILD_SETTLEMENT',a=>a.vertex===v);
    }else{
      const rr=bestRoadFrom(game.setup.lastSettle,placements[p].settlements.size===2,p);
      selected=rr.length?find('BUILD_ROAD',a=>a.edge===rr[0].eid):null;
    }
  }else if(game.phase==='roll'){
    selected=_shouldPlayKnight(p)?find('PLAY_KNIGHT_CARD'):find('ROLL');
  }else if(game.phase==='discard'){
    _botDiscard();const d=game._researchCapture.find(a=>a.a==='discard');
    const res=d&&Object.keys(d.res).find(r=>d.res[r]>0);
    selected=find('DISCARD_RESOURCE',a=>a.resource===res);
  }else if(game.phase==='robber'){
    const ra=robberAdvice();const hid=ra?ra.hid:GEO.hexes.find(h=>h.id!==game.robber).id;
    const opts=actions.filter(a=>a.type==='MOVE_ROBBER'&&a.hex===hid);
    const victims=[...new Set(opts.map(a=>a.victim).filter(x=>x!=null))];
    const victim=victims.length?bestStealTarget(victims):null;
    selected=opts.find(a=>a.victim===victim);
  }else if(game.phase==='main'){
    const forcedRoads=game.freeRoads>0&&actions.every(a=>a.type==='BUILD_ROAD');
    // The site permits spending a Road Building card even with no legal road
    // remaining. Catanatron forbids it. Keep the card in hand, but unavailable
    // during this shadow decision; recompute eligibility on the next action.
    if(!forcedRoads&&!find('PLAY_ROAD_BUILDING')&&canPlay('roads')){
      game.dev.bought[p].roads=game.dev.hands[p].roads;
      roadResolutionAdapted=true;
    }
    const beforeRoads=forcedRoads?snapshotState():null;
    _botMain(p);_cleanupTurn(p);
    const records=game._researchCapture;
    let first=records.find(a=>!['win'].includes(a.a));
    // Catanatron resolves Road Building immediately; the website permits
    // exchanges/buildings between its free roads. Use the first road actually
    // chosen by production which is already legal, and count this rule adapter.
    if(forcedRoads&&first?.kind!=='road'){
      first=records.find(a=>a.a==='build'&&a.kind==='road'&&a.free&&find('BUILD_ROAD',x=>x.edge===a.id));
      // A shadow win can terminate production before any remaining free road.
      // Resolve the external engine's mandatory road with production's own
      // cleanup routine, starting from the real pre-action state, not the win.
      if(!first){
        restoreState(beforeRoads);_msCache={};_supCache=null;_supKey=null;
        _cleanupTurn(p);
        first=game._researchCapture.find(a=>a.a==='build'&&a.kind==='road'&&a.free&&find('BUILD_ROAD',x=>x.edge===a.id));
      }
      roadResolutionAdapted=true;
    }
    if(!first)selected=find('END_TURN');
    else if(first.a==='build')selected=find({city:'BUILD_CITY',settle:'BUILD_SETTLEMENT',road:'BUILD_ROAD'}[first.kind],a=>(first.kind==='road'?a.edge:a.vertex)===first.id);
    else if(first.a==='trade')selected=find('MARITIME_TRADE',a=>a.give===first.give&&a.get===first.get);
    else if(first.a==='devBuy')selected=find('BUY_DEVELOPMENT_CARD');
    else if(first.a==='devPlay'){
      const t={knight:'PLAY_KNIGHT_CARD',roads:'PLAY_ROAD_BUILDING',plenty:'PLAY_YEAR_OF_PLENTY',mono:'PLAY_MONOPOLY'}[first.card];
      if(first.card==='mono'){
        const chosen=records.find(a=>a.a==='mono');selected=chosen&&find(t,a=>a.resource===chosen.res);
      }else if(first.card==='plenty'){
        const wanted=records.filter(a=>a.a==='plenty').slice(0,2).map(a=>a.res).sort().join(',');
        selected=find(t,a=>a.resources.slice().sort().join(',')===wanted);
      }else selected=find(t);
    }
    if(!selected)throw Error('Production intent missing from legal actions: '+JSON.stringify({first,records,legal:actions}));
  }
  if(!selected)throw Error('No production action: '+JSON.stringify({phase:game.phase,actions}));
  return {index:selected.index,records:game._researchCapture,setup:setupLearnedInfo(p),roadResolutionAdapted};
}
module.exports.engine={GEO,load:arenaLoad,pick:arenaPick,seed(n){let x=n>>>0;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}};
