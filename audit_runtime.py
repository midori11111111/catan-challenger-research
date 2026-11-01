"""Read-only decision probes compare actual RNG getstate(), not just JSON."""
import json
from pathlib import Path

from catanatron import Game, RandomPlayer
from catanatron.serialization import state_to_json
from confirmation import ConfirmationOpponent
from run import COLORS, ROOT, Ours


def main():
    checks=[]
    for seed in [531031,531032,531033]:
        g=Game([RandomPlayer(c) for c in COLORS],seed=seed)
        # Probe one opening decision and one main-game decision per seed.
        for phase in ['setup','main']:
            if phase=='main':
                for _ in range(16):g.play_tick()
                while not g.state.player_state[f'P{g.state.current_player_index}_HAS_ROLLED']:
                    g.play_tick()
            color=g.state.current_color()
            before=state_to_json(g)
            rng=g.random.getstate();state_rng=g.state.random.getstate()
            native=ConfirmationOpponent(color,'AB_FULL',seed+33)
            assert native.decide(g,g.playable_actions) in g.playable_actions
            assert g.random.getstate()==rng and g.state.random.getstate()==state_rng
            assert state_to_json(g)==before
            ours=Ours(color,'gen1',seed+55,ROOT/'runtime-audit-error.local.json')
            try:
                ours.before(g)
                assert ours.decide(g,g.playable_actions) in g.playable_actions
                assert g.random.getstate()==rng and g.state.random.getstate()==state_rng
                assert state_to_json(g)==before
            finally:ours.close()
            checks.append({'seed':seed,'phase':phase,'nativeAndChallengerPreserveStateAndExactRng':True})
    result={'passed':True,'exactRngStateCompared':True,'probes':checks}
    (ROOT/'verification-runtime.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))


if __name__=='__main__':main()
