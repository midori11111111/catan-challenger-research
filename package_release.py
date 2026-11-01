"""Create a clean, checksum-listed publication archive after final validation."""
import hashlib
import json
from pathlib import Path
import zipfile

from confirmation import ROOT, source_hashes, TOTAL_GAMES, GROUPS

ROOT_FILES=['README.md','README.ja.md','LICENSE','NOTICE.md','HISTORY.md',
            'CONTRIBUTING.md','CITATION.cff','.gitignore','requirements.txt',
            'manifest.json','bridge-manifest.json','runtime.js','driver.js',
            'conversion.js','belief.py','bot.js','run.py','run_2v2.py','verify.py',
            'verify_public.py','verify_belief.py','confirmation.py','finalize.py','audit_archive.py',
            'audit_runtime.py','audit_semantics.js','publication_qa.py','package_release.py',
            'verification.json','verification-public.json','verification-runtime.json',
            'verification-semantics.json','verification-belief.json','publication-validation.json']


def update_readmes(summary):
    labels={'AB_FULL':'AlphaBeta depth 2 (unpruned)','F':'ValueFunction'}
    lines=['| Model | Public-information opponent | Wins / games | Win rate | Wilson 95% |',
           '|---|---|---:|---:|---:|']
    for g in summary:
        lines.append(f"| {g['generation']} | {labels[g['opponent']]} | {g['wins']}/{g['games']} | {100*g['winRate']:.1f}% | {100*g['ci95'][0]:.1f}-{100*g['ci95'][1]:.1f}% |")
    count=sum(g['confirmedAdvantage'] for g in summary)
    en='## Confirmation results\n\n'+'\n'.join(lines)+f'\n\nAll 1,200 games completed with zero invalid games; all six seat pairs have 100 observations per group. {count}/2 groups meet the simultaneous Hoeffding superiority criterion against the 50% neutral reference. These are corrected-bridge, fixed-budget results; pilots are not pooled.\n\n![Confirmation intervals](paper/figures/confirmation-forest.svg)\n\n'
    japanese='## 確認実験の結果\n\n'+'\n'.join(lines)+f'\n\n追加の1,200試合を全て完走し、エラー0。各構成で席の全6組を100回ずつ使いました。2構成中{count}構成が、互角の50%に対する同時Hoeffding区間の優位判定を満たしました。修正済み接続による事前固定の確認結果であり、旧予備実験は混ぜていません。\n\n'
    for name,marker,section in [('README.md','## What is being evaluated?',en),('README.ja.md','## 使っているAI',japanese)]:
        p=ROOT/name;text=p.read_text()
        start='<!-- CONFIRMATION-RESULTS-START -->';end='<!-- CONFIRMATION-RESULTS-END -->'
        if start in text:
            a,b=text.split(start,1);_,c=b.split(end,1);text=a+start+'\n'+section+end+c
        else:text=text.replace(marker,start+'\n'+section+end+'\n\n'+marker,1)
        p.write_text(text)


def main():
    out=ROOT/'data/confirmation'
    validation=json.loads((out/'validation.json').read_text())
    assert validation['passed'] and validation['games']==TOTAL_GAMES
    plan=json.loads((out/'plan.json').read_text())
    assert plan['hashes']==source_hashes()
    qa=json.loads((ROOT/'publication-validation.json').read_text())
    assert qa['passed']
    for name,digest in qa['pdfSha256'].items():
        assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
    semantics=json.loads((ROOT/'verification-semantics.json').read_text())
    assert semantics['games']==TOTAL_GAMES and semantics['pieceCountsAndPublicScoresMatch']
    summary=json.loads((out/'summary.json').read_text())
    update_readmes(summary)
    selected=[ROOT/name for name in ROOT_FILES]
    for prefix in ['frozen','fixtures','history','smoke-02','paper','output/pdf','data/pilot-1v3','data/pilot-2v2']:
        selected.extend(p for p in (ROOT/prefix).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    for name in ['plan.json','results.jsonl','results.csv','summary.json','validation.json','games.jsonl.gz','status.json','execution.json']:
        selected.append(out/name)
    selected=sorted(set(selected),key=lambda p:str(p.relative_to(ROOT)))
    assert all(p.is_file() and p.resolve().is_relative_to(ROOT) for p in selected)
    checks=''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(ROOT))+'\n' for p in selected)
    (ROOT/'MANIFEST.sha256').write_text(checks)
    selected.append(ROOT/'MANIFEST.sha256')
    target=ROOT.parent/'catan-challenger-research-v0.1.0.zip'
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in selected:
            name='catan-challenger-research-v0.1.0/'+p.relative_to(ROOT).as_posix()
            info=zipfile.ZipInfo(name,date_time=(2026,10,31,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644<<16
            z.writestr(info,p.read_bytes())
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    print(json.dumps({'archive':str(target),'files':len(selected),'bytes':target.stat().st_size,'sha256':digest,'publishedToGitHub':False},indent=2))


if __name__=='__main__':main()
