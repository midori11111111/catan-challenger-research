/* ============================================================
   app.js — 新レイアウトのUI・機能。engine.js の後に読み込む。
   updateGamePanel / updateStats / updateTilePicker / aiStep / aiMaybeGo /
   aiDelay / glog / toast / showReplayTurn / buildTradeSelects を「後勝ち」で
   再定義してエンジンの版を上書きする。ゲームロジックは無改変。
   追加: 1画面レイアウト / PC・スマホ切替 / 日本語・英語 i18n。
   ============================================================ */
(function(){ "use strict"; })();

const RES_COL = { wood:"var(--wood)", brick:"var(--brick)", sheep:"var(--sheep)", wheat:"var(--wheat)", ore:"var(--ore)" };
const $ = (id)=>document.getElementById(id);

/* ============================================================
   i18n
   ============================================================ */
let LANG = "ja";
const I18N = {
  ja:{
    brand_title:"カタン 挑戦者AI 対局", brand_sub:"あなた 対 AI3人",
    speed_label:"AI速度", eval_word:"AI評価値",
    replay_btn:"棋譜確認", export_btn:"棋譜書き出し", load_btn:"棋譜読込", new_btn:"新規対局", tune_btn:"⚙ AI調整",
    composer_btn:"盤面を自作する", cp_title:"盤面＆配置エディタ", cp_shuffle:"ランダム盤面", cp_export:"棋譜書き出し", cp_exit:"終了",
    cp_hint:"選んだプレイヤーで 頂点=開拓地 / 辺=道 を置く（もう一度クリックで削除）。相手の割り込みも自分で置ける。全席ぶん置いたら「棋譜書き出し」。",
    toast_composed:"盤面/配置を棋譜に書き出しました", toast_composer_empty:"盤面も配置もまだ空です",
    pause_title:"一時停止", play_title:"再生",
    mode_pc:"PC表示", mode_mobile:"スマホ表示",
    setup_title:"対局の設定",
    research_notice:"AI改善のため、表示名・認証情報を含まない対局手順とコメントを匿名で保存します。",
    setup_lead:"各席の担当を選んで対局。gen1・gen2は自己対戦で学習した初期配置モデルです。<br>100%・50%は配置判断での学習モデルの比重で、勝率ではありません。本編は最強AIと共通。無敵AIは探索を追加します。",
    your_seat:"あなたの席", you_operate:"あなた（この席を操作）",
    strong_full:"最強AI（gen0）", ai_strong:"最強AI（gen0）", gen1_full:"gen1 AI（配置学習100%）", ai_gen1:"gen1 AI", gen2_full:"gen2 AI（配置学習50%）", ai_gen2:"gen2 AI", invincible_full:"無敵AI（探索つき・重い）", ai_invincible:"無敵AI", challenger_full:"人間模倣（強者データ由来）", cpure_full:"挑戦者(関与なし)", standard_full:"現行AI（学習モデル・標準）",
    shuffle_btn:"盤面シャッフル", start_btn:"対局開始",
    start_lang:"言語", start_mode:"画面", lang_ja:"日本語", lang_en:"English",
    ai_challenger:"人間模倣", ai_cpure:"挑戦者(関与なし)", ai_standard:"現行AI", ai_you:"あなた",
    tab_status:"状況", tab_eval:"AI評価値", tab_log:"ログ", tab_bank:"銀行", tab_opp:"相手",
    log_title:"ログ", bank_title:"銀行", bank_left:"残りカード", bank_deck:"発展カード山札",
    devplayed_title:"使用済み", tally_knight:"騎士", tally_road:"街道", tally_plenty:"収穫", tally_mono:"独占",
    opp_title:"相手プレイヤー", opp_sub:"手札は枚数のみ公開",
    hand_title:"あなたの手札",
    act_roll:"🎲 サイコロを振る", act_buydev:"発展カードを買う", act_knight:"騎士", act_roads:"街道建設",
    act_plenty:"収穫", act_mono:"独占", act_trade:"交易", act_endturn:"ターン終了",
    res_wood:"木", res_brick:"レンガ", res_sheep:"羊", res_wheat:"麦", res_ore:"鉄",
    lbl_hand:"手札", lbl_dev:"発展", lbl_knights:"騎士", lbl_road:"最長路", lbl_vp:"VP",
    dev_knight:"騎士", dev_roads:"街道建設", dev_plenty:"収穫", dev_mono:"独占", dev_vp:"勝利点",
    kind_settlement:"開拓地", kind_road:"道",
    dev_deck_chip:a=>`発展カード山札 ${a.n}枚`, vpcards:a=>`勝利点カード×${a.n}`,
    st_setup:a=>`初期配置 ${a.step}/${a.total}：${a.seat} が${a.kind}を置く`,
    st_roll:a=>`${a.seat} の番：サイコロを振る`,
    st_discard:a=>`出目7！ ${a.seat} が ${a.n}枚 捨てる`,
    st_robber:a=>`${a.seat}：盗賊を動かすタイルをクリック（★=おすすめ）`,
    st_steal:a=>`${a.seat}：奪う相手を選ぶ`,
    st_main:a=>`${a.seat} の番（出目 ${a.dice}）：建設・交易・カード → ターン終了`,
    st_over:"🏆 対局終了",
    win_tag:a=>`P${a.p} ${a.name} の勝利`,
    badge_turn:a=>`手番: P${a.p} ${a.name}`,
    badge_lr:a=>`最長交易路 P${a.p}（${a.len}）`,
    badge_la:a=>`最大騎士力 P${a.p}（${a.n}）`,
    pr_plenty:a=>`<b>収穫</b>：もらう資源を選ぶ（あと ${a.n}）`,
    pr_mono:`<b>独占</b>：全員から奪う資源を選ぶ`,
    pr_steal:`<b>奪う相手</b>：`, pr_steal_btn:a=>`P${a.p}（${a.n}枚）`,
    pr_discard:a=>`⚠️ 手札が多すぎます。<b>あと ${a.n}枚</b> 上の手札カードをクリックして捨ててください。`,
    pr_robber:`🦹 盤面のタイルをクリックして盗賊を移動（★=おすすめ）。`,
    pr_setup_settle:`📍 あなたの番：<b>開拓地</b>を置く頂点をクリック（評価値ONで候補を盤面に表示）。`,
    pr_setup_road:`🛤 続けて、置いた開拓地に接する<b>道</b>をクリック（金色の候補）。`,
    pr_main:`🏗 あなたの番：頂点=開拓地/都市、辺=道。交易・発展カードも可能。終わったら「ターン終了」。`,
    eval_title:"AI評価値",
    eval_off_hint:`AI評価値はOFFです（上のボタンでONにできます）。`,
    eval_wait_hint:`あなたの手番で、打てる手を点数付きで表示します。`,
    eval_plan:a=>`🎯 目標プラン: <b>${a.label}</b>${a.ore?'（鉄不足→木・土寄せ）':''}　<span class="hint">基準=「ターン終了」を ±0 とした相対点</span>`,
    eval_noplan:`候補手を評価値順に表示（+ が良い手／基準=「ターン終了」= ±0）`,
    eval_seat:a=>`<span class="hint" style="display:block;margin-bottom:5px">▶ <b style="color:${PCOLORS[a.seat-1]}">P${a.seat}</b>（AI）の評価値</span>`,
    eval_place_note:`📍 初期配置の候補地（盤面の <b>①②③</b> と対応）。数値は最弱候補を基準にした相対点。`,
    eval_shortage:a=>`（資源不足${a.cost?': '+a.cost:''}）`,
    eval_cand:a=>`候補${a.mark} pip ${a.pip}／資源${a.div}種${a.port?'／港あり':''}`,
    eval_nocand:`候補がありません。`, eval_novtx:`置ける頂点がありません。`,
    ev_city:"都市化", ev_trade_city:"交換して今すぐ都市化", ev_settle:"開拓地を建てる",
    ev_trade_settle:"交換して今すぐ開拓地", ev_road:"道を伸ばす", ev_dev:"発展カードを買う",
    ev_trade_surplus:"余り資源を交換して終了", ev_endturn:"ターン終了（資源を温存）",
    rv_title:"リプレイ", rv_prev:"◀ 前", rv_auto:"▶ 自動", rv_stop:"⏸ 停止", rv_next:"次 ▶", rv_close:"閉じる",
    rv_count:a=>`${a.i} / ${a.n} コマ`, rv_h_seat:"席", rv_h_total:"計", rv_h_cards:"カード", rv_h_vp:"VP",
    rv_no_hands:"（この棋譜には手札の記録がありません）", rv_no_events:"（イベントなし）",
    toast_start:a=>`対局開始！ あなたは P${a.p} です`,
    toast_shuffle:"盤面をシャッフルしました（公式ルール準拠）",
    toast_pause:"AIを一時停止しました", toast_play:"再生します",
    toast_win:a=>`🏆 P${a.p} の勝利！「棋譜確認」で振り返り、「棋譜書き出し」で保存できます。`,
    toast_no_record:"棋譜がまだありません", toast_exported:"棋譜を game_record.json に書き出しました",
    toast_loaded:"棋譜を読み込みました（再生モード）", toast_load_err:"棋譜の読み込みに失敗しました（JSON形式を確認してください）",
    toast_robber:"盗賊を動かすタイルをクリック"
  },
  en:{
    brand_title:"Catan Challenger AI", brand_sub:"You vs 3 AIs",
    speed_label:"AI speed", eval_word:"AI eval",
    replay_btn:"Replay", export_btn:"Export record", load_btn:"Load record", new_btn:"New game", tune_btn:"⚙ AI Tuning",
    composer_btn:"Build board", cp_title:"Board & placement editor", cp_shuffle:"Random board", cp_export:"Export record", cp_exit:"Exit",
    cp_hint:"With the selected player: click a vertex = settlement, an edge = road (click again to remove). You place every seat yourself. Export when done.",
    toast_composed:"Board/placement exported to record", toast_composer_empty:"Board and placement are both empty",
    pause_title:"Pause", play_title:"Play",
    mode_pc:"PC view", mode_mobile:"Mobile view",
    setup_title:"Game setup",
    research_notice:"To improve the AI, game actions and comments are stored anonymously without display names or authentication data.",
    setup_lead:"Choose each seat, then start. gen1 and gen2 use self-play-trained setup models.<br>100% and 50% are learned setup ranking weights, not win rates. Main-game play is shared with Strongest AI. Invincible adds search.",
    your_seat:"Your seat", you_operate:"You (you play this seat)",
    strong_full:"Strongest AI (gen0)", ai_strong:"Strongest (gen0)", gen1_full:"gen1 AI (100% learned setup)", ai_gen1:"gen1 AI", gen2_full:"gen2 AI (50% learned setup)", ai_gen2:"gen2 AI", invincible_full:"Invincible AI (with search, slow)", ai_invincible:"Invincible", challenger_full:"Human-imitation (from strong-player data)", cpure_full:"Challenger (no-human data)", standard_full:"Current AI (learning model)",
    shuffle_btn:"Shuffle board", start_btn:"Start game",
    start_lang:"Language", start_mode:"Display", lang_ja:"日本語", lang_en:"English",
    ai_challenger:"Human-imitation", ai_cpure:"Challenger (raw)", ai_standard:"Current AI", ai_you:"You",
    tab_status:"Status", tab_eval:"AI eval", tab_log:"Log", tab_bank:"Bank", tab_opp:"Opponents",
    log_title:"Log", bank_title:"Bank", bank_left:"Cards left", bank_deck:"Dev deck",
    devplayed_title:"Played", tally_knight:"Knights", tally_road:"Roads", tally_plenty:"Plenty", tally_mono:"Mono",
    opp_title:"Opponents", opp_sub:"Hand size only",
    hand_title:"Your hand",
    act_roll:"🎲 Roll dice", act_buydev:"Buy dev card", act_knight:"Knight", act_roads:"Road building",
    act_plenty:"Year of plenty", act_mono:"Monopoly", act_trade:"Trade", act_endturn:"End turn",
    res_wood:"Wood", res_brick:"Brick", res_sheep:"Sheep", res_wheat:"Wheat", res_ore:"Ore",
    lbl_hand:"Hand", lbl_dev:"Dev", lbl_knights:"Knights", lbl_road:"Longest", lbl_vp:"VP",
    dev_knight:"Knight", dev_roads:"Road building", dev_plenty:"Year of plenty", dev_mono:"Monopoly", dev_vp:"VP card",
    kind_settlement:"settlement", kind_road:"road",
    dev_deck_chip:a=>`Dev deck: ${a.n}`, vpcards:a=>`VP cards ×${a.n}`,
    st_setup:a=>`Setup ${a.step}/${a.total}: ${a.seat} places a ${a.kind}`,
    st_roll:a=>`${a.seat}'s turn: roll the dice`,
    st_discard:a=>`Rolled 7! ${a.seat} discards ${a.n}`,
    st_robber:a=>`${a.seat}: click a tile to move the robber (★=suggested)`,
    st_steal:a=>`${a.seat}: choose whom to rob`,
    st_main:a=>`${a.seat}'s turn (roll ${a.dice}): build / trade / cards → end turn`,
    st_over:"🏆 Game over",
    win_tag:a=>`P${a.p} ${a.name} wins`,
    badge_turn:a=>`Turn: P${a.p} ${a.name}`,
    badge_lr:a=>`Longest road P${a.p} (${a.len})`,
    badge_la:a=>`Largest army P${a.p} (${a.n})`,
    pr_plenty:a=>`<b>Year of plenty</b>: choose a resource (${a.n} left)`,
    pr_mono:`<b>Monopoly</b>: choose the resource to take from everyone`,
    pr_steal:`<b>Rob whom</b>: `, pr_steal_btn:a=>`P${a.p} (${a.n})`,
    pr_discard:a=>`⚠️ Too many cards. <b>Discard ${a.n}</b> by clicking your hand cards above.`,
    pr_robber:`🦹 Click a board tile to move the robber (★=suggested).`,
    pr_setup_settle:`📍 Your turn: click a vertex to place a <b>settlement</b> (turn AI eval on to see suggestions).`,
    pr_setup_road:`🛤 Now click a <b>road</b> next to it (gold candidates).`,
    pr_main:`🏗 Your turn: vertex = settlement/city, edge = road. Trade & dev cards too. Then "End turn".`,
    eval_title:"AI eval",
    eval_off_hint:`AI eval is OFF (turn it on with the button above).`,
    eval_wait_hint:`On your turn, shows your possible moves with scores.`,
    eval_plan:a=>`🎯 Target plan: <b>${a.label}</b>${a.ore?' (low ore → wood/brick)':''}　<span class="hint">relative to "End turn" = ±0</span>`,
    eval_noplan:`Moves ranked by score (+ = better / baseline "End turn" = ±0)`,
    eval_seat:a=>`<span class="hint" style="display:block;margin-bottom:5px">▶ <b style="color:${PCOLORS[a.seat-1]}">P${a.seat}</b> (AI) eval</span>`,
    eval_place_note:`📍 Setup spots (match <b>①②③</b> on the board). Values are relative to the weakest spot.`,
    eval_shortage:a=>`(need${a.cost?': '+a.cost:''})`,
    eval_cand:a=>`Spot ${a.mark} · pip ${a.pip} · ${a.div} res${a.port?' · port':''}`,
    eval_nocand:`No candidates.`, eval_novtx:`No available vertices.`,
    ev_city:"Upgrade to city", ev_trade_city:"Trade surplus → upgrade to city", ev_settle:"Build settlement",
    ev_trade_settle:"Trade surplus → build settlement", ev_road:"Extend road", ev_dev:"Buy dev card",
    ev_trade_surplus:"Trade surplus & end", ev_endturn:"End turn (keep resources)",
    rv_title:"Replay", rv_prev:"◀ Prev", rv_auto:"▶ Auto", rv_stop:"⏸ Stop", rv_next:"Next ▶", rv_close:"Close",
    rv_count:a=>`${a.i} / ${a.n}`, rv_h_seat:"Seat", rv_h_total:"Total", rv_h_cards:"Cards", rv_h_vp:"VP",
    rv_no_hands:"(no hand data in this record)", rv_no_events:"(no events)",
    toast_start:a=>`Game started! You are P${a.p}`,
    toast_shuffle:"Board shuffled (official rules)",
    toast_pause:"AI paused", toast_play:"Playing",
    toast_win:a=>`🏆 P${a.p} wins! Use "Replay" to review and "Export record" to save.`,
    toast_no_record:"No record yet", toast_exported:"Exported to game_record.json",
    toast_loaded:"Record loaded (replay mode)", toast_load_err:"Failed to load record (check the JSON)",
    toast_robber:"Click a tile to move the robber"
  }
};
function t(k, a){
  const d = I18N[LANG] || I18N.ja;
  let v = d[k]; if(v==null) v = I18N.ja[k]; if(v==null) return k;
  return (typeof v==="function") ? v(a||{}) : v;
}
function resName(r){ return t("res_"+r); }
function isStrongSeatKind(kind){ return ["strong","invincible","gen1","gen2"].includes(kind); }
function seatAiName(p){ const x=seatAI[p]; return x==="gen1"?t("ai_gen1"):x==="gen2"?t("ai_gen2"):x==="invincible"?t("ai_invincible"):x==="strong"?t("ai_strong"):x==="challenger"?t("ai_challenger"):x==="cpure"?t("ai_cpure"):x==="puremodel"?t("ai_standard"):t("ai_you"); }

