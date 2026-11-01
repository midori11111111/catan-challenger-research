# Build the reports

Install `paper/requirements.txt` in a Python environment. Set `CATAN_REPORT_FONT` to a Japanese-capable TrueType font if the host does not provide Arial Unicode. Fonts are used from the local environment and are not redistributed as font files.

After the fixed confirmation completes:

```sh
.venv/bin/python finalize.py
node audit_semantics.js --all
.venv/bin/python audit_archive.py
.venv/bin/python paper/build_report.py
```

The builder reads actual stored game results and requires all 1,200 games for a final report. `--draft` generates clearly marked, interim layout previews. English and Japanese reports appear in `output/pdf/`; Markdown manuscripts and vector figures appear in `paper/`.

Render both final PDFs with Poppler and inspect every page before distribution:

```sh
pdftoppm -r 110 -png output/pdf/catan-challenger-report.en.pdf output/preview/en
pdftoppm -r 110 -png output/pdf/catan-challenger-report.ja.pdf output/preview/ja
```

The publication archive includes full game records as `data/confirmation/games.jsonl.gz` rather than thousands of loose JSON files. `finalize.py` validates the loose records produced by a fresh rerun before creating that archive. The distributed, already-completed archive can be audited directly with `audit_archive.py`.

`publication_qa.py --visual-reviewed` records checksums only after every final rendered page has been inspected. `package_release.py` then checks those hashes and packages a clean, checksum-listed ZIP; it does not upload it. The finalization/report commands target the distributed `data/confirmation` dataset. A new run in another output directory has its own results and summary files.
