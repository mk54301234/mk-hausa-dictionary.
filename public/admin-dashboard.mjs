import { findDuplicateHausaHeadword, normalizePronunciationUrl, readExamplePairs, updateFirstExamplePair } from './dictionary-entry.mjs';

const LANGUAGE_KEY = 'mk-hausa-dictionary-language';
const translations = [
  ['Fita / Sign out', 'Sign out'],
  ['Komawa website', 'Back to website'],
  ['Shiga da Google account ɗin da aka ba izinin gudanar da ƙamus. Shiga kaɗai ba ya ba ka damar admin.', 'Sign in with the Google account authorized to manage the dictionary. Signing in alone does not grant admin access.'],
  ['G ✦  Ci gaba da Google / Continue with Google', 'G ✦  Continue with Google'],
  ['Idan ba a ba account ɗinka izini ba, ba za ka iya ganin ko gyara bayanan admin ba.', 'If your account is not authorized, you cannot view or edit admin data.'],
  ['Gudanar da kalmomi da saƙonnin feedback.', 'Manage dictionary entries and feedback.'],
  ['+ Ƙara kalma / Add word', '+ Add word'],
  ['Dukkan kalmomi / All entries', 'All entries'],
  ['Taɓa don duba dukkan kalmomi ↗', 'View all entries ↗'],
  ['Taɓa don duba kalmomin da aka wallafa ↗', 'View published entries ↗'],
  ['Feedback da bai ƙare ba', 'Open feedback'],
  ['Taɓa don duba feedback ↗', 'View feedback ↗'],
  ['Taɓa don duba tarihin ƙirƙira, gyara da share kalmomi ↗', 'View entry activity ↗'],
  ['Taɓa don gudanar da admins ↗', 'Manage admins ↗'],
  ['Taɓa don canja harsuna ↗', 'Change language direction ↗'],
  ['Kalmomi / Dictionary', 'Dictionary'],
  ['Saƙonnin feedback', 'Feedback messages'],
  ['Tarihin ayyukan ma’aikata', 'Employee activity'],
  ['Kundin kalmomi', 'Dictionary entries'],
  ['Nemo kalma…', 'Search entries…'],
  ['Dukkan status', 'All statuses'],
  ['Sabunta', 'Refresh'],
  ['Ana lodawa…', 'Loading…'],
  ['Ana lissafawa…', 'Loading count…'],
  ['Hausa', 'Hausa'],
  ['Fassarar Turanci', 'English translation'],
  ['Ayyuka', 'Actions'],
  ['Gyara', 'Edit'],
  ['Share', 'Delete'],
  ['Na baya', 'Previous'],
  ['Na gaba', 'Next'],
  ['Rukuni', 'Category'],
  ['Kalma', 'Word'],
  ['Saƙo', 'Message'],
  ['Email na mai aikawa', 'Sender email'],
  ['Rana', 'Date'],
  ['Owner kaɗai zai iya ganin tarihin ƙirƙira, gyara da share kalmomi.', 'Only the owner can view entry creation, edit, and deletion history.'],
  ['Dukkan ma’aikata', 'All employees'],
  ['Ma’aikaci', 'Employee'],
  ['Aiki', 'Action'],
  ['Lokaci', 'Time'],
  ['Owner ne kaɗai zai iya ƙara ko cire admin.', 'Only the owner can add or remove admins.'],
  ['Izinin aiki', 'Permissions'],
  ['Matsayi da ayyuka', 'Role and actions'],
  ['Active', 'Active'],
  ['Created', 'Created'],
  ['Email ɗin mai amfani', 'User email'],
  ['+ Ƙara admin', '+ Add admin'],
  ['Dole ne mutum ya shiga da Google account ɗinsa aƙalla sau ɗaya kafin a ƙara shi.', 'The person must sign in with their Google account at least once before being added.'],
  ['Zaɓi tsarin harsunan da zai fara a shafin jama’a.', 'Choose the default language direction on the public website.'],
  ['Tsarin harsuna', 'Language direction'],
  ['Ajiye saitin harsuna', 'Save language setting'],
  ['Wannan saitin ba ya canza bayanan kalmomi.', 'This setting does not change dictionary content.'],
  ['Ƙara kalma', 'Add entry'],
  ['Gyara kalma / Edit word', 'Edit entry'],
  ['Ƙara kalma / Add word', 'Add entry'],
  ['Kalmar Hausa *', 'Hausa headword *'],
  ['Fassarar Turanci *', 'English translation *'],
  ["Ma'ana da Hausa", 'Hausa meaning'],
  ['Meaning in English', 'English definition'],
  ["Nau'in kalma / Part of speech", 'Part of speech'],
  ['Kalmomi masu alaƙa (optional)', 'Related words (optional)'],
  ['Ba dole ba ne a cika wannan fili.', 'This field is optional.'],
  ['Matsayi', 'Status'],
  ['Daftari', 'Draft'],
  ['An wallafa', 'Published'],
  ['An adana', 'Archived'],
  ['Soke', 'Cancel'],
  ['Ajiye / Save', 'Save'],
  ['Rufe ✕', 'Close ✕'],
  ['Noun, Verb…', 'Noun, verb…'],
  ['Kalmomi masu alaƙa, a raba su da waƙafi', 'Separate related words with commas'],
  ['Owner ne kaɗai zai iya shiga wannan sashe.', 'Only the owner can access this section.'],
  ['Allon gudanarwa', 'Dashboard'],
  ['Allon admin', 'Admin Dashboard'],
  ['An wallafa', 'Published'],
  ['Izinin admin', 'Admin access'],
  ['Harsunan shafin farko', 'Home screen languages'],
  ['An sabunta', 'Updated'],
  ['Imel', 'Email'],
  ['Turanci', 'English'],
  ['Editor', 'Editor'],
  ['Reviewer', 'Reviewer'],
  ['Viewer', 'Viewer'],
  ['Shafin farko', 'Home screen'],
  ['Ayyukan ma’aikata', 'Employee activity'],
  ['HA ↔ EN', 'HA ↔ EN'],
  ['Hausa → English', 'Hausa → English'],
  ['English → Hausa', 'English → Hausa'],
  ['Zaɓi tsarin harsunan da zai fara a shafin jama’a.', 'Choose the default language direction on the public website.'],
  ['Ra’ayi', 'Feedback'],
  ['Harsunan shafin farko', 'Home Screen languages'],
  ['Yana aiki', 'Active'],
  ['An ƙirƙira', 'Created'],
  ['Sabo', 'new'],
  ['Ana dubawa', 'reviewing'],
  ['An warware', 'resolved'],
  ['An yi watsi', 'dismissed'],
  ['Kuskuren fassara', 'translation_error'],
  ['Furuci', 'pronunciation'],
  ['Shawara', 'suggestion'],
  ['Sauran', 'other'],
  ['An ƙirƙira', 'created'],
  ['An sabunta', 'updated'],
  ['An share', 'deleted'],
  ['Daftari', 'draft'],
  ['An wallafa', 'published'],
  ['An adana', 'archived']
];