// 日本語ログ/トースト文字列を英語に（エンジンが生成する文言用のベストエフォート変換）
function _devEn(c){ return String(c).replace(/騎士/g,"Knight").replace(/勝利点/g,"VP").replace(/街道建設/g,"Road building").replace(/収穫/g,"Year of plenty").replace(/独占/g,"Monopoly"); }
function _resEn(s){ return String(s).replace(/小麦/g,"wheat").replace(/鉱石/g,"ore").replace(/レンガ/g,"brick").replace(/羊/g,"sheep").replace(/木/g,"wood").replace(/麦/g,"wheat").replace(/鉄/g,"ore"); }
function jaToEn(s){
  if(s==null) return s;
  let x=String(s);
  const pairs=[
    ["（盗賊！）"," (robber!)"],
    ["盗賊を動かすタイルをクリック","Click a tile to move the robber"],
    ["盗賊を移動","moved the robber"],
    ["発展カードを購入","bought a dev card"],
    ["発展カードは売り切れ","No dev cards left"],
    ["資源が足りません","Not enough resources"],
    ["資源なし","no resources"],
    ["資源: ","Gains: "], ["資源:","Gains:"],
    ["(銀行切れ)"," (bank empty)"],
    ["🏛 都市化","🏛 upgraded to city"], ["都市化！","Upgraded to city!"], ["都市化","upgraded to city"],
    ["🏠 開拓地を建設","🏠 built a settlement"], ["開拓地を建設！","Built a settlement!"], ["開拓地を建設","built a settlement"],
    ["🛤 道を建設（無料）","🛤 built a road (free)"], ["🛤 道を建設","🛤 built a road"],
    ["道を建設！","Built a road!"], ["道を建設","built a road"],
    ["が開拓地を置いた"," placed a settlement"], ["が道を置いた"," placed a road"],
    ["が開拓地"," · settlement"], ["が道"," · road"],
    ["初期配置","Setup"], ["ターン ","Turn "], ["／","/"],
    ["対局開始！","Game started! "], ["あなたは P","You are P"], ["です",""],
    ["盤面をシャッフルしました（公式ルール準拠）","Board shuffled (official rules)"],
    ["AIを一時停止しました","AI paused"], ["再生します","Playing"], ["再生","Play"],
    ["出目","Roll "], ["（このターンの動きなし）","(no action this turn)"], ["（イベントなし）","(no events)"],
  ];
  for(const [a,b] of pairs) x=x.split(a).join(b);
  x=x.replace(/P(\d+) から1枚奪った/g,"stole 1 from P$1");
  x=x.split(" が ").join(" ");
  x=x.replace(/発展カード「(.+?)」を使用/g,(m,c)=>`played dev card ${_devEn(c)}`);
  x=x.replace(/独占で (.+?) を(\d+)枚回収/g,(m,r,n)=>`monopoly: took ${n} ${_resEn(r)}`);
  x=x.replace(/独占: (.+?)を(\d+)枚集めた/g,(m,r,n)=>`Monopoly: collected ${n} ${_resEn(r)}`);
  x=x.replace(/P(\d+) が (\d+)点で勝利/g,"P$1 won with $2 points");
  x=x.replace(/(\d+)枚/g,"$1");
  x=_resEn(x); x=_devEn(x);
  return x;
}

/* ============================================================
   UI 状態
   ============================================================ */
// 各席の担当: "human" / "cpure"(挑戦者=関与なし) / "challenger"(人間模倣) / "puremodel"(現行AI)
// 既定は「あなた vs 3変種を1席ずつ」＝3種を直接見比べられる構成（開始画面で自由に変更可）
let seatKind = {1:"strong",2:"strong",3:"human",4:"strong"};   // 既定＝あなたが3番手(P3) vs 最強AI3人
let humanSeat = 3;   // 先頭の人間席（開始時に導出。単一参照が要る箇所の既定フォーカス用）
let seatAI = {1:"strong",2:"strong",3:"human",4:"strong"};
let paused = false;
let evalOn = false;
let winMeterOn = false;
let winMeterEstimate = null;
let winMeterEstimateJob = 0;
let winMeterEstimateTimer = null;
let gameNote = "";   // 対局全体へのコメント（棋譜に保存）
let aiSpeedSec = 1.0;
let aiTimer = null;
let _rerendering = false;
let rvPlayTimer = null;
let uiMode = "pc";
let mobileTab = "status";
let _overHandled = false;
let placementConfirmMode = false;
let GAME_PENDING_PLACEMENT = null;
try { placementConfirmMode = localStorage.getItem("catan_place_confirm") === "1"; } catch(e) {}

function clearPendingPlacement(renderNow){
  GAME_PENDING_PLACEMENT = null;
  if(renderNow!==false && game) render();
}
function placementPreview(){
  if(!placementConfirmMode || !GAME_PENDING_PLACEMENT || !game) return null;
  const a=GAME_PENDING_PLACEMENT, activeSeat=(game.phase==="setup"&&game.setup)?Number(game.setup.queue[game.setup.step]):Number(cur());
  if(a.phase!==game.phase || a.seat!==activeSeat){ GAME_PENDING_PLACEMENT=null; return null; }
  return a;
}
function gamePlacementTap(type,id){
  if(!game || !placementConfirmMode) return false;
  const activeSeat=(game.phase==="setup"&&game.setup)?Number(game.setup.queue[game.setup.step]):Number(cur());
  const buildPhase = type==="vertex"
    ? ((game.phase==="setup"&&game.setup&&game.setup.phase==="settle") || game.phase==="main")
    : ((game.phase==="setup"&&game.setup&&game.setup.phase==="road") || game.phase==="main");
  if(!buildPhase) return false;
  if(!isHuman(activeSeat)){ toast(`現在はP${activeSeat}の操作待ちです`); return true; }
  let kind="road";
  if(type==="vertex"){
    const oc=occupantOf(id);
    kind=(game.phase==="main"&&oc&&oc.p===activeSeat&&oc.type==="settlement")?"city":"settlement";
  }
  const same=GAME_PENDING_PLACEMENT && GAME_PENDING_PLACEMENT.type===type && GAME_PENDING_PLACEMENT.id===Number(id)
    && GAME_PENDING_PLACEMENT.phase===game.phase && GAME_PENDING_PLACEMENT.seat===activeSeat;
  if(same){
    GAME_PENDING_PLACEMENT=null;
    if(type==="vertex") gameClickVertex(Number(id)); else gameClickEdge(Number(id));
    aiMaybeGo();
  }else{
    GAME_PENDING_PLACEMENT={type,id:Number(id),kind,seat:activeSeat,phase:game.phase};
    render();
    toast(`${kind==="road"?"道":kind==="city"?"都市":"家"}の仮置きです。同じ場所をもう一度押すと確定します`);
  }
  return true;
}
function updatePlacementModeButton(){
  const b=$("placementModeBtn"); if(!b)return;
  b.textContent=placementConfirmMode?"配置操作: 2回タップ":"配置操作: ワンタッチ";
  b.classList.toggle("on",placementConfirmMode);
}
function togglePlacementMode(){
  setPlacementConfirmMode(!placementConfirmMode,true);
}
function setPlacementConfirmMode(on,announce){
  placementConfirmMode=Boolean(on); clearPendingPlacement(false);
  try{ localStorage.setItem("catan_place_confirm",placementConfirmMode?"1":"0"); }catch(e){}
  updatePlacementModeButton(); if(game)render();
  if(announce) toast(placementConfirmMode?"家・都市・道は仮置き後、同じ場所をもう一度押して確定します":"家・都市・道をワンタッチで置きます");
  if(!game && typeof buildStartScreen==="function") buildStartScreen();
}

