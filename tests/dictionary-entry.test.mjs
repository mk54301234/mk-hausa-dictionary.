import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findDuplicateHausaHeadword,
  findRelatedEntry,
  mapDictionaryEntry,
  normalizePronunciationUrl,
  readExamplePairs,
  updateFirstExamplePair
} from '../public/dictionary-entry.mjs';

test('maps existing dictionary fields without inventing missing content', () => {
  const entry = mapDictionaryEntry({
    id: 'entry-1',
    hausa_word: 'gida',
    english_translation: 'house, home',
    hausa_meaning: null,
    english_meaning: '',
    part_of_speech: null,
    examples: [],
    related_words: [],
    hausa_pronunciation_url: null,
    english_pronunciation_url: null
  });

  assert.equal(entry.ha, 'gida');
  assert.equal(entry.en, 'house, home');
  assert.equal(entry.meaningHa, '');
  assert.equal(entry.meaningEn, '');
  assert.equal(entry.type, '');
  assert.deepEqual(entry.examples, []);
  assert.deepEqual(entry.related, []);
  assert.equal(entry.hausaPronunciationUrl, '');
  assert.equal(entry.englishPronunciationUrl, '');
});

test('malformed or missing entry rows map to safe empty optional fields', () => {
  assert.equal(mapDictionaryEntry(null).ha, '');
  assert.equal(mapDictionaryEntry(undefined).en, '');
  assert.deepEqual(mapDictionaryEntry({ examples: null, related_words: 'not-an-array' }).examples, []);
  assert.deepEqual(mapDictionaryEntry({ examples: null, related_words: 'not-an-array' }).related, []);
});

test('detects duplicate Hausa headwords after whitespace and case normalization', () => {
  const entries = [
    { id: 'one', hausa_word: '  Gida   Mai  ' },
    { id: 'two', hausa_word: 'Gidaje' }
  ];

  assert.equal(findDuplicateHausaHeadword(entries, 'gida mai').id, 'one');
  assert.equal(findDuplicateHausaHeadword(entries, 'GIDA MAI', 'one'), null);
  assert.equal(findDuplicateHausaHeadword(entries, 'gidaje', 'one').id, 'two');
  assert.equal(findDuplicateHausaHeadword(entries, 'sabon gida'), null);
});

test('resolves related Hausa headwords and individual English translation terms', () => {
  const entries = [
    { id: 'one', ha: 'ƙofa', en: 'door, entrance' },
    { id: 'two', ha: 'gida', en: 'house; home' }
  ];

  assert.equal(findRelatedEntry(entries, 'kofa').id, 'one');
  assert.equal(findRelatedEntry(entries, 'HOME').id, 'two');
  assert.equal(findRelatedEntry(entries, 'unknown'), null);
});

test('reads paired examples in either supported key format and ignores malformed items', () => {
  assert.deepEqual(readExamplePairs([
    { ha: 'Ina kwana?', en: 'Good morning.' },
    { hausa: 'Yaya gida?', english: 'How is the home?' },
    null,
    'not an example',
    { ha: '  ', en: '' }
  ]), [
    { ha: 'Ina kwana?', en: 'Good morning.' },
    { ha: 'Yaya gida?', en: 'How is the home?' }
  ]);
});

test('maps available examples, related words, meanings, and secure pronunciation URLs', () => {
  const entry = mapDictionaryEntry({
    id: 'entry-2',
    hausa_word: 'gida',
    english_translation: 'house',
    hausa_meaning: 'Wurin zama.',
    english_meaning: 'A place to live.',
    part_of_speech: 'Noun',
    examples: [{ ha: 'Ina gida.', en: 'I am at home.' }],
    related_words: [' gida ', null, 'gidauniya'],
    hausa_pronunciation_url: 'https://audio.example/hausa.mp3',
    english_pronunciation_url: 'https://audio.example/english.mp3'
  });

  assert.deepEqual(entry.examples, [{ ha: 'Ina gida.', en: 'I am at home.' }]);
  assert.deepEqual(entry.related, ['gida', 'gidauniya']);
  assert.equal(entry.meaningHa, 'Wurin zama.');
  assert.equal(entry.meaningEn, 'A place to live.');
  assert.equal(entry.type, 'Noun');
  assert.equal(entry.hausaPronunciationUrl, 'https://audio.example/hausa.mp3');
  assert.equal(entry.englishPronunciationUrl, 'https://audio.example/english.mp3');
});

test('updates the first example without erasing extra fields or later pairs', () => {
  const existing = [
    { hausa: 'Tsohon misali', english: 'Old example', note: 'keep this' },
    { ha: 'Na biyu', en: 'Second example' }
  ];

  assert.deepEqual(updateFirstExamplePair(existing, 'Sabon misali', 'New example'), [
    { hausa: 'Sabon misali', english: 'New example', note: 'keep this' },
    { ha: 'Na biyu', en: 'Second example' }
  ]);
  assert.deepEqual(existing[0], { hausa: 'Tsohon misali', english: 'Old example', note: 'keep this' });
});