const messages = [
  ['Ana buɗe Google…', 'Opening Google sign-in…'],
  ['Ba a iya buɗe Google sign-in ba: ', 'Could not open Google sign-in: '],
  ['Google sign-in ya kasa: ', 'Google sign-in failed: '],
  ['Ba a kammala tabbatar da Google sign-in ba: ', 'Google sign-in verification did not complete: '],
  ['Ba a iya karanta session ba: ', 'Could not read the session: '],
  ['Matsalar kammala Google sign-in: ', 'Problem completing Google sign-in: '],
  ['Ba a iya loda kalmomi ba.', 'Could not load entries.'],
  ['Babu kalmomi a wannan jerin tukuna.', 'No entries in this list yet.'],
  ['Babu feedback tukuna.', 'No feedback yet.'],
  ['Ba a iya sabunta feedback ba: ', 'Could not update feedback: '],
  ['An sabunta feedback.', 'Feedback updated.'],
  ['Ba a iya loda jerin ma’aikata ba: ', 'Could not load the employee list: '],
  ['Owner ne kaɗai zai iya ganin tarihin ayyuka.', 'Only the owner can view activity history.'],
  ['Ba a iya loda tarihin ayyuka ba.', 'Could not load activity history.'],
  ['Babu tarihin aiki a wannan jerin tukuna.', 'No activity in this list yet.'],
  ['Owner ne kaɗai zai iya duba wannan sashe.', 'Only the owner can view this section.'],
  ['Ba a iya loda admin access ba.', 'Could not load admin access.'],
  ['Babu admin users.', 'No admin users.'],
  ['Ba a iya karanta saitin harsuna ba: ', 'Could not read the language setting: '],
  ['Kuskuren admin access: ', 'Admin access error: '],
  ['Ba a iya ajiye matsayi/izini ba: ', 'Could not save the role/permissions: '],
  ['An ajiye matsayi da izinin ma’aikaci.', 'Employee role and permissions saved.'],
  ['Ba a iya canza izinin admin ba: ', 'Could not change admin access: '],
  ['An sabunta izinin ma’aikaci.', 'Employee access updated.'],
  ['A cire ', 'Remove '],
  ['Ba a iya cire admin ba: ', 'Could not remove the admin: '],
  ['An cire admin daga jerin masu izini.', 'Admin removed from the authorized list.'],
  ['Owner ne kaɗai zai iya ƙara admin.', 'Only the owner can add an admin.'],
  ['Shigar da email na admin.', 'Enter the admin email.'],
  ['Ba a iya ƙara admin ba: ', 'Could not add the admin: '],
  ['An ƙara admin cikin nasara.', 'Admin added successfully.'],
  ['Owner ne kaɗai zai iya canja wannan saitin.', 'Only the owner can change this setting.'],
  ['Ba a iya ajiye tsarin harsuna ba: ', 'Could not save the language direction: '],
  ['An ajiye tsarin harsuna na Home Screen.', 'Home screen language direction saved.'],
  ['Ba a iya share kalma ba: ', 'Could not delete the entry: '],
  ['An share kalma.', 'Entry deleted.'],
  ['An samu matsala: ', 'An error occurred: '],
  ['A kunna', 'Activate'],
  ['A kashe', 'Deactivate'],
  ['A share kalmar “', 'Delete entry “'],
  ['Ba a iya buɗe kalma ba: ', 'Could not open entry: '],
  ['Ba a iya ajiye kalma ba: ', 'Could not save entry: '],
  ['Ba ka da izinin wallafa ko adana wannan kalma. Zaɓi daftari ko nemi izinin wallafa.', 'You are not allowed to publish or archive this entry. Save as draft or ask for publish access.'],
  ['Ba ka da izinin yin wannan canjin. Nemi izinin da ya dace daga owner.', 'You are not allowed to make this change. Ask the owner for the required permission.'],
  ['An ajiye kalma.', 'Entry saved.'],
  ['Ana lodawa…', 'Loading…'],
  ['Ba a iya tabbatar da izinin admin ba: ', 'Could not verify admin access: '],
  ['An shiga, amma wannan account ba shi da izinin admin. Owner ya kamata ya ba shi izini.', 'Signed in, but this account does not have admin access. Ask the owner to grant access.']
];

function getLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ha';
}

function translate(value, language = getLanguage()) {
  const pair = [...translations, ...messages].find(([ha, en]) => value === ha || value === en);
  return pair ? pair[language === 'ha' ? 0 : 1] : value;
}

function translateNotice(message, language) {
  for (const [ha, en] of messages) {
    if (message === ha || message === en) return language === 'ha' ? ha : en;
    if (message.startsWith(ha)) return (language === 'ha' ? ha : en) + message.slice(ha.length);
    if (message.startsWith(en)) return (language === 'ha' ? ha : en) + message.slice(en.length);
  }
  return message;
}

function addField(grid, id, labelText, { textarea = false, maxLength, placeholder = '' } = {}) {
  const field = document.createElement('div');
  field.className = 'field full';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.dataset.ha = labelText[0];
  label.dataset.en = labelText[1];
  const input = document.createElement(textarea ? 'textarea' : 'input');
  input.id = id;
  if (maxLength) input.maxLength = maxLength;
  input.dataset.haPlaceholder = placeholder[0] || '';
  input.dataset.enPlaceholder = placeholder[1] || '';
  if (!textarea) {
    input.type = 'text';
    input.autocomplete = 'off';
    input.inputMode = id.toLowerCase().includes('pronunciation') ? 'url' : 'text';
  }
  field.append(label, input);
  grid.append(field);
  return input;
}