/* ============================================================
   エンジン関数の上書き（後勝ち）
   ============================================================ */
function updateStats(){}
function updateTilePicker(){}
function aiDelay(base){ return Math.max(0, Math.round(aiSpeedSec*1000)); }

// トースト（i18n）: 英語モードでは日本語をベストエフォート変換
function toast(msg){
  const el=$("toast"); if(!el) return;
  el.textContent = (LANG==="en") ? jaToEn(msg) : msg;
  el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1900);
}
// ログ（i18n）: game.log には生の日本語を保持し、表示だけ言語に合わせる
function glog(msg, player){
  if(!game) return;
  const p=player!=null ? Number(player) : cur();
  game.log.push({t:game.log.length, p, dice:game.dice, msg});
  appendLogLine(p, msg);
}
function appendLogLine(p, msg){
  const box=$("gameLog"); if(!box) return;
  const color=PCOLORS[(p||1)-1]||"#ccc";
  const div=document.createElement("div");
  div.innerHTML=`<span style="color:${color};font-weight:700">P${p}</span> ${LANG==="en"?jaToEn(msg):msg}`;
  box.appendChild(div); box.scrollTop=box.scrollHeight;
}
function rerenderLog(){
  const box=$("gameLog"); if(!box||!game||!game.log) return;
  box.innerHTML="";
  for(const l of game.log) appendLogLine(l.p, l.msg);
}
// 交易セレクト（i18n）
function buildTradeSelects(){
  for(const id of ["tradeGive","tradeGet"]){
    const s=$(id); if(!s) continue; const keep=s.value;
    s.innerHTML="";
    for(const r of RES5){ const o=document.createElement("option"); o.value=r; o.textContent=resName(r); s.appendChild(o); }
    if(keep) s.value=keep;
  }
}

function scheduleAI(base){ if(paused) return; clearTimeout(aiTimer); aiTimer=setTimeout(aiStep, aiDelay(base)); }

// 席別AI・一時停止対応の進行ループ
// 席の"変種"でグローバルの人間由来フラグを解決する。AI席は1手ずつ順番に動くので、
//  acting席ごとに切替えれば「関与なし・人間模倣・現行AI」を同一ゲームに共存させられる。
//  cpure=挑戦者(関与なし): 人間由来を全OFF＋自己対戦蒸留で配置（人間データ不使用）
//  challenger=人間模倣: 全ON＋computeBest+港シナジーで配置（強者データ由来）
//  puremodel=現行AI: 全OFF＋computeBest(港なし)で配置（従来のベースライン）
// 無敵AI席は本編をロールアウト探索で打つ（それ以外は従来どおり標準の建設ロジック）
function _aiPlayMain(p){
  try{
    if(typeof ROLLOUT_SEATS!=="undefined" && ROLLOUT_SEATS && ROLLOUT_SEATS.has(p)
       && typeof challengerMainRollout==="function"){
      challengerMainRollout(p);
      if(game.phase==="main") _botMain(p);   // 探索が打ち切った後の建て残し・交換は標準で回収
      return;
    }
  }catch(e){}
  _botMain(p);
}
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
function aiStep(){
  if(!game || !game.ai){ aiBusy=false; return; }
  if(paused){ aiBusy=false; return; }
  if(game.phase==="over"){ aiBusy=false; refresh(); return; }

  if(game.phase==="setup"){
    const sp = game.setup.queue[game.setup.step];
    if(!isAI(sp)){ aiBusy=false; refresh(); return; }
    if(game.setup.phase==="settle"){
      _applyVariant(sp);            // 席の変種でグローバルフラグ(港/盗賊/HUMAN_SETUP)を解決
      let v=null;
      const _saveActive=(typeof active!=="undefined")?active:undefined;
      try{ active=sp; }catch(e){}   // computeBestのモデル評価・港シナジーを配置席の視点にする
      // 変種別の初期配置: 挑戦者(関与なし)=自己対戦蒸留 / 人間模倣=computeBest+港 / 現行AI=computeBest(港なし)
      if(seatAI[sp]==="cpure" && typeof distillPickHTML==="function") v=distillPickHTML(sp);
      if(v==null || occupantOf(v)){
        const B=computeBest();v=B.ranked[0];
        // 席で選んだgen0/gen1/gen2の検証済み配置方策を使う（無敵AIはgen0）。
        // 1軒目は自己対戦モデル、P1の最終2軒目は条件付きモデル、それ以外は従来の安全上書き。
        if(isStrongSeatKind(seatAI[sp])&&typeof setupLearnedPick==="function")v=setupLearnedPick(sp,B,v);
        else if(isStrongSeatKind(seatAI[sp])&&typeof setupPairPick==="function")v=setupPairPick(sp,B,v);
      }
      try{ active=_saveActive; }catch(e){}
      gameClickVertex(v);
    } else {
      const oc=occupantOf(game.setup.lastSettle);
      const wantPort = oc && placements[oc.p] && placements[oc.p].settlements.size===2;
      const rr=bestRoadFrom(game.setup.lastSettle, wantPort, oc && oc.p);
      if(rr.length) gameClickEdge(rr[0].eid);
      else { const vv=game.setup.lastSettle; const e=GEO.edges.find(e=>(e.a===vv||e.b===vv)&&!ownerOf("roads",e.id)); if(e) gameClickEdge(e.id); }
    }
    refresh(); scheduleAI(550); return;
  }
  if(game.phase==="discard"){
    const d=game.discardQueue[0];
    if(d && isAI(d.p)){ _botDiscard(); refresh(); scheduleAI(400); return; }
    aiBusy=false; refresh(); return;
  }
  const p=cur();
  if(!isAI(p)){ aiBusy=false; refresh(); return; }
  _applyVariant(p);   // acting席の変種で本編フラグ(遅延盗賊など)を解決
  if(game.phase==="roll"){ if(_shouldPlayKnight(p)) playDev("knight"); if(game.phase==="roll") doRoll(null); refresh(); scheduleAI(650); return; }
  if(game.phase==="robber"){ const ra=robberAdvice(); gameClickHex(ra?ra.hid:GEO.hexes.find(h=>h.id!==game.robber).id); refresh(); scheduleAI(550); return; }
  if(game.phase==="steal"){ stealFrom(bestStealTarget(game.stealCands)); refresh(); scheduleAI(450); return; }
  if(game.phase==="main"){
    // 無敵AIは探索で数秒かかる。先に「考え中」を描画してから、次のフレームで計算に入る（画面が固まる前に表示する）
    if(typeof ROLLOUT_SEATS!=="undefined" && ROLLOUT_SEATS && ROLLOUT_SEATS.has(p)){
      const st=document.getElementById("gameStatus");
      if(st) st.innerHTML=`<b style="color:${PCOLORS[p-1]}">P${p}</b> ${LANG==="en"?"is searching…":"が先読み中…"}（${t("ai_invincible")}）`;
      clearTimeout(aiTimer);
      aiTimer=setTimeout(()=>{
        if(paused){ aiBusy=false; return; }
        _aiPlayMain(p); _cleanupTurn(p); if(game.phase==="main") endTurnGame();
        refresh(); scheduleAI(200);
      }, 30);
      return;
    }
    if(evalOn){
      // AIの手番でも評価値を見せる: まず現在のAIの評価を描画し、速度ぶん待ってから打つ
      refresh();
      clearTimeout(aiTimer);
      aiTimer=setTimeout(()=>{
        if(paused){ aiBusy=false; return; }
        _aiPlayMain(p); _cleanupTurn(p); if(game.phase==="main") endTurnGame();
        refresh(); scheduleAI(200);
      }, aiDelay(650));
    } else {
      _aiPlayMain(p); _cleanupTurn(p); if(game.phase==="main") endTurnGame(); refresh(); scheduleAI(650);
    }
    return;
  }
  aiBusy=false;
}
function aiMaybeGo(){
  if(!game || !game.ai || aiBusy || paused) return;
  const needAI =
    (game.phase==="setup" && isAI(game.setup.queue[game.setup.step])) ||
    (game.phase==="discard" && game.discardQueue[0] && isAI(game.discardQueue[0].p)) ||
    (["roll","robber","steal","main"].includes(game.phase) && isAI(cur()));
  if(needAI){ aiBusy=true; scheduleAI(500); }
}

/* ============================================================
   画面更新
   ============================================================ */
function refresh(){ if(game){ render(); updateGamePanel(); } }
function seatTag(p){ return `<b style="color:${PCOLORS[p-1]}">P${p}</b>`; }

// ホットシート対応: 人間席かどうか / いま画面に映すべき席（フォーカス）
function isHuman(p){ return !!(game && game.ai && p!=null && !game.ai.has(p)); }
function uiSeat(){
  if(!game) return humanSeat;
  if(game.phase==="discard" && game.discardQueue && game.discardQueue[0]) return game.discardQueue[0].p;  // 捨てる本人
  if(game.phase==="setup" && game.setup) return game.setup.queue[game.setup.step];                        // 配置中の席
  return cur();
}
// 手札バーに表示する席: 人間の番/捨て/配置中はその席、AI(他人)の番でも「自分(人間)の手札」を出し続ける。
// （全AI観戦時のみ従来どおり手番席）。他人のターンでも自分の手札が見えない問題への対応。
function viewSeat(){
  if(!game) return humanSeat;
  const s=uiSeat();
  if(isHuman(s)) return s;
  const humans=game.order.filter(q=>isHuman(q));
  if(!humans.length) return s;
  return humans.includes(humanSeat)?humanSeat:humans[0];
}

function updateGamePanel(){
  if(!game) return;
  const p=cur();
  const activeSeat = (game.phase==="setup" && game.setup) ? game.setup.queue[game.setup.step] : p;
  updateStatus(activeSeat);
  updatePrompt(activeSeat);
  renderHand();
  renderMyDev();
  renderMeStat();
  updateActions();
  renderBank();
  renderOpponents(activeSeat);
  updateEval();
  updateWinMeter();
  updateLiveNoteUI();
  if(game.phase==="over") onGameOver();
}

