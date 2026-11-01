// Confirmed setup-policy overlay. It changes setup only; the main-game policy remains identical.
// Disable SETUP_LEARNED_ENABLED to return immediately to the previous setup policy.
let SETUP_LEARNED_ENABLED = true;

function _slPredict(wrapper, feat) {
  if (!wrapper || !wrapper.model || !wrapper.featureNames) return null;
  const m = wrapper.model;
  const x = wrapper.featureNames.map(name => Number(feat[name]) || 0);
  if (x.length !== m.dim) return null;
  const z = x.map((value, i) => Math.max(-8, Math.min(8, (value - m.mu[i]) / m.sd[i])));
  const hidden = m.b1.map((bias, j) => Math.tanh(
    bias + z.reduce((sum, value, i) => sum + value * m.w1[j * m.dim + i], 0)
  ));
  const logit = m.b2[0] + hidden.reduce((sum, value, j) => sum + value * m.w2[j], 0);
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, logit))));
}

function _slVertexLocal(v) {
  const out = {}, rp = { wood:0, brick:0, sheep:0, wheat:0, ore:0 }, nums = {};
  let pip = 0;
  for (const hid of (GEO.vertex_hexes[String(v)] || [])) {
    const b = board[hid];
    if (!b || !b.number || b.resource === "desert") continue;
    const q = pipOf(b.number);
    pip += q; rp[b.resource] += q; nums[b.number] = (nums[b.number] || 0) + 1;
  }
  for (const r of RES5) out[`candidate_pip_${r}`] = rp[r];
  out.candidate_pip = pip;
  out.candidate_resources = RES5.filter(r => rp[r] > 0).length;
  out.candidate_numbers = Object.keys(nums).length;
  out.candidate_duplicate = Object.values(nums).reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  let port = null;
  for (const [eid, type] of Object.entries(ports)) {
    const edge = GEO.edges[Number(eid)];
    if (edge && (edge.a === v || edge.b === v)) { port = type; break; }
  }
  out.candidate_port3 = port === "3:1" ? 1 : 0;
  out.candidate_specific_port = port && port !== "3:1" ? 1 : 0;
  out.candidate_port_match = port && port !== "3:1" && rp[port] > 0 ? 1 : 0;
  return out;
}

function _slBoardSupply() {
  const supply = { wood:0, brick:0, sheep:0, wheat:0, ore:0 };
  for (const h of GEO.hexes) {
    const b = board[h.id];
    if (b && b.number && supply[b.resource] != null) supply[b.resource] += pipOf(b.number);
  }
  return supply;
}

function _slSeatPortfolio(p) {
  const rp = { wood:0, brick:0, sheep:0, wheat:0, ore:0 }, numPip = {}, portTypes = new Set();
  let total = 0, maxTile = 0;
  for (const v of placements[p].settlements) {
    for (const hid of (GEO.vertex_hexes[String(v)] || [])) {
      const b = board[hid];
      if (!b || !b.number || rp[b.resource] == null) continue;
      const value = pipOf(b.number);
      rp[b.resource] += value; numPip[b.number] = (numPip[b.number] || 0) + value;
      total += value; maxTile = Math.max(maxTile, value);
    }
    for (const [eid, type] of Object.entries(ports)) {
      const edge = GEO.edges[Number(eid)];
      if (edge && (edge.a === v || edge.b === v)) portTypes.add(type);
    }
  }
  const specific = [...portTypes].filter(type => type !== "3:1" && rp[type] != null);
  const portConvert = Math.max(portTypes.has("3:1") ? total / 3 : 0, ...specific.map(r => rp[r] / 2), 0);
  const portSynergy = specific.reduce((sum, r) => sum + rp[r], 0);
  const supply = _slBoardSupply();
  let scarcity = 0, scarceWB = 0;
  for (const r of RES5) {
    const value = supply[r] > 0 ? rp[r] / supply[r] : 0;
    scarcity += value;
    if (r === "wood" || r === "brick") scarceWB += value;
  }
  const wbMin = Math.min(rp.wood, rp.brick), owMin = Math.min(rp.ore, rp.wheat);
  const maxRes = Math.max(...RES5.map(r => rp[r])), maxNum = Math.max(0, ...Object.values(numPip));
  const cityRate = Math.min(rp.ore / 3, rp.wheat / 2);
  const cardRate = Math.min(rp.ore, rp.wheat, rp.sheep);
  const roadRate = wbMin, settleRate = Math.min(rp.wood, rp.brick, rp.sheep, rp.wheat);
  return {
    rp, total, distinctRes:RES5.filter(r => rp[r] > 0).length, distinctNum:Object.keys(numPip).length,
    missingWood:rp.wood === 0 ? 1 : 0, missingBrick:rp.brick === 0 ? 1 : 0,
    missingWB:(rp.wood === 0 || rp.brick === 0) ? 1 : 0, wbMin, wbSum:rp.wood + rp.brick,
    owMin, owSum:rp.ore + rp.wheat, owsSum:rp.ore + rp.wheat + rp.sheep,
    cityRate, cardRate, roadRate, settleRate,
    effectiveRoad:Math.min(rp.wood + portConvert, rp.brick + portConvert),
    effectiveSettle:Math.min(rp.wood + portConvert, rp.brick + portConvert, rp.sheep + portConvert, rp.wheat + portConvert),
    port3:portTypes.has("3:1") ? 1 : 0, specificPort:specific.length ? 1 : 0, portConvert, portSynergy,
    missingWithPort:(rp.wood === 0 || rp.brick === 0) && portConvert > 0 ? 1 : 0,
    missingNoPort:(rp.wood === 0 || rp.brick === 0) && portConvert === 0 ? 1 : 0,
    scarcity, scarceWB, resourceConcentration:total ? maxRes / total : 0,
    numberConcentration:total ? maxNum / total : 0, maxTile
  };
}

