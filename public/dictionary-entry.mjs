function nonemptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function firstString(...values) {
  return values.map(nonemptyString).find(Boolean) || '';
}

function normalizeHeadword(value) {
  return nonemptyString(value).replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeDictionarySearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .toLocaleLowerCase('ha')
    .replace(/[ɗđ]/g, 'd')
    .replace(/[ɓ]/g, 'b')
    .replace(/[ƙ]/g, 'k')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findDuplicateHausaHeadword(entries, headword, currentEntryId = null) {
  const normalizedHeadword = normalizeHeadword(headword);
  if (!normalizedHeadword || !Array.isArray(entries)) return null;

  return entries.find(entry => {
    if (!entry || typeof entry !== 'object') return false;
    if (currentEntryId != null && String(entry.id) === String(currentEntryId)) return false;
    return normalizeHeadword(entry.hausa_word) === normalizedHeadword;
  }) || null;
}

export function findRelatedEntry(entries, word) {
  const query = normalizeDictionarySearchText(word);
  if (!query || !Array.isArray(entries)) return null;

  return entries.find(entry =>
    entry && typeof entry === 'object' && (
      normalizeDictionarySearchText(entry.ha) === query ||
    String(entry.en ?? '').split(/[,;؛]/).some(term => normalizeDictionarySearchText(term) === query)
    )
  ) || null;
}

export function normalizePronunciationUrl(value) {
  const input = nonemptyString(value);
  if (!input) return '';

  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function readExamplePairs(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(example => example && typeof example === 'object' && !Array.isArray(example))
    .map(example => ({
      ha: firstString(example.ha, example.hausa),
      en: firstString(example.en, example.english)
    }))
    .filter(example => example.ha || example.en);
}

export function updateFirstExamplePair(existing, hausa, english) {
  const examples = Array.isArray(existing) ? [...existing] : [];
  const ha = nonemptyString(hausa);
  const en = nonemptyString(english);
  const index = examples.findIndex(example => example && typeof example === 'object' && !Array.isArray(example));

  if (!ha && !en) {
    if (index >= 0) examples.splice(index, 1);
    return examples;
  }

  if (index < 0) {
    examples.unshift({ ha, en });
    return examples;
  }

  const current = examples[index];
  const haKey = Object.hasOwn(current, 'hausa') && !Object.hasOwn(current, 'ha') ? 'hausa' : 'ha';
  const enKey = Object.hasOwn(current, 'english') && !Object.hasOwn(current, 'en') ? 'english' : 'en';
  examples[index] = { ...current, [haKey]: ha, [enKey]: en };
  return examples;
}

export function mapDictionaryEntry(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) row = {};
  const firstExample = readExamplePairs(row.examples)[0] || { ha: '', en: '' };
  return {
    id: row.id,
    ha: nonemptyString(row.hausa_word),
    en: nonemptyString(row.english_translation),
    short: nonemptyString(row.english_translation).split(',')[0].trim(),
    type: nonemptyString(row.part_of_speech),
    meaningHa: nonemptyString(row.hausa_meaning),
    meaningEn: nonemptyString(row.english_meaning),
    exampleHa: firstExample.ha,
    exampleEn: firstExample.en,
    examples: readExamplePairs(row.examples),
    related: Array.isArray(row.related_words)
      ? row.related_words.map(nonemptyString).filter(Boolean)
      : [],
    hausaPronunciationUrl: normalizePronunciationUrl(row.hausa_pronunciation_url),
    englishPronunciationUrl: normalizePronunciationUrl(row.english_pronunciation_url)
  };
}
