"""Check final report text/metadata and record a completed visual review.

Run with --visual-reviewed only after inspecting every rendered EN/JA page.
This records review evidence; it does not perform visual inspection itself.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parent

def main():
    args=argparse.ArgumentParser()
    args.add_argument('--visual-reviewed',action='store_true',required=True)
    args.parse_args()
    summary=json.loads((ROOT/'data/confirmation/summary.json').read_text())
    validation=json.loads((ROOT/'data/confirmation/validation.json').read_text())
    assert validation['passed'] and validation['games']==1200
    assert len(summary)==2 and all(g['games']==600 and g['errors']==0 for g in summary)
    files={};checks={}
    for lang in ('en','ja'):
        rel=f'output/pdf/catan-challenger-report.{lang}.pdf'
        p=ROOT/rel;pdf=PdfReader(p);texts=[page.extract_text() for page in pdf.pages]
        text='\n'.join(texts)
        assert len(pdf.pages)==5,(lang,len(pdf.pages))
        assert 'DRAFT' not in text and 'CONFIRMATION IN PROGRESS' not in text
        assert '1,200' in text and '0.06043' in text
        assert '2,714' in text and '512' in text and '64' in text
        assert 'midori11111111' in text
        assert '/Users/' not in text and '@gmail.com' not in text
        for g in summary:
            assert f"{g['wins']}/600" in text
            assert f"{100*g['winRate']:.1f}%" in text
        links=[a.get_object().get('/A',{}).get('/URI') for page in pdf.pages for a in page.get('/Annots',[])]
        assert 'https://arxiv.org/abs/2506.04651v2' in links
        assert 'https://github.com/bcollazo/catanatron' in links
        assert all(len(t)>500 for t in texts)
        files[rel]=hashlib.sha256(p.read_bytes()).hexdigest()
        checks[lang]={'pages':len(pdf.pages),'allPagesVisuallyReviewed':True,'textAndMeasuredResultsMatch':True,'linksChecked':len(links)}
    result={'passed':True,'checkedAt':datetime.now(timezone.utc).isoformat(),'pdfSha256':files,'reports':checks,'productionUpdated':False}
    (ROOT/'publication-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
