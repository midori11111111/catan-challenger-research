"""Build two publication reports from stored outcomes. No invented results.

Run with the PDF dependencies installed. CATAN_REPORT_FONT may select a
Japanese-capable TrueType font; the font file itself is not redistributed.
"""
from datetime import date
from html import escape
import json
import math
import os
from pathlib import Path
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Circle, Polygon
from reportlab.graphics import renderSVG

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

INK=colors.HexColor('#15252D')
TEAL=colors.HexColor('#146B62')
MUTED=colors.HexColor('#52636B')
LIGHT=colors.HexColor('#E8F0EF')
GRAY=colors.HexColor('#C7D1D5')
WIDTH=A4[0]-104


def register_fonts():
    candidates=[os.environ.get('CATAN_REPORT_FONT',''),
                '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
                '/Library/Fonts/Arial Unicode.ttf']
    path=next((Path(p) for p in candidates if p and Path(p).exists()),None)
    if path is None:
        raise RuntimeError('Set CATAN_REPORT_FONT to a Japanese-capable TrueType font.')
    pdfmetrics.registerFont(TTFont('Research',str(path)))


def arrow(d,x1,y1,x2,y2):
    d.add(Line(x1,y1,x2,y2,strokeColor=MUTED,strokeWidth=.8))
    angle=math.atan2(y2-y1,x2-x1)
    pts=[x2,y2,x2-5*math.cos(angle-.45),y2-5*math.sin(angle-.45),x2-5*math.cos(angle+.45),y2-5*math.sin(angle+.45)]
    d.add(Polygon(pts,fillColor=MUTED,strokeColor=MUTED))


def architecture():
    d=Drawing(WIDTH,152)
    def box(x,y,w,h,lines):
        d.add(Rect(x,y,w,h,rx=3,fillColor=LIGHT,strokeColor=GRAY,strokeWidth=.6))
        for i,line in enumerate(lines):
            d.add(String(x+w/2,y+h-14-12*i,line,fontName='Helvetica',fontSize=8.5,textAnchor='middle',fillColor=INK))
    box(0,96,WIDTH,43,['Own hand + public board / totals / card counts','Independent information projection for each player'])
    box(0,30,WIDTH/2-10,44,['Challenger x2','Learned opening ranks + published rules'])
    box(WIDTH/2+10,30,WIDTH/2-10,44,['Catanatron x2','Unpruned depth-2 AlphaBeta or ValueFunction'])
    arrow(d,WIDTH/4,96,WIDTH/4,75);arrow(d,3*WIDTH/4,96,3*WIDTH/4,75)
    d.add(String(WIDTH/2,6,'Legal action -> Catanatron rules engine -> recorded terminal outcome',fontName='Helvetica',fontSize=8.4,textAnchor='middle',fillColor=MUTED))
    arrow(d,WIDTH/4,30,WIDTH/4,18);arrow(d,3*WIDTH/4,30,3*WIDTH/4,18)
    return d


def forest(summary):
    d=Drawing(WIDTH,145)
    left,right=111,WIDTH-12
    def x(v):return left+(right-left)*v
    for value in [0,.25,.5,.75,1.]:
        d.add(Line(x(value),33,x(value),119,strokeColor=GRAY,strokeWidth=.4))
        d.add(String(x(value),19,f'{int(value*100)}%',fontName='Helvetica',fontSize=8,textAnchor='middle',fillColor=MUTED))
    d.add(Line(x(.5),33,x(.5),119,strokeColor=colors.HexColor('#A86A35'),strokeWidth=1,strokeDashArray=[3,3]))
    by={(g['generation'],g['opponent']):g for g in summary}
    for index,(gen,opp) in enumerate((g,o) for g in ('gen0',) for o in ('AB_FULL','F')):
        y=101-index*37
        label=f'{gen} / '+('AB2' if opp=='AB_FULL' else 'VF')
        d.add(String(0,y-3,label,fontName='Helvetica',fontSize=9,fillColor=INK))
        g=by.get((gen,opp))
        if not g or not g['games']:continue
        lo,hi=g['familywiseHoeffding95'];a,b=g['ci95'];p=g['winRate']
        d.add(Line(x(lo),y,x(hi),y,strokeColor=GRAY,strokeWidth=5))
        d.add(Line(x(a),y,x(b),y,strokeColor=TEAL,strokeWidth=1.8))
        d.add(Circle(x(p),y,3,fillColor=TEAL,strokeColor=TEAL))
    d.add(String(left,132,'Win probability of either Challenger player',fontName='Helvetica',fontSize=9,fillColor=INK))
    d.add(String(left,2,'Thin: Wilson 95%  |  Wide gray: simultaneous Hoeffding 95%',fontName='Helvetica',fontSize=7.3,fillColor=MUTED))
    return d