export function enhanceAdminDashboard({
  $,
  supabase,
  getUser,
  getEntries,
  notice,
  setNotice,
  setOpenForm,
  setLoadEntries,
  setLoadFeedback,
  setLoadActivity,
  setLoadAccess,
  setLoadActivityEmployees
}) {
  let language = getLanguage();
  let currentFormEntry = null;
  let originalExampleValues = { ha: '', en: '' };
  let saving = false;
  let showNotice = notice;
  const grid = document.querySelector('#entryForm .form-grid');
  const relatedField = $('relatedWords').closest('.field');
  const examplesHa = addField(grid, 'exampleHausa', ['Misalin Hausa', 'Hausa example'], { textarea: true, maxLength: 3000 });
  const examplesEn = addField(grid, 'exampleEnglish', ['Misalin Turanci', 'English example'], { textarea: true, maxLength: 3000 });
  const pronunciationHa = addField(grid, 'hausaPronunciationUrl', ['URL ɗin furucin Hausa (HTTPS)', 'Hausa pronunciation URL (HTTPS)'], { maxLength: 2000, placeholder: ['https://…', 'https://…'] });
  const pronunciationEn = addField(grid, 'englishPronunciationUrl', ['URL ɗin furucin Turanci (HTTPS)', 'English pronunciation URL (HTTPS)'], { maxLength: 2000, placeholder: ['https://…', 'https://…'] });
  grid.insertBefore(examplesHa.closest('.field'), relatedField);
  grid.insertBefore(examplesEn.closest('.field'), relatedField);
  grid.insertBefore(pronunciationHa.closest('.field'), relatedField);
  grid.insertBefore(pronunciationEn.closest('.field'), relatedField);

  const languageButton = document.createElement('button');
  languageButton.type = 'button';
  languageButton.className = 'btn dark';
  languageButton.id = 'languageToggle';
  languageButton.addEventListener('click', () => {
    language = language === 'ha' ? 'en' : 'ha';
    localStorage.setItem(LANGUAGE_KEY, language);
    applyLanguage();
  });
  document.querySelector('.top-actions').prepend(languageButton);

  function applyLanguage() {
    language = getLanguage();
    document.documentElement.lang = language;
    document.title = language === 'ha' ? 'Admin | MK Hausa Dictionary' : 'Admin | MK Hausa Dictionary';
    $('googleSignIn').textContent = language === 'ha' ? 'G ✦  Ci gaba da Google' : 'G ✦  Continue with Google';
    $('signOut').textContent = language === 'ha' ? 'Fita' : 'Sign out';
    languageButton.textContent = language === 'ha' ? 'English' : 'Hausa';
    languageButton.setAttribute('aria-label', language === 'ha' ? 'Change interface language to English' : 'Canja harshen manhaja zuwa Hausa');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const original = node.nodeValue.trim();
      if (!original) continue;
      const translated = translate(original, language);
      if (translated !== original) node.nodeValue = node.nodeValue.replace(original, translated);
    }
    document.querySelectorAll('[data-ha][data-en]').forEach(element => {
      element.textContent = element.dataset[language];
    });
    document.querySelectorAll('[data-ha-placeholder][data-en-placeholder]').forEach(element => {
      element.placeholder = element.dataset[language === 'ha' ? 'haPlaceholder' : 'enPlaceholder'];
    });
    for (const id of ['entriesPageInfo', 'activityPageInfo']) {
      const element = $(id);
      const hausa = element.textContent.match(/^Ana nuna (.+) cikin ([\d,]+) (kalma|aiki)$/);
      const english = element.textContent.match(/^Showing (.+) of ([\d,]+) (entries|activities)$/);
      if (language === 'en' && hausa) element.textContent = `Showing ${hausa[1]} of ${hausa[2]} ${hausa[3] === 'aiki' ? 'activities' : 'entries'}`;
      if (language === 'ha' && english) element.textContent = `Ana nuna ${english[1]} cikin ${english[2]} ${english[3] === 'activities' ? 'aiki' : 'kalma'}`;
    }
    $('entrySearch').placeholder = language === 'ha' ? 'Nemo kalma…' : 'Search entries…';
    $('statusFilter').options[0].textContent = language === 'ha' ? 'Dukkan status' : 'All statuses';
  }

  setNotice(originalNotice => {
    showNotice = (message, error = false) => originalNotice(translateNotice(String(message), language), error);
    return showNotice;
  });

  setOpenForm(originalOpenForm => function openLocalizedEntryForm(entry) {
    currentFormEntry = entry || null;
    originalOpenForm(entry);
    const pair = readExamplePairs(entry?.examples)[0] || { ha: '', en: '' };
    originalExampleValues = pair;
    examplesHa.value = pair.ha;
    examplesEn.value = pair.en;
    pronunciationHa.value = entry?.hausa_pronunciation_url || '';
    pronunciationEn.value = entry?.english_pronunciation_url || '';
    applyLanguage();
  });

  setLoadEntries(originalLoadEntries => async function loadLocalizedEntries(...args) {
    await originalLoadEntries(...args);
    applyLanguage();
  });
  for (const setLoader of [setLoadFeedback, setLoadActivity, setLoadAccess, setLoadActivityEmployees]) {
    setLoader(originalLoader => async function loadLocalizedPanel(...args) {
      await originalLoader(...args);
      applyLanguage();
    });
  }

  const originalConfirm = window.confirm.bind(window);
  window.confirm = message => originalConfirm(translateNotice(String(message), language));

  $('entryForm').addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (saving) return;

    const id = $('entryId').value.trim();
    const user = getUser();
    const hausaWord = $('hausaWord').value.trim();
    const englishTranslation = $('englishTranslation').value.trim();
    if (!user || !hausaWord || !englishTranslation) {
      showNotice(language === 'ha' ? 'Cika kalmar Hausa da fassarar Turanci.' : 'Enter both the Hausa headword and English translation.', true);
      return;
    }

    // This checks only the currently loaded admin results; it cannot guarantee uniqueness across sessions.
    const duplicate = findDuplicateHausaHeadword(getEntries(), hausaWord, id || null);
    if (duplicate) {
      showNotice(
        language === 'ha'
          ? `An riga an lissafa kalmar Hausa “${duplicate.hausa_word}”. Ba a canza kalmar da ke akwai ba.`
          : `The Hausa headword “${duplicate.hausa_word}” is already listed. The existing entry was not changed.`,
        true
      );
      return;
    }

    const urlValue = (input, original) => {
      const value = input.value.trim();
      if (!value) return null;
      const normalized = normalizePronunciationUrl(value);
      if (normalized) return normalized;
      if (currentFormEntry && value === original) return original;
      throw new Error(language === 'ha' ? 'URL ɗin furuci dole ya kasance HTTPS mai inganci.' : 'Pronunciation URL must be a valid HTTPS URL.');
    };

    let hausaUrl;
    let englishUrl;
    try {
      hausaUrl = urlValue(pronunciationHa, currentFormEntry?.hausa_pronunciation_url || '');
      englishUrl = urlValue(pronunciationEn, currentFormEntry?.english_pronunciation_url || '');
    } catch (error) {
      showNotice(error.message, true);
      return;
    }

    const record = {
      hausa_word: hausaWord,
      english_translation: englishTranslation,
      hausa_meaning: $('hausaMeaning').value.trim() || null,
      english_meaning: $('englishMeaning').value.trim() || null,
      part_of_speech: $('partOfSpeech').value.trim() || null,
      hausa_pronunciation_url: hausaUrl,
      english_pronunciation_url: englishUrl,
      examples: currentFormEntry &&
        examplesHa.value.trim() === originalExampleValues.ha &&
        examplesEn.value.trim() === originalExampleValues.en
        ? currentFormEntry.examples
        : updateFirstExamplePair(currentFormEntry?.examples, examplesHa.value, examplesEn.value),
      related_words: $('relatedWords').value.split(',').map(word => word.trim()).filter(Boolean),
      status: $('entryStatus').value,
      updated_by: user.id
    };

    const needsPublishPermission = record.status !== 'draft' &&
      (!id || record.status !== currentFormEntry?.status);
    saving = true;
    const submitButton = $('entryForm').querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      if (needsPublishPermission) {
        const { data: canPublish, error: permissionError } = await supabase.rpc(
          'current_admin_can',
          { p_permission: 'entries_publish' }
        );
        if (permissionError) throw permissionError;
        if (canPublish !== true) {
          showNotice(
            language === 'ha'
              ? 'Ba ka da izinin wallafa ko adana wannan kalma. Zaɓi daftari ko nemi izinin wallafa.'
              : 'You are not allowed to publish or archive this entry. Save as draft or ask for publish access.',
            true
          );
          return;
        }
      }

      const result = id
        ? await supabase.from('dictionary_entries').update(record).eq('id', id)
        : await supabase.from('dictionary_entries').insert({ ...record, created_by: user.id });
      if (result.error) {
        const permissionDenied = result.error.code === '42501';
        showNotice(
          permissionDenied
            ? translate(
              needsPublishPermission
                ? 'You are not allowed to publish or archive this entry. Save as draft or ask for publish access.'
                : 'You are not allowed to make this change. Ask the owner for the required permission.',
              language
            )
            : (language === 'ha' ? 'Ba a iya ajiye kalma ba: ' : 'Could not save entry: ') + result.error.message,
          true
        );
        return;
      }

      $('entryModal').hidden = true;
      showNotice(language === 'ha' ? 'An ajiye kalma.' : 'Entry saved.');
      await loadEntries();
    } catch (error) {
      showNotice((language === 'ha' ? 'Ba a iya ajiye kalma ba: ' : 'Could not save entry: ') + (error?.message || String(error)), true);
    } finally {
      saving = false;
      submitButton.disabled = false;
    }
  }, true);

  window.addEventListener('storage', event => {
    if (event.key !== LANGUAGE_KEY || !event.newValue) return;
    language = getLanguage();
    applyLanguage();
  });

  applyLanguage();
}