function winMeterStateKey(){
  if(!game)return "";
  const pl={};for(let p=1;p<=4;p++)pl[p]={s:[...placements[p].settlements].sort((a,b)=>a-b),c:[...(placements[p].cities||[])].sort((a,b)=>a-b),r:[...placements[p].roads].sort((a,b)=>a-b)};
  const deck=game.dev&&Array.isArray(game.dev.deck)?game.dev.deck.slice().sort():[];
  return JSON.stringify({phase:game.phase,idx:game.idx,setup:game.setup?{step:game.setup.step,phase:game.setup.phase,last:game.setup.lastSettle}:null,
    robber:game.robber,dice:game.dice,rolled:game.rolled,rollCount:game.rollCount||0,hands:game.hands,
    dev:game.dev?{hands:game.dev.hands,deck}:null,army:game.army,lr:game.lr,la:game.la,pl});
}
function winMeterBlend(prior,wins,n,priorWeight){
  const out={};let sum=0;
  for(let p=1;p<=4;p++){out[p]=(Number(wins[p]||0)+Number(prior[p]||0)*priorWeight)/(n+priorWeight);sum+=out[p];}
  if(sum>0)for(let p=1;p<=4;p++)out[p]/=sum;
  return out;
}
function requestPreciseWinEstimate(key,prior){
  if(!game||game.phase==="over"||typeof winFullPlayoutContext!=="function"||typeof winFullPlayoutSample!=="function")return;
  if(winMeterEstimate&&winMeterEstimate.key===key)return;
  clearTimeout(winMeterEstimateTimer);const job=++winMeterEstimateJob;
  // 明示的にゲージをONにした時は精度優先。結果は途中から逐次表示する。
  // 未校正の学習値は16局分だけに抑え、最終値の大半を直接プレイアウトにする。
  const target=uiMode==="mobile"?256:512,priorWeight=16,wins={1:0,2:0,3:0,4:0};
  let base=null;try{base=winFullPlayoutContext();}catch(e){}
  if(!base)return;
  const started=performance.now();
  winMeterEstimate={key,probs:prior,wins,done:0,attempts:0,failed:0,total:target,complete:false,elapsed:0};
  const batch=()=>{
    if(job!==winMeterEstimateJob||!winMeterOn||!game||winMeterStateKey()!==key)return;
    const deadline=performance.now()+12;
    do{
      let w=0;try{w=Number(winFullPlayoutSample(base,((Math.random()*4294967295)>>>0)||1));}catch(e){}
      winMeterEstimate.attempts++;
      if(w>=1&&w<=4){wins[w]++;winMeterEstimate.done++;}else winMeterEstimate.failed++;
    }while(winMeterEstimate.done<target&&winMeterEstimate.attempts<target*2&&performance.now()<deadline);
    winMeterEstimate.probs=winMeterBlend(prior,wins,winMeterEstimate.done,priorWeight);
    winMeterEstimate.elapsed=performance.now()-started;
    winMeterEstimate.complete=winMeterEstimate.done>=target||winMeterEstimate.attempts>=target*2;
    updateWinMeter();
    if(!winMeterEstimate.complete)winMeterEstimateTimer=setTimeout(batch,0);
  };
  winMeterEstimateTimer=setTimeout(batch,0);
}

function updateWinMeter(){
  const box=$("winMeter"), bar=$("winMeterBar"), labels=$("winMeterLabels"), btn=$("winMeterBtn"),meta=$("winMeterMeta");
  if(!box||!bar||!labels) return;
  box.classList.toggle("on",winMeterOn);
  if(btn) btn.textContent=(uiMode==="mobile"
    ? (LANG==="en"?"Win: ":"勝率: ")
    : (LANG==="en"?"Win meter: ":"勝率ゲージ: "))+(winMeterOn?"ON":"OFF");
  if(!winMeterOn||!game) return;
  let probs=null;
  if(replay&&replay.active&&replay.turns[replay.idx]&&replay.turns[replay.idx].winProb) probs=replay.turns[replay.idx].winProb;
  if(replay&&replay.active&&!probs){
    bar.innerHTML="";if(meta)meta.textContent=LANG==="en"?"Saved position estimate":"棋譜保存時の局面評価";
    labels.innerHTML=`<div class="hint" style="grid-column:1/-1">${LANG==="en"?"No win-rate data in this record":"この棋譜には勝率記録がありません"}</div>`;return;
  }
  if(!probs){
    let prior=null;try{prior=estimateWinProbabilities();}catch(e){}
    if(prior){
      const key=winMeterStateKey();requestPreciseWinEstimate(key,prior);
      const est=winMeterEstimate&&winMeterEstimate.key===key?winMeterEstimate:null;
      probs=est?est.probs:prior;
      if(meta){
        if(game.phase==="over")meta.textContent=LANG==="en"?"Final result":"終局確定";
        else if(est&&est.complete){const err=est.done?100*1.96*Math.sqrt(.25/est.done):0;meta.textContent=LANG==="en"
          ?`${est.done.toLocaleString()} exact-rule playouts + learned prior · sampling ≤±${err.toFixed(1)}%`
          :`厳密ルール${est.done.toLocaleString()}局＋学習事前値・標本誤差最大±${err.toFixed(1)}%`;}
        else if(est){const liveErr=est.done?100*1.96*Math.sqrt(.25/est.done):null;meta.textContent=LANG==="en"
          ?`Calculating ${est.done}/${est.total}${liveErr?` · sampling ≤±${liveErr.toFixed(1)}%`:""}`
          :`精密計算中 ${est.done}/${est.total}局${liveErr?`・標本誤差最大±${liveErr.toFixed(1)}%`:""}`;}
        else meta.textContent=game.phase==="setup"
          ?(LANG==="en"?"Setup: 30-feature learned value (AUC 0.946)":"初期配置中：30特徴学習モデル（AUC 0.946）")
          :(LANG==="en"?"30-feature learned value":"30特徴学習モデル");
        meta.title=LANG==="en"
          ?"Assumes every seat continues with the current strongest AI policy. The ± figure is sampling error only."
          :"全席が現行の最強AI方策で続行すると仮定。±は乱数による標本誤差のみです。";
      }
    }
  }else if(meta)meta.textContent=LANG==="en"?"Estimate saved with this position":"この局面に保存された推定値";
  if(!probs) return;
  const vals=[1,2,3,4].map(p=>Math.max(0,Number(probs[p]||0)));
  const sum=vals.reduce((a,b)=>a+b,0)||1;
  const pct=vals.map(v=>v/sum*100);
  bar.innerHTML=pct.map((v,i)=>`<div class="wmseg" style="width:${v.toFixed(3)}%;background:${PCOLORS[i]}" title="P${i+1} ${v.toFixed(1)}%"></div>`).join("");
  labels.innerHTML=pct.map((v,i)=>`<div class="wmlabel" style="color:${PCOLORS[i]}"><span>P${i+1}</span><b>${v.toFixed(1)}%</b></div>`).join("");
}

function toggleWinMeter(){
  winMeterOn=!winMeterOn;
  if(!winMeterOn){clearTimeout(winMeterEstimateTimer);winMeterEstimateJob++;}
  updateWinMeter();
}

function updateStatus(activeSeat){
  let phase="";
  const seat = seatTag(activeSeat), pc = seatTag(cur());
  if(game.phase==="setup"){
    phase = t("st_setup",{step:game.setup.step+1, total:game.setup.queue.length, seat, kind:(game.setup.phase==="settle"?t("kind_settlement"):t("kind_road"))});
  } else if(game.phase==="roll"){ phase=t("st_roll",{seat:pc}); }
  else if(game.phase==="discard"){ const d=game.discardQueue[0]; phase=t("st_discard",{seat:seatTag(d.p), n:d.need}); }
  else if(game.phase==="robber"){ phase=t("st_robber",{seat:pc}); }
  else if(game.phase==="steal"){ phase=t("st_steal",{seat:pc}); }
  else if(game.phase==="main"){ phase=t("st_main",{seat:pc, dice:game.dice}); }
  else if(game.phase==="over"){ const w=winnerSeat(); phase=`${t("st_over")} <span class="wintag">${t("win_tag",{p:w,name:seatAiName(w)})}</span>`; }
  let badges = `<span class="badge">${t("badge_turn",{p:activeSeat, name:seatAiName(activeSeat)})}</span>`;
  if(game.lr.holder) badges += `<span class="badge">${t("badge_lr",{p:game.lr.holder, len:game.lr.len})}</span>`;
  if(game.la.holder) badges += `<span class="badge">${t("badge_la",{p:game.la.holder, n:game.la.count})}</span>`;
  $("statusBar").innerHTML = `<div class="stline">${phase}</div><div class="badges">${badges}</div>`;
}

function resButtons(){ return " " + RES5.map(r=>`<button class="btn sm" data-res="${r}" style="border-color:${RES_COL[r]}">${resName(r)}</button>`).join(" "); }
function updatePrompt(activeSeat){
  const pr=$("prompt"); let html="", hot=false;
  if(game.ask && isHuman(cur())){
    hot=true;
    html = (game.ask.type==="plenty") ? t("pr_plenty",{n:game.ask.picks})+resButtons() : t("pr_mono")+resButtons();
  } else if(game.phase==="steal" && isHuman(cur())){
    hot=true;
    html = t("pr_steal") + game.stealCands.map(c=>`<button class="btn sm" data-steal="${c}">${t("pr_steal_btn",{p:c,n:handTotal(c)})}</button>`).join(" ");
  } else if(game.phase==="discard" && game.discardQueue[0] && isHuman(game.discardQueue[0].p)){
    hot=true; html=t("pr_discard",{n:game.discardQueue[0].need});
  } else if(game.phase==="robber" && isHuman(cur())){ html=t("pr_robber"); }
  else if(game.phase==="setup" && isHuman(activeSeat)){ html = game.setup.phase==="settle"?t("pr_setup_settle"):t("pr_setup_road"); }
  else if(game.phase==="main" && isHuman(cur())){ html=t("pr_main"); }
  if(html){ pr.style.display=""; pr.className="prompt"+(hot?" hot":""); pr.innerHTML=html; }
  else { pr.style.display="none"; pr.innerHTML=""; return; }
  pr.querySelectorAll("[data-steal]").forEach(b=>{ b.onclick=()=>{ stealFrom(Number(b.dataset.steal)); refresh(); aiMaybeGo(); }; });
  if(game.ask && isHuman(cur())){
    const fn = game.ask.type==="plenty" ? resolvePlenty : resolveMono;
    pr.querySelectorAll("[data-res]").forEach(b=>{ b.onclick=()=>{ fn(b.dataset.res); refresh(); aiMaybeGo(); }; });
  }
}

function renderHand(){
  const me=viewSeat(), box=$("myCards");
  const htEl=document.querySelector(".handhead .ht");
  if(!isHuman(me)){   // 全AI観戦時のみ: 手札は非公開
    if(htEl) htEl.textContent = (LANG==="en"?`P${me} (AI)`:`P${me}（AI）の番`);
    box.innerHTML = `<div class="handai">${LANG==="en"?`🤖 P${me} (AI) is playing — hand hidden`:`🤖 P${me}（AI）の番 — 手札は非公開`}</div>`;
    return;
  }
  // 自分の手札は常に表示。手番が他者(AI等)なら、その旨を添える。
  const turnNote = (isHuman(me) && cur()!==me && game.phase!=="over")
    ? (LANG==="en"?` · P${cur()} ${seatAiName(cur())}'s turn`:` ・${seatTag(cur())}の番`) : "";
  const ownerName=seatAiName(me);
  const handOwner = LANG==="en"
    ? (ownerName===t("ai_you") ? `P${me} — your hand` : `P${me} — ${ownerName}'s hand`)
    : `P${me} ${ownerName}の手札`;
  if(htEl) htEl.innerHTML = handOwner + `<small class="turnnote">${turnNote}</small>`;
  box.innerHTML="";
  const discarding = game.phase==="discard" && game.discardQueue[0] && game.discardQueue[0].p===me;
  for(const r of RES5){
    const c=document.createElement("div");
    c.className="rescard"+(discarding?" click":"");
    c.innerHTML=`<div class="top" style="background:${RES_COL[r]}">${resName(r)}</div><div class="cnt">${game.hands[me][r]}</div>`;
    if(discarding) c.onclick=()=>humanDiscard(r);
    box.appendChild(c);
  }
}