test('clearing the first example preserves other stored pairs', () => {
  assert.deepEqual(updateFirstExamplePair([
    { ha: 'First', en: 'First' },
    { ha: 'Second', en: 'Second' }
  ], '', ''), [{ ha: 'Second', en: 'Second' }]);
});

test('accepts secure audio URLs and rejects malformed or unsafe URLs', () => {
  assert.equal(normalizePronunciationUrl(' https://audio.example/word.mp3 '), 'https://audio.example/word.mp3');
  assert.equal(normalizePronunciationUrl('http://audio.example/word.mp3'), '');
  assert.equal(normalizePronunciationUrl('javascript:alert(1)'), '');
  assert.equal(normalizePronunciationUrl('https://user:pass@audio.example/word.mp3'), '');
  assert.equal(normalizePronunciationUrl('not a URL'), '');
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.hidden = false;
    this.isConnected = false;
  }

  append(...children) {
    for (const child of children) {
      this.children.push(child);
      child.setConnected(this.isConnected);
    }
  }

  replaceChildren(...children) {
    this.children.forEach(child => child.setConnected(false));
    this.children = [];
    this.append(...children);
  }

  setConnected(connected) {
    this.isConnected = connected;
    this.children.forEach(child => child.setConnected(connected));
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute() {}

  dispatch(type) {
    this.listeners.get(type)?.();
  }

  findAll(tagName) {
    return [
      ...(this.tagName === tagName ? [this] : []),
      ...this.children.flatMap(child => child.findAll(tagName))
    ];
  }
}

test('missing Hausa audio keeps the existing speech fallback available', async () => {
  const { renderPronunciation } = await import('../public/dictionary-dashboard.mjs');
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: tagName => new FakeElement(tagName) };
  try {
    const panel = new FakeElement('section');
    panel.setConnected(true);
    const speechFallback = new FakeElement('button');
    speechFallback.hidden = true;

    renderPronunciation(panel, { hausaPronunciationUrl: '', englishPronunciationUrl: '' }, 'en', speechFallback);

    assert.equal(speechFallback.hidden, false);
    assert.equal(panel.findAll('audio').length, 0);
    assert.equal(panel.findAll('small')[0].textContent, 'No recording available.');
  } finally {
    globalThis.document = originalDocument;
  }
});

test('audio failures activate only the Hausa fallback and each entry resets audio state', async () => {
  const { renderPronunciation } = await import('../public/dictionary-dashboard.mjs');
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: tagName => new FakeElement(tagName) };
  try {
    const panel = new FakeElement('section');
    panel.setConnected(true);
    const speechFallback = new FakeElement('button');
    const entryWithAudio = {
      hausaPronunciationUrl: 'https://audio.example/hausa.mp3',
      englishPronunciationUrl: 'https://audio.example/english.mp3'
    };

    renderPronunciation(panel, entryWithAudio, 'en', speechFallback);
    const [hausaAudio, englishAudio] = panel.findAll('audio');
    assert.equal(speechFallback.hidden, true);
    assert.notEqual(hausaAudio.src, englishAudio.src);

    englishAudio.dispatch('error');
    assert.equal(speechFallback.hidden, true);
    assert.equal(panel.findAll('small')[1].hidden, false);

    hausaAudio.dispatch('error');
    assert.equal(speechFallback.hidden, false);
    assert.equal(panel.findAll('small')[0].hidden, false);

    renderPronunciation(panel, entryWithAudio, 'en', speechFallback);
    assert.equal(speechFallback.hidden, true);
    assert.equal(panel.findAll('small').every(status => status.hidden), true);

    renderPronunciation(panel, { ...entryWithAudio, hausaPronunciationUrl: '' }, 'en', speechFallback);
    assert.equal(speechFallback.hidden, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('detached audio errors cannot change the newly rendered entry fallback', async () => {
  const { renderPronunciation } = await import('../public/dictionary-dashboard.mjs');
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: tagName => new FakeElement(tagName) };
  try {
    const panel = new FakeElement('section');
    panel.setConnected(true);
    const speechFallback = new FakeElement('button');
    const firstEntry = {
      hausaPronunciationUrl: 'https://audio.example/first-hausa.mp3',
      englishPronunciationUrl: ''
    };
    const secondEntry = {
      hausaPronunciationUrl: 'https://audio.example/second-hausa.mp3',
      englishPronunciationUrl: ''
    };

    renderPronunciation(panel, firstEntry, 'en', speechFallback);
    const detachedHausaAudio = panel.findAll('audio')[0];

    renderPronunciation(panel, secondEntry, 'en', speechFallback);
    const currentHausaAudio = panel.findAll('audio')[0];
    assert.equal(detachedHausaAudio.isConnected, false);
    assert.equal(currentHausaAudio.isConnected, true);
    assert.equal(speechFallback.hidden, true);

    detachedHausaAudio.dispatch('error');
    assert.equal(speechFallback.hidden, true);

    currentHausaAudio.dispatch('error');
    assert.equal(speechFallback.hidden, false);
    assert.equal(panel.findAll('small')[0].hidden, false);
  } finally {
    globalThis.document = originalDocument;
  }
});