function _slPortfolioFeatures(p) {
  const all = {};
  for (let q = 1; q <= 4; q++) all[q] = _slSeatPortfolio(q);
  const own = all[p], opp = [1,2,3,4].filter(q => q !== p).map(q => all[q]), x = {};
  const avg = key => opp.reduce((sum, item) => sum + (item[key] || 0), 0) / 3;
  const max = key => Math.max(...opp.map(item => item[key] || 0));
  for (const r of RES5) x[`pip_${r}`] = own.rp[r];
  const keys = ["total","distinctRes","distinctNum","missingWood","missingBrick","missingWB","wbMin","wbSum","owMin","owSum","owsSum","cityRate","cardRate","roadRate","settleRate","effectiveRoad","effectiveSettle","port3","specificPort","portConvert","portSynergy","missingWithPort","missingNoPort","scarcity","scarceWB","resourceConcentration","numberConcentration","maxTile"];
  for (const key of keys) x[key] = own[key];
  x.missing_x_convert = own.missingWB * own.portConvert;
  x.missing_x_card = own.missingWB * own.cardRate;
  x.port_x_concentration = own.specificPort * own.resourceConcentration;
  x.port_x_synergy = own.specificPort * own.portSynergy;
  x.card_route = own.cardRate + 0.5 * own.cityRate;
  x.road_route = own.roadRate + 0.5 * own.settleRate;
  for (const key of ["total","cityRate","cardRate","roadRate","effectiveRoad","effectiveSettle","portConvert","scarcity"]) {
    x[`rel_avg_${key}`] = own[key] - avg(key);
    x[`rel_max_${key}`] = own[key] - max(key);
  }
  for (let q = 1; q <= 4; q++) x[`seat_${q}`] = p === q ? 1 : 0;
  return x;
}

function _slOccupiedVertex(v) {
  for (let q = 1; q <= 4; q++) if (placements[q].settlements.has(v) || placements[q].cities.has(v)) return q;
  return null;
}
function _slOwnedRoad(eid) {
  for (let q = 1; q <= 4; q++) if (placements[q].roads.has(eid)) return q;
  return null;
}
function _slLegalFutureSettlement(v) {
  if (_slOccupiedVertex(v)) return false;
  for (const n of (GEO.vertex_neighbors[String(v)] || [])) if (_slOccupiedVertex(n)) return false;
  return true;
}
function _slRoadDistances(p, maxD = 6) {
  const distances = new Map(), todo = [];
  for (const v of [...placements[p].settlements, ...placements[p].cities]) { distances.set(v, 0); todo.push(v); }
  while (todo.length) {
    todo.sort((a,b) => distances.get(a) - distances.get(b));
    const v = todo.shift(), dv = distances.get(v);
    if (dv >= maxD) continue;
    if (_slOccupiedVertex(v) && _slOccupiedVertex(v) !== p && dv > 0) continue;
    for (const edge of GEO.edges) {
      if (edge.a !== v && edge.b !== v) continue;
      const owner = _slOwnedRoad(edge.id);
      if (owner && owner !== p) continue;
      const next = edge.a === v ? edge.b : edge.a, nd = dv + (owner === p ? 0 : 1);
      if (nd <= maxD && (!distances.has(next) || nd < distances.get(next))) {
        distances.set(next, nd); todo.push(next);
      }
    }
  }
  return distances;
}