// 試合中に書いたメモを、現在進行中のターンの棋譜コマへ添付する。
// snapshotTurn() が確定保存して空にするため、次ターンへ誤って持ち越さない。
function updateLiveNoteUI(){
  const box=$("liveNoteBox"), input=$("liveTurnNote"), target=$("liveNoteTarget"), status=$("liveNoteStatus"), toggle=$("noteToggle");
  if(!box || !input) return;
  const active=!!(game && game.phase!=="setup" && game.phase!=="over" && !(replay&&replay.active));
  // 開閉そのものは .open クラスに任せる。ここでは入力可能な局面かだけを制御する。
  box.style.display=active?"":"none";
  if(toggle) toggle.disabled=!active;
  if(!active) return;
  const p=cur();
  const tn=game.turns.filter(x=>!x.setup).length+1;
  target.textContent=`ターン ${tn}・P${p} に保存`;
  const val=String(game._liveNote||"");
  if(input.value!==val) input.value=val;
  input.oninput=()=>{
    if(!game) return;
    game._liveNote=input.value;
    const has=input.value.trim().length>0;
    status.textContent=has?"入力済み・ターン終了時に自動保存":"未入力";
    status.classList.toggle("saved",has);
  };
  const has=val.trim().length>0;
  status.textContent=has?"入力済み・ターン終了時に自動保存":"未入力";
  status.classList.toggle("saved",has);
}
function humanDiscard(r){
  const d=game.discardQueue[0];
  if(!d || !isHuman(d.p) || game.hands[d.p][r]<=0) return;
  game.hands[d.p][r]--; d.need--;
  glog("手札を1枚捨てた", d.p);   // 捨てた資源の種類は非公開
  if(typeof _recAct==="function") _recAct({a:"discard", p:d.p, res:{[r]:1}});   // 人間の捨て札も棋譜に記録
  if(d.need<=0){ game.discardQueue.shift(); if(!game.discardQueue.length){ game.phase="robber"; toast(t("toast_robber")); } }
  refresh(); aiMaybeGo();
}
function renderMyDev(){
  const me=viewSeat(), box=$("myDev"); box.innerHTML="";
  if(!isHuman(me)){ box.innerHTML=`<span class="devchip">${t("dev_deck_chip",{n:game.dev.deck.length})}</span>`; return; }  // 全AI観戦時のみ非公開
  const h=game.dev.hands[me]; const chips=[];
  const devKey={knight:"dev_knight",roads:"dev_roads",plenty:"dev_plenty",mono:"dev_mono",vp:"dev_vp"};
  for(const c of ["knight","roads","plenty","mono","vp"]) if(h[c]>0) chips.push(`<span class="devchip">${t(devKey[c])} <b>×${h[c]}</b></span>`);
  chips.push(`<span class="devchip">${t("dev_deck_chip",{n:game.dev.deck.length})}</span>`);
  box.innerHTML=chips.join("");
}
function renderMeStat(){
  const me=viewSeat(), over=game.phase==="over";
  if(!isHuman(me)){   // 全AI観戦時のみ: 公開情報のみ（VPは隠しカードを含むため出さない）
    $("meStat").innerHTML = `<span class="dot" style="background:${PCOLORS[me-1]}"></span>P${me} <span class="ai">${seatAiName(me)}</span>`
      + `<span class="sep">${t("lbl_knights")} <b>${game.army[me]}</b></span>`
      + `<span class="sep">${t("lbl_road")} <b>${longestRoadOf(me)}</b></span>`;
    return;
  }
  const devN=Object.values(game.dev.hands[me]).reduce((a,b)=>a+b,0);
  const vpCard=game.dev.hands[me].vp>0 ? ` <span class="badge">${t("vpcards",{n:game.dev.hands[me].vp})}</span>` : "";
  $("meStat").innerHTML =
    `<span class="dot" style="background:${PCOLORS[me-1]}"></span>P${me} <span class="ai">${seatAiName(me)}</span>`
    + `<b class="vpn">${vpOf(me)}</b><small>${t("lbl_vp")}</small>`
    + `<span class="sep">${t("lbl_dev")} <b>${devN}</b></span>`
    + `<span class="sep">${t("lbl_knights")} <b>${game.army[me]}</b></span>`
    + `<span class="sep">${t("lbl_road")} <b>${longestRoadOf(me)}</b></span>${vpCard}`;
}
function updateActions(){
  const isMe=isHuman(cur()), main=isMe&&game.phase==="main";
  $("rollBtnU").disabled  = !(isMe && game.phase==="roll");
  $("buyDevU").disabled   = !(main && game.dev.deck.length>0);
  $("knightU").disabled   = !(isMe && (game.phase==="main"||game.phase==="roll") && safeCanPlay("knight"));
  $("roadsU").disabled    = !(main && safeCanPlay("roads"));
  $("plentyU").disabled   = !(main && safeCanPlay("plenty"));
  $("monoU").disabled     = !(main && safeCanPlay("mono"));
  $("tradeBtnU").disabled = !main;
  $("endTurnU").disabled  = !main;
}
function safeCanPlay(card){ try{ return isHuman(cur()) && canPlay(card); }catch(e){ return false; } }

function renderBank(){
  const g=$("bankGrid"); g.innerHTML="";
  for(const r of RES5) g.innerHTML += `<div class="bankcell"><div class="lb">${resName(r)}</div><div class="nv" style="color:${RES_COL[r]}">${bankOf(r)}</div></div>`;
  $("bankMeta").innerHTML = `<div class="m">${t("bank_deck")} <b>${game.dev.deck.length}</b></div>`;
  let kn=0,rd=0,pl=0,mo=0;
  for(let q=1;q<=numPlayers;q++){ kn+=game.army[q]; const pd=game.dev.played[q]||{}; rd+=pd.roads||0; pl+=pd.plenty||0; mo+=pd.mono||0; }
  const parts=[[t("tally_knight"),kn],[t("tally_road"),rd],[t("tally_plenty"),pl],[t("tally_mono"),mo]].map(([n,v])=>`<div class="d">${n} <b>${v}</b></div>`).join("");
  $("devPlayed").innerHTML = `<span class="dp-title">${t("devplayed_title")}</span>${parts}`;
}

function renderOpponents(activeSeat){
  const box=$("oppPanel"); box.innerHTML="";
  const over=game.phase==="over";
  for(let q=1;q<=numPlayers;q++){
    if(q===viewSeat()) continue;   // いま手札バーに出している自分の席は除く（残りをカウントのみ表示）
    const devN=Object.values(game.dev.hands[q]).reduce((a,b)=>a+b,0);
    const turn=(q===activeSeat)&&!over;
    const vpCard = over && game.dev.hands[q].vp>0 ? ` <span class="badge sm">${t("vpcards",{n:game.dev.hands[q].vp})}</span>` : "";
    box.innerHTML += `<div class="opp${turn?" turn":""}">
      <span class="dot" style="background:${PCOLORS[q-1]}"></span>
      <span class="nm">P${q}</span><span class="ai">${seatAiName(q)}</span>
      <span class="vp">${vpOf(q)}<small>${t("lbl_vp")}</small></span>
      <span class="ministat">${t("lbl_hand")}<b>${handTotal(q)}</b>·${t("lbl_dev")}<b>${devN}</b>·${t("lbl_knights")}<b>${game.army[q]}</b>·${t("lbl_road")}<b>${longestRoadOf(q)}</b>${vpCard}</span>
    </div>`;
  }
}

/* ============================================================
   AI評価値
   ============================================================ */
function evLabel(label){
  if(LANG!=="en") return label;
  const s=String(label);
  if(s.startsWith("余り資源を交換して今すぐ都市化")) return t("ev_trade_city");
  if(s.startsWith("余り資源を交換して今すぐ開拓地")) return t("ev_trade_settle");
  if(s.startsWith("余りの")) return t("ev_trade_surplus");
  if(s.startsWith("都市化")) return t("ev_city");
  if(s.startsWith("開拓地")) return t("ev_settle");
  if(s.startsWith("道を伸ばす")) return t("ev_road");
  if(s.startsWith("発展カードを買う")) return t("ev_dev");
  if(s.startsWith("ターン終了")) return t("ev_endturn");
  return jaToEn(s);
}
function updateEval(){
  const anyMain = game.phase==="main";                         // 誰の手番でも本編なら評価を出す（AI含む）
  const humanPlace = game.phase==="setup" && game.setup && game.setup.phase==="settle" && isHuman(game.setup.queue[game.setup.step]);
  const curSeat = cur();
  const seatLbl = (anyMain && !isHuman(curSeat)) ? t("eval_seat",{seat:curSeat}) : "";

  const wantBest = evalOn && humanPlace;
  if(wantBest!==showBest){ showBest=wantBest; if(!_rerendering){ _rerendering=true; render(); _rerendering=false; } }

  const plan=$("evalPlan"), list=$("evalList");
  if(!evalOn){ plan.innerHTML=""; list.innerHTML=`<div class="hint">${t("eval_off_hint")}</div>`; return; }
  if(!anyMain && !humanPlace){ plan.innerHTML=""; list.innerHTML=`<div class="hint">${t("eval_wait_hint")}</div>`; return; }

  if(anyMain){
    let adv; try{ adv=computeAdvice(); }catch(e){ adv=[]; }
    const pl=adv._plan;
    plan.innerHTML = seatLbl + (pl ? t("eval_plan",{label:pl.label, ore:pl.oreShort}) : t("eval_noplan"));
    const base=0.5;
    const rows=adv.map(a=>({label:a.label,can:a.can,cost:a.cost,pts:Math.round((a.score-base)*10)/10})).sort((x,y)=>y.pts-x.pts).slice(0,8);
    const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.pts)));
    list.innerHTML = rows.map(r=>{
      const cls=r.pts>0?"pos":(r.pts<0?"neg":"zero");
      const sign=(r.pts>0?"+":"")+r.pts.toFixed(1);
      const na=r.can?"":` <small>${t("eval_shortage",{cost:r.cost})}</small>`;
      const w=Math.max(0,Math.round(r.pts/maxAbs*100));
      return `<div class="evrow${r.can?"":" na"}"><div class="pts ${cls}">${sign}</div>
        <div><div class="lab">${evLabel(r.label)}${na}</div>${r.pts>0?`<div class="evbar"><i style="width:${w}%"></i></div>`:""}</div></div>`;
    }).join("") || `<div class="hint">${t("eval_nocand")}</div>`;
  } else {
    const _bseat=(game.setup?game.setup.queue[game.setup.step]:null);
    let B; try{ B=computeBestStrong(_bseat); }catch(e){ B={ranked:[],scores:{},mn:0,mx:0}; }
    plan.innerHTML = t("eval_place_note");
    const top=B.ranked.slice(0,6);
    list.innerHTML = top.map((vid,i)=>{
      const sc=B.scores[vid]; const pts=Math.round((sc.score-B.mn)*10)/10;
      const w=Math.max(4,Math.round((sc.score-B.mn)/Math.max(0.001,B.mx-B.mn)*100));
      const mark=i<3?["①","②","③"][i]:"・";
      return `<div class="evrow"><div class="pts pos">+${pts.toFixed(1)}</div>
        <div><div class="lab">${t("eval_cand",{mark, pip:sc.pip, div:sc.div, port:sc.port})}</div>
        <div class="evbar"><i style="width:${w}%"></i></div></div></div>`;
    }).join("") || `<div class="hint">${t("eval_novtx")}</div>`;
  }
}

/* ============================================================
   対局終了
   ============================================================ */
function winnerSeat(){ let w=1,bv=-1; for(let q=1;q<=numPlayers;q++){ const v=vpOf(q); if(v>bv){bv=v;w=q;} } return w; }
function onGameOver(){
  $("replayBtn").disabled=false; $("exportBtn").disabled=false;
  if(!_overHandled){
    _overHandled=true; clearTimeout(aiTimer);
    const w=winnerSeat(); winner=w;
    if(!game._winLogged) glog(`🏆 P${w} が ${vpOf(w)}点で勝利！`, w);
    toast(t("toast_win",{p:w}));
  }
}

/* ============================================================
   リプレイ（showReplayTurn を i18n 版で上書き）
   ============================================================ */
