"""Sample unknown development cards conditional on an observed ongoing game."""
from itertools import product
from math import comb


def sample_development_hands(unseen, counts, vp_caps, deck_size, rng):
    assert sum(counts)+deck_size==len(unseen)
    vp_total=unseen.count('VICTORY_POINT')
    options=[];total=0
    for allocation in product(*(range(min(n,cap,vp_total)+1) for n,cap in zip(counts,vp_caps))):
        left=vp_total-sum(allocation)
        if not 0<=left<=deck_size:continue
        weight=comb(deck_size,left)
        for n,k in zip(counts,allocation):weight*=comb(n,k)
        if weight:options.append((allocation,left,weight));total+=weight
    if not total:raise ValueError('No development-card allocation consistent with a nonterminal game')
    ticket=rng.randrange(total)
    for allocation,left,weight in options:
        if ticket<weight:break
        ticket-=weight
    pool=[c for c in unseen if c!='VICTORY_POINT'];rng.shuffle(pool)
    hands=[]
    for n,k in zip(counts,allocation):
        hand=['VICTORY_POINT']*k+pool[:n-k];del pool[:n-k];hands.append(hand)
    deck=pool+['VICTORY_POINT']*left;rng.shuffle(deck)
    assert len(deck)==deck_size
    return hands,deck
