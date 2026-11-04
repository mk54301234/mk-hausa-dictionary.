import { mapDictionaryEntry } from './dictionary-entry.mjs';

const LANGUAGE_KEY = 'mk-hausa-dictionary-language';
const PAGE_SIZE = 1000;
const MAX_BROWSER_ENTRIES = 5000;

function readLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ha';
}

function addLabelledText(container, label, value, className = '') {
  if (!value) return;
  const block = document.createElement('div');
  if (className) block.className = className;
  const heading = document.createElement('strong');
  heading.textContent = label;
  const text = document.createElement('p');
  text.textContent = value;
  block.append(heading, text);
  container.append(block);
}

export function renderPronunciation(container, entry, language, hausaSpeechFallback) {
  container.replaceChildren();
  hausaSpeechFallback.hidden = Boolean(entry.hausaPronunciationUrl);
  const heading = document.createElement('h3');
  heading.className = 'subhead';
  heading.textContent = language === 'ha' ? 'Furuci / Sauti' : 'Pronunciation';
  container.append(heading);

  for (const [label, url, missing] of [
    ['Hausa', entry.hausaPronunciationUrl, language === 'ha' ? 'Babu rikodin sauti.' : 'No recording available.'],
    ['English', entry.englishPronunciationUrl, language === 'ha' ? 'Babu rikodin sauti.' : 'No recording available.']
  ]) {
    const row = document.createElement('div');
    row.className = 'pronunciation-row';
    const name = document.createElement('strong');
    name.textContent = label;
    row.append(name);

    if (url) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = url;
      audio.setAttribute('aria-label', language === 'ha' ? `Saurari furucin ${label}` : `${label} pronunciation`);
      const status = document.createElement('small');
      status.hidden = true;
      status.setAttribute('role', 'status');
      status.textContent = language === 'ha' ? 'Ba a iya kunna wannan rikodi ba.' : 'This recording could not be played.';
      audio.addEventListener('error', () => {
        if (!audio.isConnected) return;
        status.hidden = false;
        if (label === 'Hausa') hausaSpeechFallback.hidden = false;
      });
      row.append(audio, status);
    } else {
      const status = document.createElement('small');
      status.textContent = missing;
      row.append(status);
    }

    container.append(row);
  }
}

