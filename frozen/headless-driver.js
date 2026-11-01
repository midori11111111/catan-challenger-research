// Opt-in research execution only. Never sets _inPlayout: that disables real policy.
EVAL_LOG = false;
_recAct = function(o) {
  if (!game) return;
  // Preserve machine-readable actions and the existing research capture contract.
  // Do not build board images, human messages, or four win-gauge estimates per move.
  if (Array.isArray(game._researchCapture)) game._researchCapture.push(JSON.parse(JSON.stringify(o)));
  if (!game._acts) game._acts = [];
  game._acts.push(o);
  game._actionLogMark = game.log.length;
};
_snapSetupStep = function(sp) {
  if (!game) return;
  game.turns.push({setup:true, player:sp, actions:game._acts || []});
  game._logMark = game.log.length;
  game._actionLogMark = game.log.length;
  game._acts = [];
  game._actionFrames = [];
};

// Immutable topology only. Return a new array like the original API; no state cache.
const simHexVertices = new Map();
for (const [v, hs] of Object.entries(GEO.vertex_hexes)) {
  for (const h of hs) {
    if (!simHexVertices.has(h)) simHexVertices.set(h, []);
    simHexVertices.get(h).push(Number(v));
  }
}
hexVertsG = hid => (simHexVertices.get(Number(hid)) || []).slice();

// Exact edge-simple longest trail: loops and repeated vertices remain legal.
// <=15 pieces fit in an integer mask. Do not memoize mutable occupancy/road state.
const simOriginalLongestRoad = longestRoadOf;
longestRoadOf = function(p) {
  const roads = placements[p].roads;
  if (roads.size > 30) return simOriginalLongestRoad(p);
  const adj = [], vertices = [], blocked = [];
  let index = 0;
  for (const id of roads) {
    const e = GEO.edges[id], bit = 1 << index++;
    for (const [v, other] of [[e.a, e.b], [e.b, e.a]]) {
      if (!adj[v]) {
        adj[v] = [];
        vertices.push(v);
        const oc = occupantOf(v);
        blocked[v] = !!(oc && oc.p !== p);
      }
      adj[v].push([other, bit]);
    }
  }
  let best = 0;
  function visit(v, used, len) {
    if (len > best) best = len;
    if (len && blocked[v]) return;
    for (const [other, bit] of adj[v]) {
      if (!(used & bit)) visit(other, used | bit, len + 1);
    }
  }
  for (const v of vertices) visit(v, 0, 0);
  return best;
};
module.exports.headlessInfo = {replayFrames:false, evaluationLabels:false,
  structuredActions:true, approximateRules:false, policyShortcuts:false};