def content(lang,complete,rows,summary):
    n=len([r for r in rows if r['status']=='completed'])
    passed=sum(bool(g.get('confirmedAdvantage')) for g in summary)
    rates=[g['winRate'] for g in summary if g['games']]
    span=f'{min(rates)*100:.1f}% to {max(rates)*100:.1f}%' if rates else 'not yet measured'
    status=('completed' if complete else 'in progress; interim results, not a final claim')
    if lang=='en':
        return {
          'title':'Catan Challenger: Evaluating a Heuristic Policy with Learned Opening Rankings against Catanatron',
          'subtitle':'Technical report v0.1.0 | October 31, 2026 | Not peer-reviewed',
          'abstract':f'We present a reproducible engineering evaluation of Catan Challenger, a published policy combining human-informed main-game decisions with learned opening rankings. The frozen, pre-existing public default (gen0) is evaluated in four-player games containing two Challenger agents and two external agents. A fixed-budget confirmation specifies 600 independent games per opponent, totaling 1,200 games, with all six seat-pair assignments balanced. Opponents are base ValueFunction and unpruned depth-2 AlphaBeta, under explicit public-information wrappers. The corrected bridge has completed {n:,} games ({status}). '+(f'Observed group win rates range from {span}; {passed}/2 groups meet the predeclared simultaneous superiority criterion. ' if complete else '')+'We release inference code, trained weights, a versioned adapter, protocol, and synthetic game records. Claims concern these opponents and conditions; no claim of world-best or expert-human strength is made.',
          'p1':[
            ('1. Motivation and contribution','Catan combines stochastic production, hidden cards, growth investments, and contested awards. A useful evaluation must distinguish policy strength from seat advantage, information access, and interface errors. Our contribution is an inspectable external evaluation artifact, rather than a new proof of optimal play.'),
            ('Executable policy, offline learning','The production policy executes ordinary code. Its neural component ranks selected opening settlements; its main-game actions use strategic evaluation and tactical planning. No language-model API is invoked during a game. AI coding assistance was used in development and drafting.'),
            ('Evaluation boundary','We evaluate the already-trained public default without modifying its weights on confirmation games. Other generations are bundled for inspection, not ranked here. The inference and evaluation are reproducible from the artifact. Reproducing the complete historical training process is outside the release scope.')],
          'p2':[
            ('2. Policy and opening model','All three configurations use the same published main-game settings. gen0 already contains generation-0 learned weights with rank mixture 0.5; gen1 uses generation-1 weights with mixture 1.0; gen2 uses generation-2 weights with mixture 0.5. These are different models and mixtures, not a clean learned-versus-unlearned ablation.'),
            ('Opening score','The action network takes 77 standardized features, applies one 20-unit tanh hidden layer, then a sigmoid output. A separate completed-opening network takes 75 features and has the same hidden width. Inputs describe resource/number production, concentration, ports, scarcity, opponent-relative portfolios, and candidate/base rank. The completed-opening features include expansion access and initial resources.'),
            ('Prediction and rank mixing','For features f, z = clip((f - mu) / sd, -8, 8); h = tanh(W1 z + b1); q = sigmoid(clip(W2 h + b2, -30, 30)). Candidates are sorted by q. Selection minimizes (1 - lambda) r_base / (K - 1) + lambda r_model / (K - 1), subject to the stored override margin. q is a ranking signal, not a calibrated probability that an individual action wins.'),
            ('Where the model is used','For each seat, the first-settlement selector reranks up to 12 base candidates. A completed-opening selector applies to seat 1 at its final second settlement, using a larger candidate set. Other second settlements use the existing pair-placement baseline. A 50% mixture means equal weight on normalized ranks, not randomized activation on half of turns.'),
            ('Main-game decisions','The policy evaluates cities, settlements, roads, development cards, exchanges, and waiting. It includes production-aware resource use, route/port goals, contested-award reasoning, robber selection, and hand compression. It repeatedly searches for a winning sequence within its reconstructed state, including exchanges, builds, cards and awards. Foreign-engine or belief differences can invalidate the forecast. The optional rollout-only invincible setting is not evaluated here.'),
            ('Limits of mechanism claims','This evaluation can establish external performance of frozen configurations. It does not by itself show that learned placement caused the measured advantage, that every opening is handled well, or that the neural score is calibrated. A matched no-learning ablation and direct human evaluation remain separate experiments.')],
          'p3':[
            ('3. Fixed confirmation protocol','We predeclare two groups: public-default gen0 against each of two opponents. Each group has 600 games; Challenger occupies each of the six possible two-seat subsets 100 times. Each game uses a new seed. Seed selection inspects only the seating draw, never the board, dice, or outcome. Each player seeks its own ten points; the two Challenger instances do not share hands or coordinate as a team.'),
            ('External opponents and information','Catanatron commit ecf931181b9a65bb4116a2153fb78c16f1438e00 owns rules, actions and outcomes. We use its base map, official_spiral number placement, ten-point target, discard limit 7 and friendly_robber=False. AlphaBeta uses depth 2, base evaluation, prunning=False and the upstream 20-second search deadline. ValueFunction uses its base evaluator. Both receive sampled states consistent with public totals and their own private hand, conditioned on no player already having ten points in an ongoing game. Challenger uses a production-weighted estimate. Real opponent hands, real hidden deck composition and future RNG are withheld. This is not an unmodified omniscient native-player benchmark.'),
            ('Precision and decision rule','The primary outcome is whether either Challenger wins, with neutral reference 0.5. Descriptive Wilson 95% intervals at n=600 have worst-case half-width about 4 percentage points [3]. The primary superiority rule uses Hoeffding plus a union bound across both groups [4]: epsilon = sqrt(log(2 x 2 / 0.05) / (2 x 600)) = 0.06043. A group confirms superiority only if p_hat - epsilon > 0.5 after all 600 valid games. This conservative bound allows different win probabilities in fixed seat strata, assuming independent randomized games.'),
            ('Stopping and invalid games','There is no favorable-interim stopping. Each result is checkpointed and resume requires identical policy/adapter hashes. Any adapter error or unfinished game halts new submissions; invalid observations are not selectively replaced. Bank and port trades are available; player-to-player trade negotiation is outside this evaluated action space.'),
            ('Interface audit and withdrawn runs','Pilots double-counted directed roads; v4 then allowed sampled hidden VP to create a false ten-point opponent, prematurely ending AlphaBeta search. All v4 observations (2,714 completed plus one transport timeout) are withdrawn. v5 conditions hidden-card samples on nontermination and checks all eight opening steps. It also adapts mandatory Road Building resolution. The default was chosen by prior deployment, not old results. New seeds and source hashes define this confirmation.')],
          'results_title':'4. Confirmation results',
          'results_intro':(f'All {n:,} fixed-budget games completed. {passed} of two groups satisfy the simultaneous lower-bound criterion.' if complete else f'The fixed protocol contains 1,200 games; {n:,} are complete. These observations are interim and do not authorize a final superiority claim.'),
          'results_note':'AB2 denotes unpruned depth-2 AlphaBeta. Win rate counts either Challenger player; it is not the individual win rate of each bot. Wilson intervals describe each group separately; the family-wide Hoeffding intervals support the predeclared superiority decision. Groups are not pooled to manufacture a single-model win rate.',
          'results_conclusion':('These measurements support only the group-specific conclusions shown in the table. Only the pre-existing public default is confirmed here. These results do not establish a generation ranking or monotonic improvement. All source hashes, legal outcomes and seat counts must pass the artifact audit before release.'),
          'p5':[
            ('5. Discussion and limitations','The central distinction is between making a predictor score well and demonstrating a policy improvement on held-out games. The present study measures frozen policies against external opponents. It does not establish a general method that reliably improves Catan through unlimited self-play, and does not validate a new main-game reinforcement learner.'),
            ('Baseline and rule scope','Both opponents share the base evaluator, which considers one opponent\'s production rather than all three. Coverage is therefore narrow. Stronger search, alternative evaluators, other engines, negotiation and expert humans may expose different weaknesses. Beliefs are approximate, and the bridge re-evaluates after every atomic action. An additional terminal-state audit found some exact edge-trail lengths disagree with Catanatron\'s cached road lengths. Native scoring remains authoritative for all outcomes; the observed games are not asserted equivalent to every detail of standard CATAN.'),
            ('Related work','Catanatron supplies the engine and native baselines [1]. HexMachina studies LLM-guided evolution of executable Catan players [2]. Our artifact studies a different human-informed, learned-opening policy and a four-player evaluation protocol. No head-to-head result against HexMachina is reported, and its published percentages should not be compared directly with this two-of-four outcome.'),
            ('Reproducibility and next experiments','The release includes frozen JavaScript sources and opening weights, pinned Catanatron dependency, public-information projection, setup/geometry/hidden-information checks, source hashes, fixed protocol, per-game outcomes and compressed full game records. Follow README.md to verify and rerun into a new directory. Next steps include a matched no-learning opening ablation, stronger and more diverse opponents, and a separately consented expert-human study. Read CITATION.cff and NOTICE.md for attribution and scope.')],
          'headers':['Model','Opponent','Wins / n','Win rate','Wilson 95%','Joint lower'],
          'caption_arch':'Figure 1. Each agent receives its own observation. The external engine executes legal actions and records terminal outcomes.',
          'caption_forest':'Figure 2. Two groups with public-information baseline wrappers. Dashed: 50% neutral reference. Wide intervals control all groups jointly.',
        }
    return {
      'title':'学習済み初期配置ランキングを備えた\nカタン挑戦者AIの再現可能な外部評価',
      'subtitle':'技術レポート v0.1.0 | 2026年10月31日 | 査読前',
      'abstract':f'本稿は、人間の戦略知識を取り入れた本編方策と学習済み初期配置ランキングを組み合わせたカタン挑戦者AIの外部評価を報告する。従来からの公開標準設定gen0を凍結し、こちら2体・外部AI2体の独立した4人戦で評価する。相手は候補を絞らない深さ2のAlphaBetaとValueFunctionであり、双方に公開情報から推定した状態を渡す。相手ごとに600試合、合計1,200試合と判定方法を開始前に固定し、席の全6組を均等にした。現在の完了数は{n:,}試合である。'+(f'2構成中{passed}構成が、同時信頼区間を使う事前の優位判定を満たした。' if complete else '確認実験は進行中であり、本版の数値は途中経過である。')+'コード、重み、接続の検証、評価条件、AI同士の棋譜を提供する。結論は今回の相手・ルール・情報条件に限り、世界最強や人間の上級者への優位を主張しない。',
      'p1':[
        ('1. 目的と貢献','カタンでは、出目による生産、非公開カード、増産への投資、他者との賞の競合が同時に起きる。強さの比較には、方策の質と、席・情報量・外部接続の誤りを区別する必要がある。本稿の貢献は、評価条件と判断処理を確認できる外部評価の実装・測定資料である。'),
        ('対局時に動く仕組み','対局中の判断は通常のプログラムで実行する。ニューラルモデルは指定された初期配置候補の順位付けを担当し、本編は戦略評価と戦術的な手順探索を使う。対局の手を決めるためのLLM API呼び出しはない。開発・コード確認・レポート作成にはAIコーディング支援を用いた。'),
        ('再現する範囲','確認試合の結果を使ってモデルや係数を更新せず、既存の公開標準gen0を固定して測る。他世代もコードに含めるが、今回の確認対象にはしない。含めた重みでの判断と外部評価を再現できる一方、全学習データと歴史的な学習工程一式の再現は本公開物の対象外である。')],
      'p2':[
        ('2. 判断方策と配置モデル','本編の設定は3構成で共通である。gen0も既に第0世代の学習重みを混合率0.5で使う。gen1は第1世代の重みを1.0、gen2は第2世代の重みを0.5で使う。モデルと混合率が異なるため、学習あり・なしだけの要素比較ではない。'),
        ('配置スコアの計算','1軒目のネットワークは77特徴を標準化し、20ユニットのtanh隠れ層を経てsigmoid値を出す。配置完成形用の別モデルは75特徴・同じ隠れ層幅を持つ。特徴には資源・数字の生産、偏り、港、島の希少性、相手との差、候補の既存順位等がある。完成形には拡張先への距離や初期資源も含む。'),
        ('モデル値と順位の混合','z = clip((f - mu) / sd, -8, 8)、h = tanh(W1 z + b1)、q = sigmoid(clip(W2 h + b2, -30, 30)) とする。qで候補を並べ、(1 - lambda) r_base / (K - 1) + lambda r_model / (K - 1) が小さい候補を、保存された上書きマージンも使って選ぶ。qは順位付けの信号であり、その手の正確に較正された勝率ではない。'),
        ('学習モデルが使われる場所','全席の1軒目では、既存評価の上位12候補までを再順位付けする。1番手の最後の2軒目では、より広い候補集合を完成形モデルで評価する。他の席の2軒目は既存のペア配置ロジックを使う。混合率50%は、半数のターンだけモデルを使う意味ではない。'),
        ('本編の行動','都市・開拓地・道路・カード・交換・ステイを評価する。資源の用途と生産力、道路・港の目的地、他者との賞レース、盗賊、手札圧縮等を扱う。再構成した状態で、交換・建設・カード・賞を組み合わせて今10点に到達する手順を繰り返し探す。外部エンジンの解釈や手札推定が異なる場合、見込んだ勝利が成立しないこともある。追加ロールアウトを使う無敵AI設定は評価しない。'),
        ('仕組みから言えることの限界','凍結した構成の外部成績を測れる一方、この実験だけでは優位の原因を学習配置に限定できない。学習なしを対照にした同条件の比較や、人間上級者との評価は別途必要である。')],
      'p3':[
        ('3. 確認実験の事前固定','公開標準gen0と2種類の相手を各600試合、合計1,200試合とする。こちらが担当する席の6組を各100回ずつ使う。試合ごとに新しいseedを使い、席の抽選だけを確認して割り当てる。盤面・出目・勝敗では選別しない。各個体が自分の10点を目指し、こちらの2体も手札共有や協力をしない。'),
        ('相手と情報条件','Catanatronのコミットecf931181b9a65bb4116a2153fb78c16f1438e00がルール・合法手・勝敗を管理する。基本マップ、official_spiralの数字配置、10点目標、捨て札上限7、friendly_robber=Falseを使う。AlphaBetaは深さ2、base評価、prunning=False、探索上限20秒。ValueFunctionはbase評価である。双方が公開総数・自分の手札・未終局に整合する推定状態を使い、相手の実手札・実山札・未来の乱数は利用しない。こちらは生産力に基づく推定を使う。内部情報へアクセスできる未加工ボットとの比較ではない。'),
        ('精度と判定式','主要指標は、こちらのどちらかが勝った割合で、互角の基準は0.5とする。600試合のWilson95%区間の最大半幅は約4ポイントである[3]。主要な優位判定には、Hoeffding不等式と2構成へのunion boundを使う[4]。epsilon = sqrt(log(2 x 2 / 0.05) / (2 x 600)) = 0.06043 とし、全600試合完了後に p_hat - epsilon > 0.5 の構成だけを優位確認とする。独立した試合を仮定し、席によって勝率が異なる場合も扱える保守的な方法である。'),
        ('停止と無効試合','途中の都合の良い勝率による打ち切りはしない。各結果を保存し、再開時にはソースのhash一致を確認する。接続エラーや未完走が出た場合は新規投入を停止し、失敗局だけを置き換えない。銀行・港の交換は使えるが、対人間のようなプレイヤー間交渉は評価対象外である。'),
        ('接続の監査と旧結果の撤回','予備実験の道路二重計数に加え、v4では伏せVP推定により未終局なのに相手10点の状態を作り、AlphaBeta探索が早期終了していた。v4の2,714完走と1件の応答待ち失敗は全て撤回する。v5は未終局に条件付けたカード推定と配置8手を検証し、街道建設も外部仕様へ合わせた。旧成績から選ばず、従来の公開標準を新seedで確認する。')],
      'results_title':'4. 確認実験の結果',
      'results_intro':(f'事前固定した全{n:,}試合が完了した。2構成中{passed}構成が、同時区間の下限による優位判定を満たした。' if complete else f'事前固定した1,200試合のうち、現在{n:,}試合が完了している。以下は途中経過であり、最終的な優位の主張には使わない。'),
      'results_note':'AB2は候補を絞らない深さ2のAlphaBeta。勝率は「こちら2体のどちらかが勝つ割合」であり、各個体の勝率ではない。Wilson区間は各構成の記述用、同時Hoeffding区間は2構成全体の優位判定用である。異なる構成の結果を混ぜて単一モデルの勝率とはしない。',
      'results_conclusion':'結論は表の構成ごとに解釈する。確認対象は以前からの公開標準設定であり、世代の順位や単調な成長を示す表ではない。公開前に、ソースhash、全勝者、席の件数が保存物と一致することを確認する。',
      'p5':[
        ('5. 考察と限界','予測器の指標が良くなることと、未知の対局で方策が強くなることは区別する必要がある。本稿は凍結した方策の外部評価を行う。自己対戦を無限に追加すれば必ず成長する方法を確立したものではなく、新しい本編の強化学習器の有効性を示すものでもない。'),
        ('相手とルールの範囲','相手2種類は同じbase評価器を共有し、3人全員でなく1人分の相手生産力を考慮するため、比較の広がりは限られる。深い探索、別評価器・エンジン、交渉、人間上級者では別の弱点が現れ得る。手札推定は近似で、外部の1行動ごとに判断し直す点もサイトと異なる。追加の終局監査では、一部の正確な一筆書き長とCatanatronの内部道路長にも差が見つかった。勝敗は全試合で外部エンジンに従い、通常のCATANの全細部との等価性までは主張しない。'),
        ('関連研究','Catanatronを外部エンジン・相手方策として使う[1]。HexMachinaはLLMによる実行可能なカタン方策の進化を扱う[2]。本公開物は、人間の知識と学習済み初期配置を組み合わせた別の方策を4人戦で評価する。HexMachinaとの直接対戦は未実施であり、論文中の勝率と本稿の2体分合計勝率を直接比較しない。'),
        ('再現性と次の実験','凍結ソース・配置重み、上流コミットの指定、公開情報への変換、配置・座標・情報漏れの検証、hash、固定した条件、試合別結果、圧縮した完全棋譜を提供する。READMEの手順で検証し、新しい出力先へ再実行できる。次は配置学習なしを対照にした比較、相手の多様化、同意を得た人間上級者との実験が必要になる。著者・ライセンス・支援の記載はCITATION.cffとNOTICE.mdにまとめる。')],
      'headers':['モデル','相手','勝利 / n','勝率','Wilson 95%','同時下限'],
      'caption_arch':'図1. 各個体が独立した観測から判断し、外部エンジンが合法手を実行して終局を記録する。',
      'caption_forest':'図2. 事前固定した2構成。破線は互角の50%。太い灰色の区間は2構成を同時に扱う保守的な区間。',
    }