function showReplayTurn(){
  if(!replay) return;
  const turn=replay.turns[replay.idx];
  $("rvTitle").textContent = (LANG==="en") ? jaToEn(turn.title) : turn.title;
  $("rvCount").textContent = t("rv_count",{i:replay.idx+1, n:replay.turns.length});
  const hb=$("rvHands");
  if(hb){
    if(turn.hands && Object.keys(turn.hands).length){
      let s='<table class="rvtable"><tr><th>'+t("rv_h_seat")+'</th>'
        + RES5.map(r=>`<th>${resName(r)}</th>`).join("")
        + `<th>${t("rv_h_total")}</th><th>${t("rv_h_cards")}</th><th>${t("rv_h_vp")}</th></tr>`;
      for(const p of Object.keys(turn.hands)){
        const hh=turn.hands[p]; const res=hh.res||{};
        const tot=RES5.reduce((a,r)=>a+(res[r]||0),0);
        const isT=String(turn.player)===String(p);
        s+=`<tr class="${isT?'rvt':''}"><td><span style="color:${PCOLORS[p-1]};font-weight:700">P${p}</span></td>`
          + RES5.map(r=>`<td>${res[r]||0}</td>`).join("")
          + `<td><b>${tot}</b></td><td>${hh.dev||0}</td><td>${hh.vp!=null?hh.vp:"-"}</td></tr>`;
      }
      hb.innerHTML=s+"</table>";
    } else hb.innerHTML=`<div class="hint">${t("rv_no_hands")}</div>`;
  }
  const evs=(turn.events&&turn.events.length)?turn.events:[t("rv_no_events")];
  $("rvEvents").innerHTML = evs.map(x=>`<div>${LANG==="en"?jaToEn(x):x}</div>`).join("");
  // このターンへのコメント（棋譜に保存される）
  const noteOwner=turn._sourceTurn||turn;
  const tn=$("rvTurnNote");
  if(tn){ tn.value = noteOwner.note || "";
    tn.oninput = ()=>{ noteOwner.note = tn.value; _markNoted(); }; }
  const gn=$("rvGameNote");
  if(gn){ gn.value = (typeof gameNote!=="undefined" && gameNote) ? gameNote : "";
    gn.oninput = ()=>{ gameNote = gn.value; }; }
  _markNoted();
  render();
  updateWinMeter();
}
// コメントの付いたターンが一目で分かるようにカウンタへ印を出す
function _markNoted(){
  if(!replay) return;
  const src=replay.sourceTurns||replay.turns;
  const n=src.filter(x=>x.note && x.note.trim()).length;
  const c=$("rvCount");
  if(c) c.innerHTML = t("rv_count",{i:replay.idx+1, n:replay.turns.length}) + (n?` <span class="rvnoted">✎${n}</span>`:"");
}
function _expandReplayTurns(turns){
  const out=[];
  for(const turn of (turns||[])){
    if(turn.setup || !Array.isArray(turn.steps) || !turn.steps.length){ out.push(turn); continue; }
    turn.steps.forEach((step,i)=>{
      const frame=Object.assign({},step,{
        title:`${turn.title}・行動 ${i+1}/${turn.steps.length}`,
        note:turn.note||""
      });
      Object.defineProperty(frame,"_sourceTurn",{value:turn,enumerable:false});
      out.push(frame);
    });
  }
  return out;
}
function startReplay(){
  if(!game || !game.turns || !game.turns.length){ toast(t("toast_no_record")); return; }
  paused=true; updatePauseBtn(); clearTimeout(aiTimer);
  replay={turns:_expandReplayTurns(game.turns), sourceTurns:game.turns, idx:0, active:true};
  $("replayBar").style.display="block"; document.body.classList.add("replaying");
  showReplayTurn();
}
function stopRvPlay(){ if(rvPlayTimer){ clearInterval(rvPlayTimer); rvPlayTimer=null; } updateRvButtons(); }
function toggleRvPlay(){
  if(!replay) return;
  if(rvPlayTimer){ stopRvPlay(); return; }
  rvPlayTimer=setInterval(()=>{
    if(!replay){ stopRvPlay(); return; }
    if(replay.idx>=replay.turns.length-1){ stopRvPlay(); return; }
    replay.idx++; showReplayTurn();
  },900);
  updateRvButtons();
}
function exitReplayU(){ stopRvPlay(); exitReplay(); document.body.classList.remove("replaying"); if(game){ render(); updateWinMeter(); } else $("startScreen").classList.remove("hidden"); }
function updateRvButtons(){
  $("rvPrev").textContent=t("rv_prev"); $("rvNext").textContent=t("rv_next"); $("rvExit").textContent=t("rv_close");
  $("rvPlay").textContent = rvPlayTimer ? t("rv_stop") : t("rv_auto");
  $("rvPlay").classList.toggle("on", !!rvPlayTimer);
  if(!(replay && replay.active)) $("rvTitle").textContent=t("rv_title");
}

