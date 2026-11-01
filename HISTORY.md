# Evaluation revisions

## Exploratory pilot 1: one Challenger, three native opponents

192 games; 32 per generation/opponent pair. Native AlphaBeta used action pruning. Initial setup conversion contained the directed-road counting error described below. The stored outcomes are retained as historical observations, not primary confirmation evidence.

## Exploratory pilot 2: two Challenger, two native opponents

The final v3 pilot had 288 completed games, 48 per group, and no reported illegal-action errors. Earlier debugging batches identified Road Building ordering and no-legal-road differences. The v3 pilot still contained the setup-step conversion error. This distinction matters: no illegal action is not proof that all policy input features match the intended game state.

## Publication audit and confirmation

Catanatron serializes a road in both directions. The old conversion computed `roadsDone = state.board.roads.length`, then used it for the snake-order setup step. Physical roads and runtime road sets were de-duplicated in other places, so simple legality tests did not expose the incorrect setup feature. The corrected conversion de-duplicates before deriving setup step and checks that the derived snake-order seat equals the engine's current seat.

Verification now tests all 16 settlement/road decisions on 12 independent initial boards (192 snapshots), own hands, topology and ports, hidden-information invariance, real-RNG noninterference, and two Road Building boundary cases. The confirmation uses new seeds, unpruned AlphaBeta, a frozen corrected bridge, and 600 games per group. Pilot and confirmation observations are never pooled. Any difference from a pilot rate includes a protocol/adapter change and is not a measured learning gain.

All gen0/gen1/gen2 configurations already contain learned opening weights. gen0 is not a no-learning control. A trained neural score is not automatically a calibrated action win probability. These distinctions are reflected in the report and README.

## v4 campaign withdrawn; corrected v5 confirmation

The initial 3,600-game campaign stopped after 2,714 completed games and one 20-second transport timeout. Before publication, replay auditing demonstrated a second validity problem: an ongoing game could be projected into a state where an opponent's sampled hidden VP cards already gave ten points. Stock AlphaBeta then stopped at that phantom terminal root. All v4 observations, including fully completed groups, are excluded from the corrected confirmation. The raw records remain in the local audit archive, not the publication ZIP; `history/withdrawn-v4.json` publishes counts and hashes, and the failing state and old source snapshot are included. They are not evidence of superiority.

v5 samples hidden development cards conditional on each opponent having fewer than ten total points in the observed ongoing Catanatron game. The sampler weights feasible VP allocations by the product of combination counts, then distributes non-VP cards and shuffles the hypothetical deck. The Challenger's own reconstructed point estimate is constrained similarly. A regression replays a real nonterminal state and checks 512 native samples plus 64 Challenger reconstructions. No real opponent private hand or future RNG is used.

Transport waits now allow 120 active-wait seconds and ignore large suspension gaps. This is an operational guard, not a tuned strategy coefficient. The stock native AlphaBeta search retains its 20-second wall-clock deadline.

The revised, freshly seeded confirmation focuses on the pre-existing public default gen0, rather than selecting the best old rate: two opponents, 600 games each, 1,200 total, all six seat pairs represented 100 times per opponent. The two-group simultaneous Hoeffding half-width is approximately 6.04 percentage points. gen1/gen2 comparisons are outside the final confirmation claim. Policy weights and strategic coefficients remain unchanged.