export function enhanceDictionaryDashboard({
  entries,
  $,
  getLanguage,
  getDirection,
  directionWasTouched,
  setDirection,
  getCurrentEntry,
  setCurrentEntry,
  setShowDetail,
  setApplyLanguage,
  renderWords,
  renderTodayWord,
  renderFlash,
  renderQuiz,
  applyLanguage
}) {
  const typeSection = document.querySelector('.detail-meta');
  const meaningPanel = document.querySelector('.meaning-panel');
  const examplePanel = document.querySelector('.detail-example');
  const dictionaryResults = $('dictResults');
  const loadWarning = document.createElement('p');
  loadWarning.className = 'empty';
  loadWarning.setAttribute('role', 'status');
  loadWarning.hidden = true;
  dictionaryResults.parentElement.insertBefore(loadWarning, dictionaryResults);
  const headwordLabel = document.createElement('span');
  headwordLabel.className = 'word-overline';
  document.querySelector('.detail-main').insertBefore(headwordLabel, document.querySelector('.detail-word'));
  const pronunciationPanel = document.createElement('section');
  pronunciationPanel.className = 'detail-extra pronunciation-panel';
  pronunciationPanel.hidden = true;
  examplePanel.insertAdjacentElement('afterend', pronunciationPanel);

  const renderDetails = entry => {
    if (!entry || !$('detail').classList.contains('active')) return;
    const language = getLanguage();
    const direction = getDirection();
    headwordLabel.textContent = direction === 'en-ha'
      ? (language === 'ha' ? 'Kalmar Turanci' : 'English entry')
      : (language === 'ha' ? 'Kalmar Hausa' : 'Hausa headword');
    if (typeSection) typeSection.hidden = !entry.type;

    const translationTitle = meaningPanel.previousElementSibling.querySelector('h3');
    translationTitle.textContent = direction === 'en-ha'
      ? (language === 'ha' ? 'Kalmar Hausa' : 'Hausa headword')
      : (language === 'ha' ? 'Fassarar Turanci' : 'English translation');
    meaningPanel.replaceChildren();
    addLabelledText(meaningPanel, language === 'ha' ? 'Ma’ana da Hausa' : 'Hausa meaning', entry.meaningHa);
    addLabelledText(meaningPanel, language === 'ha' ? 'Ma’ana da Turanci' : 'English definition', entry.meaningEn);
    meaningPanel.hidden = !entry.meaningHa && !entry.meaningEn;

    examplePanel.replaceChildren();
    const examplesHeading = document.createElement('h3');
    examplesHeading.textContent = language === 'ha' ? 'Misalai' : 'Examples';
    examplePanel.append(examplesHeading);
    for (const pair of entry.examples) {
      const pairElement = document.createElement('div');
      pairElement.className = 'example-pair';
      addLabelledText(pairElement, language === 'ha' ? 'Hausa' : 'Hausa', pair.ha);
      addLabelledText(pairElement, 'English', pair.en, 'translation');
      examplePanel.append(pairElement);
    }
    examplePanel.hidden = entry.examples.length === 0;

    renderPronunciation(pronunciationPanel, entry, language, $('detailSpeak'));
    pronunciationPanel.hidden = false;

    const translation = document.querySelector('#detailTranslate').parentElement;
    translation.hidden = direction === 'en-ha' ? !entry.ha : !entry.en;
    if (!translation.hidden) {
      translation.querySelector('p').textContent = direction === 'en-ha' ? entry.ha : entry.en;
    }
  };

  function updateLoadWarning(limited) {
    loadWarning.hidden = !limited;
    loadWarning.textContent = getLanguage() === 'ha'
      ? `An nuna kalmomi ${MAX_BROWSER_ENTRIES} na farko. Wasu sakamakon bincike na iya ɓacewa.`
      : `Showing the first ${MAX_BROWSER_ENTRIES} entries. Some search results may be missing.`;
  }

  setShowDetail((originalShowDetail) => function showDictionaryDetail(entry, record = true) {
    originalShowDetail(entry, record);
    renderDetails(entry);
  });

  setApplyLanguage(originalApplyLanguage => function applyDashboardLanguage() {
    originalApplyLanguage();
    localStorage.setItem(LANGUAGE_KEY, getLanguage());
    updateLoadWarning(entries.length >= MAX_BROWSER_ENTRIES);
    document.querySelectorAll('input[name="langChoice"]').forEach(input => {
      input.checked = input.value === getLanguage();
    });
    if ($('detail').classList.contains('active')) renderDetails(getCurrentEntry());
  });

  const loadCompleteEntries = async () => {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const database = createClient(
      'https://atoiwrpomcwurtuqolmc.supabase.co',
      'sb_publishable_XTQLRvmaBIcRyHskTEqxSw_EXkAdQxt'
    );
    const fields = 'id,hausa_word,english_translation,hausa_meaning,english_meaning,part_of_speech,hausa_pronunciation_url,english_pronunciation_url,related_words,examples';
    const settingsPromise = database
      .from('dictionary_settings')
      .select('home_direction')
      .eq('id', true)
      .maybeSingle();
    const rows = [];
    for (let offset = 0; offset < MAX_BROWSER_ENTRIES; offset += PAGE_SIZE) {
      const end = Math.min(offset + PAGE_SIZE, MAX_BROWSER_ENTRIES) - 1;
      const { data, error } = await database
        .from('dictionary_entries')
        .select(fields)
        .eq('status', 'published')
        .order('hausa_word')
        .order('id')
        .range(offset, end);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < end - offset + 1) break;
    }

    const mapped = rows.map(mapDictionaryEntry);
    const collator = new Intl.Collator('ha', { sensitivity: 'base', numeric: true });
    mapped.sort((a, b) => collator.compare(a.ha, b.ha) || a.ha.localeCompare(b.ha));
    entries.splice(0, entries.length, ...mapped);
    setCurrentEntry(entries[0] || null);
    updateLoadWarning(entries.length >= MAX_BROWSER_ENTRIES);
    const { data: settings, error: settingsError } = await settingsPromise;
    if (settingsError) {
      console.warn('Unable to load the saved dictionary search direction.', settingsError);
    } else if (!directionWasTouched() && ['ha-en', 'en-ha'].includes(settings?.home_direction)) {
      setDirection(settings.home_direction);
    }
    renderWords($('dictionary').classList.contains('active') ? $('dictQuery').value.trim() : '');
    renderTodayWord();
    renderFlash();
    renderQuiz();
  };

  window.addEventListener('storage', event => {
    if (event.key !== LANGUAGE_KEY || !event.newValue) return;
    const nextLanguage = readLanguage();
    document.querySelector(`input[name="langChoice"][value="${nextLanguage}"]`).checked = true;
    applyLanguage();
  });

  applyLanguage();
  loadCompleteEntries().catch(error => {
    console.warn('Unable to load complete published dictionary fields.', error);
    const box = $('dictResults');
    if (box) {
      box.replaceChildren();
      const message = document.createElement('div');
      message.className = 'empty';
      message.textContent = getLanguage() === 'ha'
        ? 'Ba a iya samun bayanan kamus ba. Duba haɗin intanet ko saitunan Supabase.'
        : 'Dictionary data is unavailable. Check your connection or Supabase settings.';
      box.append(message);
    }
  });
}
