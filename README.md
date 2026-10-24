# MK Hausa Dictionary

A modern Hausa–English and English–Hausa dictionary platform with smart search, verified word meanings, translations, examples, pronunciation, and language-learning tools. Built by MK, with a website-first approach and plans for Android and AI integration.

## Dictionary data quality

- The public website displays only records marked `published` in Supabase.
- Do not create translations or definitions just to increase the word count.
- Every imported batch must be traceable to its source, checked for duplicates and encoding issues, and reviewed for Hausa spelling, translation quality, and part-of-speech accuracy before publication.
- Keep draft records unpublished until an editor approves them.
- Keep the source name, source URL, license, attribution, and any adaptation notes with the import documentation. If per-entry provenance is added to the database, populate it during import.
- Do not bulk-import a dataset until its license and the quality of the mapping direction are confirmed.

## Candidate open data sources (not imported yet)

1. **Robinson, Charles H. (1914), *Dictionary of the Hausa Language*, Vol. II (English–Hausa).** A public-domain machine-readable lexicon is available from the Murya Hausa/English lexicon dataset. Its dataset notes that the reverse Hausa-to-English lookup is rougher, so it should not be treated as publication-ready Hausa→English entries without review. Source: https://huggingface.co/datasets/adab-tech/murya-hausa-en-lexicon-robinson1914
2. **Hausa Wiktionary via Kaikki.org.** Data is extracted from Wiktionary and is available under CC BY-SA and GFDL terms. Any derivative use must comply with the applicable attribution and share-alike requirements. Source: https://kaikki.org/dictionary/Hausa/index.html

These are candidate sources for a controlled import and editorial review, not a claim that they have already been imported or verified.

## Current status

The live database currently has 2 published entries and 10 draft candidate entries awaiting editorial review. The public website fetches published records in stable pages of 1,000 rows, rather than stopping after a single 5,000-row request. Loading the entire corpus into the browser is still not the ideal long-term design for 100,000 entries; server-side search and pagination should be implemented before production-scale launch. Draft candidates are not visible on the public site until approved.

## Development

Work on `feature/mk-dictionary-ui` first. Do not merge to `main` without explicit approval.
