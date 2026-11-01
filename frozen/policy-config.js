function isStrongSeatKind(kind){ return ["strong","invincible","gen1","gen2"].includes(kind); }
function _applyVariant(seat){
  const k = (seat!=null && typeof seatAI!=="undefined") ? seatAI[seat] : null;
  const human = (k==="challenger" || isStrongSeatKind(k)); // 各世代は最強AIと同じ本編設定
  // [2026-08-18] 最強AI: 強い人間の原理から輸入した配置3項をこの席にだけ効かせる。
  //  ETA(あと何ダイスで10点) / 希少資源の独占 / 相手配置の先読み。研究側の実測で標準AIに +10.0pt。
  //  重みは小さい値が正解（大きくすると悪化する）。他の席・他モードには一切影響しない。
  try{
    const isStrong = isStrongSeatKind(k);
    if(isStrong){
      const one=new Set([seat]);
      // 配置3項（ETA / 島の希少資源の独占 / 相手配置の先読み）
      ETA_W=0.02;   ETA_SEATS=one;
      SCARCE_W=15;  SCARCE_SEATS=one;
      LOOK_W=0.01;  LOOK_SEATS=one;
      // 確定10点探索（交換・建物・道・発展カード・賞の複合）
      ROAD_WIN_SEATS=one;
      ROAD_NEAR_WIN=false; // 確定10点だけ強制。8/9点の道賞は都市・カード等と競合させる
      FORCED_WIN_SEATS=one;
      // 手札圧縮: 8枚から。ただし次の自分の番までに都市が50%以上で建つ見込みならステイ
      TURN_CFG={}; TURN_CFG[seat]={dbt:7, cmp:7, holdP:0.5};
      // [2026-08-19] 道の行き先を経路ベースにし、目的地に「使える港」を加える（+6.0pt）
      ROAD_PATH_SEATS=one; ROAD_PORT_W=1;
      // game36＋固定盤面360試合で採用: 公開9点の最大脅威だけ賞防衛し、
      // 賞レース時の「港交換→発展購入」を通常候補として比較する。
      PRIZE_THREAT_SEATS=one; PRIZE_EXACT_SEATS=one;
      PRIZE_THREAT_MIN_VP_CFG={}; PRIZE_THREAT_MIN_VP_CFG[seat]=9;
      PRIZE_TRADE_DEV_SEATS=one;
      // 配置時の固定プランではなく、毎行動後に上位5本の10点経路を再計算。
      // 道賞/騎士賞は相手の公開VP・生産力・使用騎士・伏せ札枚数との競争で重みを変える。
      DYNAMIC_ROUTE_CFG={};DYNAMIC_ROUTE_CFG[seat]={topK:5,beta:.22,contestW:.75,holdW:.35,denyW:.18,cardRoadMin:.28,roadTargetMin:.28};
      // 無敵AIだけ本編をロールアウト探索で打つ
      ROLLOUT_SEATS = (k==="invincible") ? one : null;
      // 10万試合で採用した対象者先決め＋騎士賞見込み盗賊（最強AI/無敵AIのみ）
      ROBBER_RP_ARMY = true;
    }else{
      ETA_W=0; ETA_SEATS=null; SCARCE_W=0; SCARCE_SEATS=null; LOOK_W=0; LOOK_SEATS=null;
      ROAD_WIN_SEATS=null; ROAD_NEAR_WIN=true; FORCED_WIN_SEATS=null; TURN_CFG=null; ROLLOUT_SEATS=null;
      ROAD_PATH_SEATS=null; ROAD_PORT_W=0;
      PRIZE_THREAT_SEATS=null; PRIZE_EXACT_SEATS=null;
      PRIZE_THREAT_MIN_VP_CFG=null; PRIZE_TRADE_DEV_SEATS=null;
      DYNAMIC_ROUTE_CFG=null;
      ROBBER_RP_ARMY=false;
    }
  }catch(e){}
  try{ PORT_SYNERGY = human; }catch(e){}    // 港シナジー（配置スコア）
  try{ HP1_PORT     = human; }catch(e){}    // 蒸留の港項（cpureは蒸留を使うがHP1はoff=純自己対戦）
  try{ ROBBER_DELAY = human; }catch(e){}    // 遅延盗賊（本編）
  try{ HUMAN_SETUP  = human; }catch(e){}    // 参考フラグ（配置分岐は上でseatAIを直接判定）
}