function _slExpansionFeatures(p) {
  const distances = _slRoadDistances(p, 6), portfolio = _slSeatPortfolio(p);
  let best1 = 0, best2 = 0, best3 = 0, p3 = 99, specific = 99, bestPortGain = 0;
  for (const [v, distance] of distances) {
    if (!_slLegalFutureSettlement(v)) continue;
    const pip = _slVertexLocal(v).candidate_pip;
    if (distance <= 1) best1 = Math.max(best1, pip);
    if (distance <= 2) best2 = Math.max(best2, pip);
    if (distance <= 3) best3 = Math.max(best3, pip);
    let port = null;
    for (const [eid, type] of Object.entries(ports)) {
      const edge = GEO.edges[Number(eid)];
      if (edge && (edge.a === v || edge.b === v)) { port = type; break; }
    }
    if (port === "3:1") p3 = Math.min(p3, distance);
    else if (port && RES5.includes(port)) {
      specific = Math.min(specific, distance);
      bestPortGain = Math.max(bestPortGain, (portfolio.rp[port] || 0) / 2);
    }
  }
  return { expand_pip_1:best1, expand_pip_2:best2, expand_pip_3:best3,
    future_port3_roads:p3, future_specific_roads:specific, future_port_gain:bestPortGain };
}

function _slActionFeature(p, v, B) {
  const added = !placements[p].settlements.has(v);
  if (added) placements[p].settlements.add(v);
  let x;
  try { x = { ..._slPortfolioFeatures(p), ..._slVertexLocal(v) }; }
  finally { if (added) placements[p].settlements.delete(v); }
  const ranked = B && B.ranked ? B.ranked : [], rank = Math.max(0, ranked.indexOf(v));
  x.setup_step = game.setup.step;
  x.is_second = placements[p].settlements.size ? 1 : 0;
  x.base_rank = rank;
  x.base_rank_frac = rank / Math.max(1, ranked.length - 1);
  x.base_score = B && B.scores && B.scores[v] ? B.scores[v].score : 0;
  x.legal_count = ranked.length;
  return x;
}

function _slCompleteFeature(p, extraInitialVertex = null) {
  const x = { ..._slPortfolioFeatures(p), ..._slExpansionFeatures(p) };
  const extra = { wood:0, brick:0, sheep:0, wheat:0, ore:0 };
  if (extraInitialVertex != null) for (const hid of (GEO.vertex_hexes[String(extraInitialVertex)] || [])) {
    const b = board[hid];
    if (b && b.resource && extra[b.resource] != null) extra[b.resource]++;
  }
  for (const r of RES5) x[`start_${r}`] = ((game.hands[p] && game.hands[p][r]) || 0) + extra[r];
  x.start_total = RES5.reduce((sum, r) => sum + x[`start_${r}`], 0);
  x.setup_seat = p;
  return x;
}

function _slCompleteCandidateFeature(p, v, B) {
  placements[p].settlements.add(v);
  let eid = null, hadRoad = false;
  try {
    const roads = bestRoadFrom(v, true, p);
    if (roads.length) {
      eid = roads[0].eid; hadRoad = placements[p].roads.has(eid);
      if (!hadRoad) placements[p].roads.add(eid);
    }
    const x = _slCompleteFeature(p, v), rank = B.ranked.indexOf(v);
    x.second_base_rank = rank;
    x.second_base_rank_frac = rank / Math.max(1, B.ranked.length - 1);
    x.second_base_score = B.scores[v] ? B.scores[v].score : 0;
    return x;
  } finally {
    if (eid != null && !hadRoad) placements[p].roads.delete(eid);
    placements[p].settlements.delete(v);
  }
}

