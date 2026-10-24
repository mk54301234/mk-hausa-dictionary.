# MK Hausa Dictionary — Data sources and import policy

## Goal
Build a useful Hausa ↔ English dictionary with reliable spellings, meanings, part-of-speech labels, examples, and transparent provenance. Sort displayed Hausa headwords using Hausa-aware collation.

## Candidate source A: Robinson (1914), English → Hausa
- Dataset: https://huggingface.co/datasets/adab-tech/murya-hausa-en-lexicon-robinson1914
- Original work: Charles Henry Robinson, *Dictionary of the Hausa Language*, Vol. II, 3rd edition, Cambridge University Press, 1914.
- The dataset page identifies the source as public domain and reports 20,628 English→Hausa pairs.
- Important limitations documented by the dataset publisher: OCR/heuristic extraction, not proofread entry-by-entry; historic spellings may not match current Hausa orthography; this is English→Hausa, not a verified Hausa→English corpus.
- Attribution reference: https://archive.org/details/dictionaryofhaus02robiuoft
- Policy: do not import raw pairs as publish-ready Hausa→English entries. Use only in a staged import/review workflow with source text retained.

## Candidate source B: Hausa Wiktionary data via Kaikki.org
- Dataset: https://kaikki.org/dictionary/Hausa/index.html
- Kaikki describes its Hausa machine-readable dictionary as extracted from English Wiktionary using Wiktextract.
- Related project notes identify Hausa Wiktionary material as CC BY-SA 4.0. Before redistribution, retain attribution and review applicable share-alike obligations and current source terms.
- Important limitations: extracted data can contain parsing errors, incomplete senses, and ambiguous forms. Review each candidate before publication.

## Import and publication policy
1. Keep source URL/name, original headword, original gloss/context, license, attribution, and import date with every imported batch.
2. Normalize Unicode to NFC; preserve Hausa letters such as ɓ, ɗ, ƙ, and long/diacritic forms where supplied. Never silently replace them with b, d, k.
3. Deduplicate normalized headwords carefully, but do not collapse distinct senses into one without editorial review.
4. Flag OCR artifacts, cross-reference fragments, single-word fragments extracted from example sentences, and unclear mappings.
5. Map source direction correctly. An English→Hausa pair must not be silently labeled Hausa→English.
6. Keep all imported candidates as drafts. Only a qualified editorial review should change them to published.
7. Check completeness, duplicate headwords, sort order, spelling, meanings, part of speech, and examples before each publication batch.
8. Do not increase the published word count just to meet a numeric target. Accuracy and source traceability take priority.

## Current branch/database state
- Work branch: `feature/mk-dictionary-ui`; do not merge into `main) without explicit approval.
- Current live database count at last verification: 2 published entries and 76 draft candidates.
- Frontend fetches published rows in pages of 1,000 and applies Hausa-aware browser collation to the loaded results. Server-side search/pagination is still recommended before a very large production corpus.
- The 76 current drafts are manually prepared review candidates, not a claim of source-verified, publication-ready lexicographic content.