def build(lang,rows,summary,complete):
    text=content(lang,complete,rows,summary)
    style=ParagraphStyle('Body',fontName='Research',fontSize=10,leading=14.8,textColor=INK,spaceAfter=7,wordWrap='CJK' if lang=='ja' else None)
    small=ParagraphStyle('Small',parent=style,fontSize=8,leading=11,textColor=MUTED,spaceAfter=6)
    heading=ParagraphStyle('Head',parent=style,fontSize=12,leading=16,spaceBefore=6,spaceAfter=8,textColor=TEAL)
    title=ParagraphStyle('Title',parent=style,fontSize=20 if lang=='en' else 19,leading=25,spaceAfter=12)
    def p(s,kind=style):return Paragraph(escape(s).replace('\n','<br/>'),kind)
    def section(pair):return [p(pair[0],heading),p(pair[1])]
    story=[p(text['title'],title),p('midori11111111 | Independent research',small),p(text['subtitle'],small),Paragraph('<link href="https://catan-challenger-online.vercel.app/" color="#146B62">Play: catan-challenger-online.vercel.app</link>',small)]
    if not complete:story.append(p('DRAFT - CONFIRMATION IN PROGRESS',heading))
    story += [p('Abstract' if lang=='en' else '要旨',heading),p(text['abstract'])]
    story += section(text['p1'][0])
    story += [architecture(),p(text['caption_arch'],small)]
    story += section(text['p1'][1])
    story += section(text['p1'][2])
    story.append(PageBreak())
    for pair in text['p2']:story += section(pair)
    story.append(PageBreak())
    for pair in text['p3']:story += section(pair)
    story.append(PageBreak())
    story += [p(text['results_title'],heading),p(text['results_intro'])]
    by={(g['generation'],g['opponent']):g for g in summary}
    table=[[p(h,small) for h in text['headers']]]
    for gen in ('gen0',):
        for opp in ('AB_FULL','F'):
            g=by.get((gen,opp));n=g['games'] if g else 0
            cells=[gen,'AB2' if opp=='AB_FULL' else 'VF',f"{g['wins']}/{n}" if n else '0/0',f"{100*g['winRate']:.1f}%" if n else '-',f"{100*g['ci95'][0]:.1f}-{100*g['ci95'][1]:.1f}%" if n else '-',f"{100*g['familywiseHoeffding95'][0]:.1f}%" if n else '-']
            table.append([p(c,small) for c in cells])
    t=Table(table,colWidths=[58,50,65,65,112,WIDTH-350],hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),LIGHT),('LINEBELOW',(0,0),(-1,0),.7,TEAL),('LINEBELOW',(0,-1),(-1,-1),.5,GRAY),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    story += [t,Spacer(1,12),forest(summary),p(text['caption_forest'],small),p(text['results_note']),p(text['results_conclusion'])]
    result_details=[]
    if complete:
        mean=sum(r['rolls'] for r in rows)/len(rows)
        adap=sum(r['roadResolutionAdaptations'] for r in rows);dec=sum(r['decisions'] for r in rows)
        audit=json.loads((ROOT/'data/confirmation/validation.json').read_text()) if (ROOT/'data/confirmation/validation.json').exists() else {}
        note=(f'All {len(rows):,} games completed; mean {mean:.1f} dice rolls per game. Road-rule interface adaptations: {adap:,}/{dec:,} Challenger decisions. Outcome, seat and hash audit: '+('passed.' if audit.get('passed') else 'see distributed validation record.')) if lang=='en' else f'全{len(rows):,}試合が完走し、平均ダイス数は{mean:.1f}回。道路ルールへの接続上の適応は、こちらの{dec:,}判断中{adap:,}回。勝者・席・hashの検証結果は配布物のvalidation.jsonに保存する。'
        story.append(p(note))
        result_details.append(note)
        multi=len(audit.get('multipleTenPointTerminalGameIds',[]));short=len(audit.get('roadAwardBelowFiveGameIds',[]))
        if multi or short:
            anomaly=(f'Native-rule anomalies retained without exclusion: {multi} terminal games with multiple players at ten points; {short} games with a road-award flag below five cached road edges. See validation.json for IDs.' if lang=='en' else f'外部ルール上の例外として、終局時に複数人が10点以上の試合{multi}件、内部道路長5本未満で道賞フラグがある試合{short}件を含む。除外せず、IDをvalidation.jsonに保存した。')
            story.append(p(anomaly,small));result_details.append(anomaly)
        sem_path=ROOT/'verification-semantics.json'
        if sem_path.exists():
            sem=json.loads(sem_path.read_text());diffs=len(sem['nativeVsExactRoadLengthDifferences'])
            s=(f'Supplementary post hoc terminal audit: {diffs:,}/{sem["playerViews"]:,} player views differed in native cached versus exact trail length. Piece counts and reconstructed public scores matched. No observations were excluded.') if lang=='en' else f'追加の事後的な終局監査では、{sem["playerViews"]:,}人分の状態のうち{diffs:,}件で内部道路長と一筆書き長が異なった。駒数と公開得点の再構成は一致し、この差を理由に試合を除外していない。'
            story.append(p(s,small))
            result_details.append(s)
    belief_note=('Validity checks before confirmation: 512 native hidden-card samples and 64 Challenger reconstructions produced no phantom terminal root. VP allocations are weighted by combinatorial slot counts subject to public-score caps. The transport guard is 120 active-wait seconds and ignores OS-suspension gaps; the native AlphaBeta search deadline remains 20 wall-clock seconds. These are bridge fixes, with policy weights unchanged.' if lang=='en' else '開始前検査では、512通りの相手側カード推定と64通りのこちら側の再構成で、架空の終局が出ないことを確認した。伏せVPは公開得点の上限を守り、組合せ数で重み付けして割り当てる。通信待ちはOS休止を除く120秒、相手AlphaBetaの探索上限は従来の実時間20秒である。モデル重みは変更していない。')
    story.append(p(belief_note))
    result_details.append(belief_note)
    story.append(PageBreak())
    for pair in text['p5']:story += section(pair)
    story.append(p('References' if lang=='en' else '参考文献',heading))
    refs=[
      '[1] B. Collazo and contributors. Catanatron 3.3.0. Commit ecf931181b9a65bb4116a2153fb78c16f1438e00. https://github.com/bcollazo/catanatron',
      '[2] N. Belle et al. Agents of Change: Self-Evolving LLM Agents for Strategic Planning. arXiv:2506.04651v2, 2025. https://arxiv.org/abs/2506.04651v2',
      '[3] E. B. Wilson. Probable Inference, the Law of Succession, and Statistical Inference. JASA 22(158), 209-212, 1927. https://doi.org/10.1080/01621459.1927.10502953',
      '[4] W. Hoeffding. Probability Inequalities for Sums of Bounded Random Variables. JASA 58(301), 13-30, 1963. https://doi.org/10.1080/01621459.1963.10500830',
    ]
    for ref in refs:
        linked=re.sub(r'https?://[^\s]+',lambda m:'<link href="'+m.group(0)+'" color="#146B62">'+m.group(0)+'</link>',escape(ref))
        story.append(Paragraph(linked,small))
    pdf=ROOT/'output/pdf'/f'catan-challenger-report.{lang}.pdf'
    pdf.parent.mkdir(parents=True,exist_ok=True)
    def footer(canvas,doc):
        canvas.setStrokeColor(GRAY);canvas.setLineWidth(.5);canvas.line(52,42,A4[0]-52,42)
        canvas.setFillColor(MUTED);canvas.setFont('Research',7)
        canvas.drawString(52,29,'Catan Challenger | Technical report v0.1.0 | 2026-10-31')
        canvas.drawRightString(A4[0]-52,29,str(doc.page))
    doc=SimpleDocTemplate(str(pdf),pagesize=A4,rightMargin=52,leftMargin=52,topMargin=43,bottomMargin=55,title=text['title'].replace('\n',' '),author='midori11111111',subject='Fixed-budget external Catan AI evaluation')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    # Markdown manuscript is a viewable source companion in the public repository.
    md=['# '+text['title'].replace('\n',' '),'','midori11111111 - '+text['subtitle'],'','## Abstract' if lang=='en' else '## 要旨','',text['abstract']]
    for group in ['p1','p2','p3']:
        for h,body in text[group]:md += ['','## '+h,'',body]
        if group=='p1':md += ['','![Architecture](figures/architecture.svg)','',text['caption_arch']]
    md += ['','## '+text['results_title'],'',text['results_intro'],'','| '+' | '.join(text['headers'])+' |','|'+'---|'*6]
    for row in table[1:]:md.append('| '+' | '.join(c.getPlainText() for c in row)+' |')
    md += ['','![Confirmation intervals](figures/confirmation-forest.svg)','',text['caption_forest'],'',text['results_note'],'',text['results_conclusion']]
    for detail in result_details:md += ['',detail]
    for h,body in text['p5']:md += ['','## '+h,'',body]
    md += ['','## References','']+refs
    (ROOT/'paper'/f'report.{lang}.md').write_text('\n'.join(md)+'\n')
    return pdf


def main():
    register_fonts()
    path=ROOT/'data/confirmation/results.jsonl'
    rows=[json.loads(x) for x in path.read_text().splitlines()] if path.exists() else []
    summary=json.loads((ROOT/'data/confirmation/summary.json').read_text())
    complete=len(rows)==1200 and all(r['status']=='completed' for r in rows)
    if not complete and '--draft' not in sys.argv:
        raise RuntimeError('Confirmation incomplete. Use --draft only for marked layout previews.')
    if complete:
        validation=json.loads((ROOT/'data/confirmation/validation.json').read_text())
        assert validation['passed'] and validation['games']==1200
    (ROOT/'paper/figures').mkdir(parents=True,exist_ok=True)
    renderSVG.drawToFile(architecture(),str(ROOT/'paper/figures/architecture.svg'))
    renderSVG.drawToFile(forest(summary),str(ROOT/'paper/figures/confirmation-forest.svg'))
    for lang in ['en','ja']:print(build(lang,rows,summary,complete))


if __name__=='__main__':main()