function _slModelRankPick(B, p, model, blend) {
  const rows = B.ranked.slice(0, 12).map((v, baseRank) => ({ v, baseRank, q:_slPredict(model, _slActionFeature(p, v, B)) }));
  if (!rows.length) return null;
  const base = rows[0], modelBest = rows.reduce((a,b) => (b.q ?? -Infinity) > (a.q ?? -Infinity) ? b : a, rows[0]);
  const margin = model.overrideMargin === "Infinity" ? Infinity : Number(model.overrideMargin || 0);
  if (modelBest !== base && ((modelBest.q ?? -Infinity) - (base.q ?? -Infinity)) <= margin) return base.v;
  rows.sort((a,b) => (b.q ?? -Infinity) - (a.q ?? -Infinity));
  rows.forEach((row, i) => { row.modelRank = i; });
  const den = Math.max(1, rows.length - 1);
  for (const row of rows) row.combined = -(1 - blend) * row.baseRank / den - blend * row.modelRank / den;
  rows.sort((a,b) => b.combined - a.combined || a.baseRank - b.baseRank);
  return rows[0].v;
}

function _slWithoutPairEffects(fn) {
  const hadDecision = Object.prototype.hasOwnProperty.call(game, "setupPairDecision"), savedDecision = game.setupPairDecision;
  const hadIntents = Object.prototype.hasOwnProperty.call(game, "setupPairIntents"), savedIntents = game.setupPairIntents;
  try { return fn(); }
  finally {
    if (hadDecision) game.setupPairDecision = savedDecision; else delete game.setupPairDecision;
    if (hadIntents) game.setupPairIntents = savedIntents; else delete game.setupPairIntents;
  }
}

function _slCurrentPairPick(p, B) {
  return _slWithoutPairEffects(() => setupPairPick(p, B, B.ranked[0]));
}

function _slCompleteRankPick(B, p, model, blend) {
  const ids = B.ranked.slice(0, 20);
  for (const v of B.ranked) if (!ids.includes(v) && (B.scores[v].port || B.scores[v].pip >= 11)) ids.push(v);
  const baseline = _slCurrentPairPick(p, B), baselineOrder = [baseline, ...ids.filter(v => v !== baseline)];
  const rows = ids.map(v => ({ v, baseRank:baselineOrder.indexOf(v), q:_slPredict(model, _slCompleteCandidateFeature(p, v, B)) }));
  const base = rows.find(row => row.v === baseline);
  const modelBest = rows.reduce((a,b) => (b.q ?? -Infinity) > (a.q ?? -Infinity) ? b : a, rows[0]);
  const margin = model.overrideMargin === "Infinity" ? Infinity : Number(model.overrideMargin || 0);
  if (modelBest !== base && ((modelBest.q ?? -Infinity) - (base.q ?? -Infinity)) <= margin) return setupPairPick(p, B, B.ranked[0]);
  rows.sort((a,b) => (b.q ?? -Infinity) - (a.q ?? -Infinity));
  rows.forEach((row, i) => { row.modelRank = i; });
  const den = Math.max(1, rows.length - 1);
  for (const row of rows) row.combined = -(1 - blend) * row.baseRank / den - blend * row.modelRank / den;
  rows.sort((a,b) => b.combined - a.combined || a.baseRank - b.baseRank);
  return rows[0].v === baseline ? setupPairPick(p, B, B.ranked[0]) : rows[0].v;
}

function setupLearnedBundle(p) {
  const kind = typeof seatAI !== "undefined" && seatAI ? seatAI[p] : null;
  const generation = kind === "gen1" || kind === "gen2" ? kind : "gen0";
  if (typeof SETUP_LEARNED_GENERATIONS !== "undefined") return SETUP_LEARNED_GENERATIONS[generation] || null;
  return generation === "gen0" && typeof SETUP_LEARNED_BUNDLE !== "undefined" ? SETUP_LEARNED_BUNDLE : null;
}

function setupLearnedPick(p, B, defaultId) {
  const bundle = setupLearnedBundle(p);
  const fallback = () => typeof setupPairPick === "function" ? setupPairPick(p, B, defaultId) : defaultId;
  if (!SETUP_LEARNED_ENABLED || !bundle || !bundle.meta || !bundle.meta.enabled) return fallback();
  const blend = Number(bundle.meta.blend);
  try {
    if (placements[p].settlements.size === 0) return _slModelRankPick(B, p, bundle.action, blend) ?? fallback();
    if (p === 1 && placements[p].settlements.size === 1 && game.setup.step === 7) {
      return _slCompleteRankPick(B, p, bundle.complete, blend) ?? fallback();
    }
    return fallback();
  } catch (error) {
    console.warn("setup learning fallback", error);
    return fallback();
  }
}

function setupLearnedInfo(p) {
  const bundle = setupLearnedBundle(p);
  return bundle ? { ...bundle.meta, enabled:SETUP_LEARNED_ENABLED && bundle.meta.enabled } : { enabled:false };
}