// ============================================================
//  手動配置モード（既存エディタ clickVertex/clickEdge を現行UIに露出）
// ============================================================
function startComposer(){
  if(typeof game!=="undefined" && game){ try{ endGameMode(); }catch(e){} }
  paused=true; if(typeof updatePauseBtn==="function") updatePauseBtn(); clearTimeout(aiTimer); aiBusy=false;
  game=null; sim=null; replay=null;
  if(!board || !Object.keys(board).length){ try{ randomBoard(); randomPorts(); }catch(e){} }
  resetPlacements();
  composerOrder.length=0; composerOn=true; active=1; tool="place"; selectedHex=null;
  $("startScreen").classList.add("hidden");
  document.body.classList.add("composing");
  $("replayBar").style.display="none";
  $("composerBar").style.display="block";
  $("exportBtn").disabled=false;
  render();
  try{ buildTilePicker(); buildPortPicker(); updateTilePicker(); }catch(e){}
  setComposerPlayer(1); updateComposerBar();
  if(uiMode==="mobile") setMobileTab("status");
}
function exitComposer(){
  composerOn=false;
  document.body.classList.remove("composing");
  $("composerBar").style.display="none";
  $("startScreen").classList.remove("hidden");
}
function setComposerPlayer(p){
  active=p; tool="place";   // 配置ツールへ（頂点=開拓地/辺=道）
  document.querySelectorAll("#composerBar .cpp").forEach(b=>b.classList.toggle("on", Number(b.dataset.cp)===p));
}
function composerShuffle(){
  try{ randomBoard(); randomPorts(); }catch(e){}
  resetPlacements(); composerOrder.length=0; selectedHex=null;
  render(); try{ updateTilePicker(); buildPortPicker(); }catch(e){} updateComposerBar();
}
function composerBlank(){
  try{ blankBoard(); }catch(e){}
  resetPlacements(); composerOrder.length=0; selectedHex=null;
  render(); try{ updateTilePicker(); buildPortPicker(); }catch(e){} updateComposerBar();
}
function updateComposerBar(){
  const el=$("cpStat"); if(!el) return;
  let s="";
  for(let p=1;p<=4;p++){ const pl=placements[p]||{settlements:new Set(),roads:new Set()};
    s+=`<span style="color:${PCOLORS[p-1]};font-weight:700;margin-right:12px">P${p}: 開拓地${pl.settlements.size}・道${pl.roads.size}</span>`; }
  el.innerHTML=s;
}
function composerExport(){
  const hasBoard=GEO.hexes.some(h=>board[h.id]&&board[h.id].resource);
  const hasSett=[1,2,3,4].some(p=>placements[p]&&placements[p].settlements.size);
  if(!hasBoard && !hasSett){ toast(t("toast_composer_empty")); return; }
  // 置いた順に setup ステップを生成（humanagree/bcloneが読める形＋リプレイ可能）
  const rep=[]; const settMap={}, roadMap={};
  for(const o of composerOrder){
    settMap[o.vid]=o.p;
    rep.push({setup:true, sett:{...settMap}, city:{}, road:{...roadMap}, robber:0, dice:null, player:o.p,
      title:`手動配置 ${rep.length+1}　P${o.p} が開拓地`, hands:{}, events:[`P${o.p} が開拓地(v${o.vid})を置いた`]});
  }
  for(let p=1;p<=4;p++){ if(placements[p]&&placements[p].roads) for(const e of placements[p].roads) roadMap[e]=p; }
  // 盤面のみでも読み込めるよう、必ず最終(盤面)ステップを1つ入れる
  rep.push({setup:true, sett:{...settMap}, city:{}, road:{...roadMap}, robber:0, dice:null, player:1,
    title: composerOrder.length? "手動配置 完成" : "盤面（手動作成）", hands:{},
    events:[ composerOrder.length? "配置完成（手動作成）" : "盤面を手動作成" ]});
  const rec={
    board:{ hexes: GEO.hexes.map(h=>({id:h.id,q:h.q,r:h.r,resource:board[h.id].resource,number:board[h.id].number})) },
    ports: Object.entries(ports).map(([e,ty])=>({edge:Number(e),type:ty})),
    replay: rep,
    placements: Object.fromEntries([1,2,3,4].map(p=>[p,{
      settlements:[...(placements[p]?placements[p].settlements:[])].sort((a,b)=>a-b),
      cities: (placements[p]&&placements[p].cities)?[...placements[p].cities].sort((a,b)=>a-b):[],
      roads:[...(placements[p]?placements[p].roads:[])].sort((a,b)=>a-b)
    }])),
    winner:null, label:null, source:"manual-composed", roles4:true
  };
  const blob=new Blob([JSON.stringify(rec,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="board_composed.json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(t("toast_composed"));
}

function exportRecord(){
  if(!game){ toast(t("toast_no_record")); return; }
  const rec=toJSON();
  if(gameNote && gameNote.trim()) rec.note = gameNote;   // 対局全体へのコメント
  const blob=new Blob([JSON.stringify(rec,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="game_record.json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(t("toast_exported"));
}

// 棋譜(JSON)を読み込んで再生モードに入る。ファイル選択→FileReader→engineのfromJSON()。
function loadRecord(){ const inp=$("loadInput"); if(inp){ inp.value=""; inp.click(); } }
function onLoadFile(ev){
  const f = ev.target.files && ev.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onerror = ()=>toast(t("toast_load_err"));
  rd.onload = ()=>{
    let data;
    try{ data = JSON.parse(rd.result); }catch(e){ toast(t("toast_load_err")); return; }
    if(!data || !data.board || !data.board.hexes || !Array.isArray(data.replay) || !data.replay.length){ toast(t("toast_load_err")); return; }
    try{
      // ライブ対局を止めて再生専用状態にする（fromJSONは旧エディタUI依存で落ちるため要素を直接復元）
      if(typeof game!=="undefined" && game){ try{ endGameMode(); }catch(e){} }
      paused=true; if(typeof updatePauseBtn==="function") updatePauseBtn(); clearTimeout(aiTimer); aiBusy=false;
      game=null;
      resetPlacements();
      for(const h of data.board.hexes) board[h.id]={resource:h.resource, number:h.number};
      ports={}; (data.ports||[]).forEach(p=>{ ports[p.edge]=p.type; });
      for(const [p,d] of Object.entries(data.placements||{})){
        if(!placements[p]) placements[p]={settlements:new Set(), roads:new Set(), cities:new Set()};
        if(!placements[p].cities) placements[p].cities=new Set();
        (d.settlements||[]).forEach(v=>placements[p].settlements.add(v));
        (d.cities||[]).forEach(v=>placements[p].cities.add(v));
        (d.roads||[]).forEach(e=>placements[p].roads.add(e));
      }
      winner = (data.winner!=null ? data.winner : null);
      replay = {turns:_expandReplayTurns(data.replay), sourceTurns:data.replay, idx:0, active:true};   // 新棋譜は行動ごとに再生
      $("startScreen").classList.add("hidden");
      document.body.classList.add("replaying");
      $("replayBar").style.display="block";
      $("exportBtn").disabled=false; $("replayBtn").disabled=false;
      stopRvPlay(); updateRvButtons(); showReplayTurn();   // showReplayTurn内でrender()→盤面描画
      if(uiMode==="mobile") setMobileTab("status");
      toast(t("toast_loaded"));
    }catch(e){ console.error("loadRecord",e); toast(t("toast_load_err")); }
  };
  rd.readAsText(f);
}

/* ============================================================
   コントロール
   ============================================================ */
function updatePauseBtn(){ $("pauseBtn").textContent = paused?"▶":"⏸"; $("pauseBtn").title = paused?t("play_title"):t("pause_title"); }
function togglePause(){ paused=!paused; updatePauseBtn(); if(paused){ clearTimeout(aiTimer); aiBusy=false; toast(t("toast_pause")); } else { toast(t("toast_play")); aiMaybeGo(); } }
function updateEvalBtn(){
  // スマホは幅が狭いのでラベルを短縮（「AI評価値」→「評価」/ "AI eval"→"Eval"）
  const word = (uiMode==="mobile") ? (LANG==="en"?"Eval":"評価") : t("eval_word");
  $("evalBtn").textContent = word+": "+(evalOn?"ON":"OFF");
  $("evalBtn").classList.toggle("on", evalOn);
}
function toggleEval(){ evalOn=!evalOn; updateEvalBtn(); if(game) refresh(); }
function setSpeed(v){ aiSpeedSec=v; $("speedLabel").textContent = v===0 ? (LANG==="en"?"Fastest":"最速") : v.toFixed(1)+(LANG==="en"?"s":"秒"); }
function newMatch(){
  clearTimeout(aiTimer); aiBusy=false; stopRvPlay();
  if(replay) replay.active=false; $("replayBar").style.display="none"; document.body.classList.remove("replaying");
  if(game) endGameMode();
  $("startScreen").classList.remove("hidden");
  $("exportBtn").disabled=true; $("replayBtn").disabled=true; _overHandled=false;
  render();
}

/* ---- モード（PC / スマホ） ---- */
function updateModeBtn(){ $("modeBtn").textContent = (uiMode==="pc")?t("mode_pc"):t("mode_mobile"); }
// スマホ表示では、行動ボタン列が横スクロールになるため、その最後尾にある交易UIが
// 画面外（375px幅の端末で x=657px）に押し出されて事実上たどり着けなかった。
// スマホ時だけ交易UIをボタン列の外へ出し、独立した行として常に見える位置に置く。
function _placeTradeRow(){
  const tr=document.querySelector(".trade"); const acts=$("actions");
  if(!tr||!acts||!acts.parentElement) return;
  if(uiMode==="mobile"){
    if(tr.parentElement===acts){ acts.parentElement.insertBefore(tr, acts.nextSibling); tr.classList.add("traderow"); }
  }else{
    if(tr.parentElement!==acts){ const et=$("endTurnU"); acts.insertBefore(tr, et||null); tr.classList.remove("traderow"); }
  }
}
function applyMode(){
  document.body.setAttribute("data-mode", uiMode);
  _placeTradeRow();
  updateModeBtn();
  updateEvalBtn();                 // ラベル長がモードで変わるため再適用
  updateWinMeter();                // 対局開始前もスマホ用の短いラベルにする
  closeTopMenu();                  // モード切替時はメニューを閉じる
  if(uiMode==="mobile") setMobileTab(mobileTab||"status");
  if(game) refresh(); else render();
}
function closeTopMenu(){
  const m=$("topMenu"), b=$("menuBtn");
  if(m) m.classList.remove("open");
  if(b) b.setAttribute("aria-expanded","false");
}
function toggleMode(){ uiMode = (uiMode==="pc")?"mobile":"pc"; applyMode(); }
function setMobileTab(name){
  mobileTab=name;
  document.querySelectorAll(".tabpanel").forEach(tp=>tp.classList.toggle("active", tp.dataset.tab===name));
  document.querySelectorAll("#tabBar .tabbtn").forEach(b=>b.classList.toggle("on", b.dataset.tab===name));
}

/* ---- 言語 ---- */
function updateLangBtn(){ $("langBtn").textContent = (LANG==="ja")?"English":"日本語"; }
function setLang(l){ if(l!==LANG){ LANG=l; applyLang(); } }
function toggleLang(){ setLang(LANG==="ja"?"en":"ja"); }
function applyLang(){
  document.body.setAttribute("data-lang", LANG);
  document.documentElement.lang = LANG;
  document.title = t("brand_title");
  document.querySelectorAll("[data-i18n]").forEach(el=>{ el.textContent=t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach(el=>{ el.innerHTML=t(el.dataset.i18nHtml); });
  updatePauseBtn(); updateEvalBtn(); updateWinMeter(); updateLangBtn(); updateModeBtn(); updatePlacementModeButton(); setSpeed(aiSpeedSec); updateRvButtons();
  buildTradeSelects(); buildStartScreen();
  if(game){ rerenderLog(); refresh(); if(replay && replay.active) showReplayTurn(); }
}

/* ============================================================
   開始画面
   ============================================================ */
function segBtn(label, on, fn){
  const b=document.createElement("button"); b.className="segb"+(on?" on":""); b.textContent=label; b.onclick=fn; return b;
}
function buildStartScreen(){
  // 言語 / 画面 切替
  const top=$("startTop"); top.innerHTML="";
  const langRow=document.createElement("div"); langRow.className="startseg";
  langRow.innerHTML=`<span class="sl">${t("start_lang")}</span>`;
  langRow.appendChild(segBtn(t("lang_ja"), LANG==="ja", ()=>setLang("ja")));
  langRow.appendChild(segBtn(t("lang_en"), LANG==="en", ()=>setLang("en")));
  const modeRow=document.createElement("div"); modeRow.className="startseg";
  modeRow.innerHTML=`<span class="sl">${t("start_mode")}</span>`;
  modeRow.appendChild(segBtn("PC", uiMode==="pc", ()=>{ uiMode="pc"; applyMode(); buildStartScreen(); }));
  modeRow.appendChild(segBtn(LANG==="en"?"Mobile":"スマホ", uiMode==="mobile", ()=>{ uiMode="mobile"; applyMode(); buildStartScreen(); }));
  const placeRow=document.createElement("div"); placeRow.className="startseg";
  placeRow.innerHTML=`<span class="sl">${LANG==="en"?"Placement":"配置操作"}</span>`;
  placeRow.appendChild(segBtn(LANG==="en"?"One tap":"ワンタッチ", !placementConfirmMode, ()=>setPlacementConfirmMode(false,true)));
  placeRow.appendChild(segBtn(LANG==="en"?"Tap twice":"2回タップ", placementConfirmMode, ()=>setPlacementConfirmMode(true,true)));
  top.appendChild(langRow); top.appendChild(modeRow); top.appendChild(placeRow);

  // 各席の担当（人間 / 挑戦者AI / 現行AI）— 同じ端末で人間を複数席に置ける（ホットシート）
  const subEl=document.querySelector(".sublabel[data-i18n='your_seat']");
  if(subEl) subEl.textContent = (LANG==="en"?"Who plays each seat (hot-seat OK)":"各席の担当（人間を複数席OK）");
  $("seatPick").innerHTML="";
  const kinds=[["human",LANG==="en"?"You (human)":"人間(操作)"],["strong",t("strong_full")],["gen1",t("gen1_full")],["gen2",t("gen2_full")],["invincible",t("invincible_full")]];
  const grid=$("seatGrid"); grid.innerHTML="";
  for(let s=1;s<=4;s++){
    const row=document.createElement("div"); row.className="seatrow";
    const seg=kinds.map(([k,lbl])=>`<button class="segb${seatKind[s]===k?" on":""}" data-seat="${s}" data-kind="${k}">${lbl}</button>`).join("");
    row.innerHTML=`<div class="who"><span class="dot" style="background:${PCOLORS[s-1]}"></span>P${s}</div><div class="seatseg">${seg}</div>`;
    grid.appendChild(row);
  }
  grid.querySelectorAll(".segb[data-seat]").forEach(b=>{ b.onclick=()=>{ seatKind[Number(b.dataset.seat)]=b.dataset.kind; buildStartScreen(); }; });
}

function startMatch(){
  seatAI={}; for(let s=1;s<=4;s++) seatAI[s]=seatKind[s];
  const humans=[1,2,3,4].filter(s=>seatKind[s]==="human");
  humanSeat = humans.length ? humans[0] : 1;
  $("gamePlayers").value="4"; showBest=false; _overHandled=false;
  startGame(null);
  game.ai=new Set([1,2,3,4].filter(p=>seatKind[p]!=="human"));
  paused=false; updatePauseBtn();
  $("startScreen").classList.add("hidden");
  $("exportBtn").disabled=false; $("replayBtn").disabled=true;
  if(replay) replay.active=false; $("replayBar").style.display="none"; document.body.classList.remove("replaying");
  if(uiMode==="mobile") setMobileTab("status");
  toast(humans.length
    ? (LANG==="en"?`Game start — humans: ${humans.map(x=>"P"+x).join(", ")}`:`対局開始 — 人間: ${humans.map(x=>"P"+x).join("・")}`)
    : (LANG==="en"?"Game start (all AI — watch)":"対局開始（全席AI・観戦）"));
  if(!(typeof MP!=="undefined" && (MP.active || MP.code)) && typeof soloResearchBegin==="function") soloResearchBegin();
  refresh(); aiMaybeGo();
}

/* ============================================================
   AIチューニング（スライダーで評価軸を生調整）
   ============================================================ */
let _tuneOpen=false, _tuneRows=[], _tuneStash={};
const TUNE_GROUPS = [
  { title:["配置：資源の重み","Placement: resource weights"],
    hint:["頂点の手書き評価。現行AI・最善手表示に反映（挑戦者の初期2軒は学習モデルなので不変）。効きは下の『学習モデル比』にも依存。",
          "Hand-written vertex value (affects current-AI & the best-spot display; the challenger's opening uses the learned model). Effect also scales with 'Model blend' below."],
    rows:[
      {ja:"鉄 Ore",en:"Ore",min:0,max:3,step:0.05,def:1.9,get:()=>BEST_W.resFactor.ore,set:v=>BEST_W.resFactor.ore=v},
      {ja:"麦 Wheat",en:"Wheat",min:0,max:3,step:0.05,def:1.7,get:()=>BEST_W.resFactor.wheat,set:v=>BEST_W.resFactor.wheat=v},
      {ja:"木 Wood",en:"Wood",min:0,max:3,step:0.05,def:1.0,get:()=>BEST_W.resFactor.wood,set:v=>BEST_W.resFactor.wood=v},
      {ja:"土 Brick",en:"Brick",min:0,max:3,step:0.05,def:1.0,get:()=>BEST_W.resFactor.brick,set:v=>BEST_W.resFactor.brick=v},
      {ja:"羊 Sheep",en:"Sheep",min:0,max:3,step:0.05,def:0.85,get:()=>BEST_W.resFactor.sheep,set:v=>BEST_W.resFactor.sheep=v},
    ]},
  { title:["配置：その他","Placement: other"],
    rows:[
      {ja:"多様性",en:"Diversity",min:0,max:3,step:0.05,def:0.8,get:()=>BEST_W.diversity,set:v=>BEST_W.diversity=v},
      {ja:"港（基礎）",en:"Port (base)",min:0,max:3,step:0.05,def:1.0,get:()=>BEST_W.portBase,set:v=>BEST_W.portBase=v},
      {ja:"港（資源一致）",en:"Port (match)",min:0,max:3,step:0.05,def:0.9,get:()=>BEST_W.portMatch,set:v=>BEST_W.portMatch=v},
      {ja:"同数字重ね",en:"Same-number",min:0,max:3,step:0.05,def:0.9,get:()=>BEST_W.sameNumber,set:v=>BEST_W.sameNumber=v},
      {ja:"学習モデル比 (0=手書き / 1=モデル)",en:"Model blend (0=hand / 1=model)",min:0,max:1,step:0.05,def:0.75,get:()=>MODEL_BLEND,set:v=>MODEL_BLEND=v,noIgnore:true},
    ]},
  { title:["本編：行動の重み","Main game: action weights"],
    rows:[
      {ja:"都市化",en:"City",min:0,max:2.5,step:0.05,def:1.0,get:()=>W_CITY,set:v=>W_CITY=v},
      {ja:"開拓地",en:"Settlement",min:0,max:2.5,step:0.05,def:1.0,get:()=>W_SETTLE,set:v=>W_SETTLE=v},
      {ja:"道",en:"Road",min:0,max:3,step:0.05,def:1.0,get:()=>W_ROAD,set:v=>W_ROAD=v},
    ]},
  { title:["盗賊：脅威度の重み","Robber: threat weights"],
    hint:["盗賊で誰を狙うか（大きいほど重視）。","Who the robber targets (higher = more weight)."],
    rows:[
      {ja:"VP",en:"VP",min:0,max:3,step:0.05,def:1.0,get:()=>THREAT_W.vp,set:v=>THREAT_W.vp=v},
      {ja:"生産力",en:"Production",min:0,max:1,step:0.02,def:0.10,get:()=>THREAT_W.pip,set:v=>THREAT_W.pip=v},
      {ja:"騎士賞の見込み点",en:"Expected largest-army VP",min:0,max:3,step:0.05,def:1.0,get:()=>THREAT_W.knight,set:v=>THREAT_W.knight=v},
    ]},
  { title:["道・妨害","Roads & disruption"],
    rows:[
      {ja:"妨害する相手のVP",en:"Disrupt at rival VP",min:6,max:10,step:1,def:8,get:()=>DANGER_VP,set:v=>DANGER_VP=v,noIgnore:true},
    ],
    toggles:[
      {ja:"無駄道を温存する",en:"Conserve roads",def:true,get:()=>CONSERVE_ROADS,set:v=>CONSERVE_ROADS=v},
    ]},
];
function _tuneFmt(v){ return (Math.round(v*100)/100).toString(); }
function _tuneApplied(){ if(typeof refresh==="function" && game) refresh(); }
function buildTunePanel(){
  const p=$("tunePanel"); if(!p) return;
  _tuneRows=[];
  const L=a=>LANG==="en"?a[1]:a[0];
  let h=`<div class="tune-head"><b>${LANG==="en"?"AI Tuning":"AI調整"}</b><button class="btn sm ghost" id="tuneClose" title="close">✕</button></div>`;
  h+=`<div class="tune-scroll"><div class="tune-note">${LANG==="en"?"Sliders change the AI live — evaluation values and the AI's next moves update immediately. Higher = the AI weights that factor more; 0 = ignored. Uncheck a row's box to drop that axis entirely (weight 0).":"スライダーは即座にAIへ反映（評価値も次の一手も即変化）。右ほどその要素を重く評価し、0で無視。各行の左のチェックを外すと、その評価軸を丸ごと無効化します（重み0）。"}</div>`;
  TUNE_GROUPS.forEach((g,gi)=>{
    h+=`<div class="tune-grp"><div class="tune-gt">${L(g.title)}</div>`;
    if(g.hint) h+=`<div class="tune-hint">${L(g.hint)}</div>`;
    (g.rows||[]).forEach((r,ri)=>{ const id=`tr_${gi}_${ri}`, v=r.get();
      const en = r.noIgnore ? `<span class="en-spacer"></span>` : `<input type="checkbox" class="en" id="en_${gi}_${ri}" checked title="${LANG==="en"?"Uncheck = AI ignores this axis":"外すとAIがこの軸を無視"}">`;
      h+=`<div class="tune-row" id="row_${gi}_${ri}">${en}<label for="${id}">${LANG==="en"?r.en:r.ja}</label><input type="range" id="${id}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><span class="tune-val" id="${id}v">${_tuneFmt(v)}</span></div>`; });
    (g.toggles||[]).forEach((r,ti)=>{ const id=`tt_${gi}_${ti}`;
      h+=`<div class="tune-row tog"><label for="${id}">${LANG==="en"?r.en:r.ja}</label><input type="checkbox" id="${id}" ${r.get()?"checked":""}></div>`; });
    h+=`</div>`;
  });
  h+=`</div><div class="tune-foot"><button class="btn sm" id="tuneReset">${LANG==="en"?"Reset":"リセット"}</button><button class="btn sm" id="tuneCopy">${LANG==="en"?"Copy settings":"設定をコピー"}</button></div>`;
  p.innerHTML=h;
  TUNE_GROUPS.forEach((g,gi)=>{
    (g.rows||[]).forEach((r,ri)=>{ const id=`tr_${gi}_${ri}`, el=$(id), vv=$(id+"v");
      el.oninput=()=>{ const v=parseFloat(el.value); r.set(v); vv.textContent=_tuneFmt(v); _tuneApplied(); };
      if(!r.noIgnore){ const cb=$(`en_${gi}_${ri}`), row=$(`row_${gi}_${ri}`);
        cb.onchange=()=>{
          if(cb.checked){ const rv=(_tuneStash[id]!=null)?_tuneStash[id]:r.def; r.set(rv); el.disabled=false; el.value=rv; vv.textContent=_tuneFmt(rv); row.classList.remove("off"); }
          else { _tuneStash[id]=r.get(); r.set(0); el.disabled=true; el.value=0; vv.textContent="OFF"; row.classList.add("off"); }
          _tuneApplied();
        }; }
      _tuneRows.push({el,vv,r,type:"range"}); });
    (g.toggles||[]).forEach((r,ti)=>{ const id=`tt_${gi}_${ti}`, el=$(id);
      el.onchange=()=>{ r.set(el.checked); _tuneApplied(); };
      _tuneRows.push({el,r,type:"tog"}); });
  });
  $("tuneClose").onclick=closeTune; $("tuneReset").onclick=resetTune; $("tuneCopy").onclick=copyTuneSettings;
}
function refreshTuneValues(){ _tuneRows.forEach(t=>{ if(t.type==="range"){ const v=t.r.get(); t.el.value=v; t.vv.textContent=_tuneFmt(v); } else { t.el.checked=!!t.r.get(); } }); }
function resetTune(){ TUNE_GROUPS.forEach(g=>{ (g.rows||[]).forEach(r=>r.set(r.def)); (g.toggles||[]).forEach(r=>r.set(r.def)); }); _tuneStash={}; buildTunePanel(); _tuneApplied(); toast(LANG==="en"?"Reset to defaults":"既定値に戻しました"); }
function copyTuneSettings(){
  const s=`// AI tuning — paste into engine.js (site) / zoo.js (benchmark)
BEST_W.resFactor={ore:${BEST_W.resFactor.ore}, wheat:${BEST_W.resFactor.wheat}, wood:${BEST_W.resFactor.wood}, brick:${BEST_W.resFactor.brick}, sheep:${BEST_W.resFactor.sheep}};
BEST_W.diversity=${BEST_W.diversity}; BEST_W.portBase=${BEST_W.portBase}; BEST_W.portMatch=${BEST_W.portMatch}; BEST_W.sameNumber=${BEST_W.sameNumber};
MODEL_BLEND=${MODEL_BLEND};
W_CITY=${W_CITY}; W_SETTLE=${W_SETTLE}; W_ROAD=${W_ROAD};
THREAT_W={vp:${THREAT_W.vp}, pip:${THREAT_W.pip}, city:0, dev:0, knight:${THREAT_W.knight}};
DANGER_VP=${DANGER_VP}; CONSERVE_ROADS=${CONSERVE_ROADS};`;
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(s).then(()=>toast(LANG==="en"?"Copied to clipboard":"クリップボードにコピーしました"), ()=>_tuneShowText(s)); }
  else _tuneShowText(s);
}
function _tuneShowText(s){ let b=$("tuneCopyBox"); if(!b){ b=document.createElement("textarea"); b.id="tuneCopyBox"; b.className="tune-copybox"; b.readOnly=true; const sc=$("tunePanel").querySelector(".tune-scroll")||$("tunePanel"); sc.appendChild(b); } b.value=s; b.style.display="block"; b.focus(); b.select(); toast(LANG==="en"?"Select & copy the text":"テキストを選択してコピー"); }
function openTune(){ buildTunePanel(); $("tunePanel").classList.add("open"); $("tuneBackdrop").classList.add("show"); $("tunePanel").setAttribute("aria-hidden","false"); _tuneOpen=true; }
function closeTune(){ $("tunePanel").classList.remove("open"); $("tuneBackdrop").classList.remove("show"); $("tunePanel").setAttribute("aria-hidden","true"); _tuneOpen=false; }
function toggleTune(){ _tuneOpen?closeTune():openTune(); }

/* ============================================================
   配線
   ============================================================ */
function afterHuman(){ aiMaybeGo(); }
function guardTurn(){ return game && isHuman(cur()); }
function wireControls(){
  $("rollBtnU").onclick  = ()=>{ if(guardTurn()){ doRoll(null); afterHuman(); } };
  $("buyDevU").onclick   = ()=>{ if(guardTurn()){ buyDev(); afterHuman(); } };
  $("knightU").onclick   = ()=>{ if(isHuman(cur())){ playDev("knight"); afterHuman(); } };
  $("roadsU").onclick    = ()=>{ if(isHuman(cur())){ playDev("roads"); afterHuman(); } };
  $("plentyU").onclick   = ()=>{ if(isHuman(cur())){ playDev("plenty"); afterHuman(); } };
  $("monoU").onclick     = ()=>{ if(isHuman(cur())){ playDev("mono"); afterHuman(); } };
  $("tradeBtnU").onclick = ()=>{ if(guardTurn()){ doTrade(); afterHuman(); } };
  $("endTurnU").onclick  = ()=>{ if(guardTurn()){ endTurnGame(); afterHuman(); } };

  $("pauseBtn").onclick=togglePause; $("evalBtn").onclick=toggleEval; $("winMeterBtn").onclick=toggleWinMeter;
  $("newBtn").onclick=newMatch; $("replayBtn").onclick=startReplay; $("exportBtn").onclick=exportRecord;
  { const _lb=$("loadBtn"); if(_lb) _lb.onclick=loadRecord;
    const _slb=$("startLoadBtn"); if(_slb) _slb.onclick=loadRecord;
    const _li=$("loadInput"); if(_li) _li.onchange=onLoadFile; }
  { const _cb=$("composerBtn"); if(_cb) _cb.onclick=startComposer;
    const _scb=$("startComposerBtn"); if(_scb) _scb.onclick=startComposer;
    const _cx=$("cpExit"); if(_cx) _cx.onclick=exitComposer;
    const _cs=$("cpShuffle"); if(_cs) _cs.onclick=composerShuffle;
    const _cbl=$("cpBlank"); if(_cbl) _cbl.onclick=composerBlank;
    const _ce=$("cpExport"); if(_ce) _ce.onclick=composerExport;
    document.querySelectorAll("#composerBar .cpp").forEach(b=>{ b.onclick=()=>setComposerPlayer(Number(b.dataset.cp)); }); }
  $("modeBtn").onclick=toggleMode; $("langBtn").onclick=toggleLang;
  { const _pm=$("placementModeBtn"); if(_pm) _pm.onclick=togglePlacementMode; updatePlacementModeButton(); }
  { const _tb=$("tuneBtn"); if(_tb) _tb.onclick=toggleTune;
    const _bd=$("tuneBackdrop"); if(_bd) _bd.onclick=closeTune;
    document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && _tuneOpen) closeTune(); }); }

  // 盤面を最優先で見たい時の全画面表示。参考UIの拡大ボタンと同じ役割。
  { const _bf=$("boardFocusBtn");
    if(_bf) _bf.onclick=()=>{
      const on=document.body.classList.toggle("board-focus");
      _bf.textContent=on?"×":"⛶";
      _bf.setAttribute("aria-label",on?"全画面表示を終了":"盤面を全画面表示");
      _bf.title=on?"全画面表示を終了":"盤面を全画面表示";
    }; }
  // 棋譜コメントは必要な時だけ展開し、通常時の盤面高さを奪わない。
  { const _nt=$("noteToggle"), _nb=$("liveNoteBox");
    if(_nt&&_nb) _nt.onclick=()=>{
      const on=_nb.classList.toggle("open");
      _nt.classList.toggle("on",on);
      _nt.textContent=on?"× コメントを閉じる":"✎ コメント";
    }; }

  // 「⋯」二次操作メニュー（スマホ用ドロップダウン）
  const menuBtn=$("menuBtn"), topMenu=$("topMenu");
  if(menuBtn && topMenu){
    menuBtn.onclick=(e)=>{ e.stopPropagation(); const open=topMenu.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", open?"true":"false"); };
    topMenu.querySelectorAll(".btn").forEach(b=> b.addEventListener("click", closeTopMenu));
    document.addEventListener("click",(e)=>{ if(topMenu.classList.contains("open") && !e.target.closest(".menuwrap")) closeTopMenu(); });
  }

  $("speedRange").oninput=(e)=>setSpeed(parseFloat(e.target.value));
  $("shuffleBtn").onclick=()=>{ randomBoard(); randomPorts(); render(); toast(t("toast_shuffle")); };
  $("startBtn").onclick=startMatch;

  $("rvPrev").onclick=()=>{ if(replay){ stopRvPlay(); replay.idx=Math.max(0,replay.idx-1); showReplayTurn(); } };
  $("rvNext").onclick=()=>{ if(replay){ stopRvPlay(); replay.idx=Math.min(replay.turns.length-1,replay.idx+1); showReplayTurn(); } };
  $("rvPlay").onclick=toggleRvPlay; $("rvExit").onclick=exitReplayU;

  document.querySelectorAll("#tabBar .tabbtn").forEach(b=>{ b.onclick=()=>setMobileTab(b.dataset.tab); });
}

/* ============================================================
   初期化
   ============================================================ */
window.addEventListener("DOMContentLoaded", ()=>{
  uiMode = (window.innerWidth < 760) ? "mobile" : "pc";
  buildTradeSelects();
  wireControls();
  applyMode();
  setSpeed(1.0);
  applyLang();       // 全テキスト適用 + 開始画面構築
  updatePauseBtn();
  render();          // 開始画面の裏に盤面プレビュー
});
