'use strict';

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const emptyTitleEl = document.getElementById('empty-title');
const emptyHintEl = document.getElementById('empty-hint');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('count');
const memoryEl = document.getElementById('memory');
const filtersEl = document.querySelector('.filters');
const chips = Array.from(document.querySelectorAll('.chip'));
const sleepBtn = document.getElementById('sleep');
const sleepLabelEl = document.getElementById('sleep-label');
const dedupeBtn = document.getElementById('dedupe');
const dupeCountEl = document.getElementById('dupe-count');
const copyBtn = document.getElementById('copy');
const copyLabelEl = document.getElementById('copy-label');

const COPY_LABEL = 'Bağlantıları kopyala';
const INITIAL_LIMIT = 120;
const MORE_STEP = 120;
const SEARCH_DELAY = 90;
const COPY_FEEDBACK = 1600;
const SLEEP_CONFIRM_TIME = 3500;
const SLEEP_FEEDBACK = 1600;

const state = {
  tabs: [],
  currentWindowId: null,
  query: '',
  filter: 'all',
  selected: 0,
  flat: [],
  rows: [],
  selectedRow: null,
  renderLimit: INITIAL_LIMIT,
  sleepConfirm: false,
  sleepFeedback: false,
};

const ICONS = {
  pin:
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.7l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 5 6 9H2v6h4l5 4V5z"/>' +
    '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
};

let searchTimer = null;
let copyTimer = null;
let sleepTimer = null;
let sleepFeedbackTimer = null;

/* Yardımcılar */

function createEl(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function formatUrl(raw) {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const path = url.pathname === '/' ? '' : url.pathname;
      return `${url.hostname.replace(/^www\./, '')}${path}${url.search}`;
    }
  } catch (_) {
    /* geçersiz URL */
  }
  return raw.replace(/\/$/, '');
}

function createFavicon(tab) {
  const wrap = createEl('span', 'favicon');
  const initial = ((tab.title || '').trim()[0] || '?').toLocaleUpperCase('tr');
  wrap.append(createEl('span', 'favicon-fallback', initial));

  const src = tab.favIconUrl;
  if (src && /^(https?:|data:|chrome-extension:)/i.test(src)) {
    const img = new Image(16, 16);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
    img.src = src;
    wrap.append(img);
  }
  return wrap;
}

function createBadge(icon, label) {
  const badge = createEl('span', 'badge');
  badge.title = label;
  badge.innerHTML = icon;
  return badge;
}

function canDiscard(tab) {
  return (
    !tab.active &&
    !tab.discarded &&
    !tab.audible &&
    !tab.pinned &&
    tab.autoDiscardable !== false
  );
}

/* Sekmeleri grupla */

function sortTabs(tabs) {
  return tabs
    .slice()
    .sort((a, b) => a.windowId - b.windowId || a.index - b.index);
}

function groupTabs(tabs) {
  const byWindow = new Map();
  for (const tab of tabs) {
    if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
    byWindow.get(tab.windowId).push(tab);
  }

  const groups = [];
  if (byWindow.has(state.currentWindowId)) {
    groups.push({ windowId: state.currentWindowId, tabs: byWindow.get(state.currentWindowId) });
    byWindow.delete(state.currentWindowId);
  }
  for (const [windowId, windowTabs] of byWindow) {
    groups.push({ windowId, tabs: windowTabs });
  }
  return groups;
}

function isRealPage(url) {
  if (!url) return false;
  return !/^(about:(blank|newtab)|chrome:\/\/newtab|chrome:\/\/startpage|edge:\/\/newtab)/i.test(url);
}

function findDuplicates(tabs) {
  const byUrl = new Map();
  for (const tab of tabs) {
    if (!isRealPage(tab.url)) continue;
    if (!byUrl.has(tab.url)) byUrl.set(tab.url, []);
    byUrl.get(tab.url).push(tab);
  }

  const duplicates = [];
  for (const list of byUrl.values()) {
    if (list.length < 2) continue;
    const keep =
      list.find((tab) => tab.pinned) ||
      list.find((tab) => tab.windowId === state.currentWindowId && tab.active) ||
      list.find((tab) => tab.windowId === state.currentWindowId) ||
      list.find((tab) => tab.active) ||
      list.find((tab) => !tab.discarded) ||
      list[0];
    for (const tab of list) {
      if (tab.id !== keep.id) duplicates.push(tab);
    }
  }
  return duplicates;
}

function getSleepCandidates() {
  return state.tabs.filter(
    (tab) => tab.windowId === state.currentWindowId && canDiscard(tab)
  );
}

/* Sekme satırı */

function createTabRow(tab, index) {
  const row = document.createElement('div');
  row.className = 'tab';
  row.dataset.index = String(index);
  row.setAttribute('role', 'option');
  row.setAttribute('aria-selected', index === state.selected ? 'true' : 'false');
  row.title = [
    tab.title,
    tab.url,
    tab.discarded ? 'Askıya alınmış sekme: tıklayınca yeniden yüklenir' : '',
  ]
    .filter(Boolean)
    .join('\n');
  if (tab.active) row.classList.add('active');
  if (tab.discarded) row.classList.add('discarded');
  if (index === state.selected) row.classList.add('selected');

  row.append(createFavicon(tab));

  const text = createEl('div', 'text');
  const title = createEl('div', 'title', tab.title || formatUrl(tab.url) || 'Başlıksız sekme');
  const url = createEl('div', 'url', formatUrl(tab.url));
  text.append(title, url);
  row.append(text);

  if (tab.pinned || tab.audible || tab.discarded) {
    const badges = createEl('div', 'badges');
    if (tab.pinned) badges.append(createBadge(ICONS.pin, 'Sabitlenmiş sekme'));
    if (tab.audible) badges.append(createBadge(ICONS.sound, 'Ses çalıyor'));
    if (tab.discarded) {
      const sleeping = createEl('span', 'badge-text', 'uykuda');
      sleeping.title = 'Bellekten boşaltılmış; tıklayınca yeniden yüklenir';
      badges.append(sleeping);
    }
    row.append(badges);
  }

  const actions = createEl('div', 'actions');
  if (canDiscard(tab)) {
    const sleep = document.createElement('button');
    sleep.type = 'button';
    sleep.className = 'row-action sleep';
    sleep.title = 'Sekmeyi bellekten boşalt';
    sleep.setAttribute('aria-label', `${tab.title || 'Sekme'} sekmesini askıya al`);
    sleep.innerHTML = ICONS.moon;
    actions.append(sleep);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'row-action close';
  close.textContent = '×';
  close.title = 'Sekmeyi kapat';
  close.setAttribute('aria-label', `${tab.title || 'Sekme'} sekmesini kapat`);
  actions.append(close);
  row.append(actions);

  return row;
}

/* Görünüm */

function getFilteredTabs() {
  const tokens = state.query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({ tr: token.toLocaleLowerCase('tr'), en: token.toLowerCase() }));

  return state.tabs.filter((tab) => {
    if (state.filter === 'window' && tab.windowId !== state.currentWindowId) return false;
    if (state.filter === 'audio' && !tab.audible) return false;
    if (state.filter === 'pinned' && !tab.pinned) return false;
    if (!tokens.length) return true;

    const title = (tab.title || '').toLocaleLowerCase('tr');
    const url = (tab.url || '').toLowerCase();
    return tokens.every((token) => title.includes(token.tr) || url.includes(token.en));
  });
}

function render() {
  const matching = getFilteredTabs();
  const groups = groupTabs(matching);
  state.flat = groups.flatMap((group) => group.tabs);
  if (state.selected >= state.flat.length) {
    state.selected = Math.max(0, state.flat.length - 1);
  }

  const fragment = document.createDocumentFragment();
  state.rows = [];
  let rowIndex = 0;
  let windowNumber = 0;
  let remaining = state.renderLimit;

  for (const group of groups) {
    if (remaining <= 0) break;
    windowNumber += 1;
    const isCurrent = group.windowId === state.currentWindowId;
    const section = createEl('section', 'group');
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', isCurrent ? 'Bu pencere' : `Pencere ${windowNumber}`);

    const header = createEl('div', 'group-title');
    header.append(createEl('span', '', isCurrent ? 'Bu pencere' : `Pencere ${windowNumber}`));
    header.append(createEl('span', 'group-count', String(group.tabs.length)));
    section.append(header);

    for (const tab of group.tabs) {
      if (remaining <= 0) break;
      const row = createTabRow(tab, rowIndex);
      state.rows.push(row);
      section.append(row);
      rowIndex += 1;
      remaining -= 1;
    }
    fragment.append(section);
  }

  if (state.flat.length > state.rows.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more';
    more.textContent = `Daha fazla göster (${state.flat.length - state.rows.length})`;
    fragment.append(more);
  }

  listEl.replaceChildren(fragment);
  state.selectedRow = state.rows[state.selected] || null;

  const hasTabs = state.flat.length > 0;
  listEl.hidden = !hasTabs;
  emptyEl.hidden = hasTabs;

  if (!hasTabs) {
    const hasQuery = Boolean(state.query.trim());
    if (hasQuery) {
      emptyTitleEl.textContent = 'Eşleşen sekme yok';
      emptyHintEl.textContent = 'Farklı bir şey aramayı dene.';
    } else if (state.filter !== 'all') {
      emptyTitleEl.textContent = 'Bu filtrede sekme yok';
      emptyHintEl.textContent = 'Başka bir filtre seç veya aramayı temizle.';
    } else {
      emptyTitleEl.textContent = 'Açık sekme yok';
      emptyHintEl.textContent = 'Yeni bir sekme açtığında burada görünür.';
    }
  }

  const total = state.tabs.length;
  const shown = state.flat.length;
  const filtered = state.filter !== 'all' || Boolean(state.query.trim());
  if (filtered) {
    countEl.textContent = `${shown} / ${total} sekme`;
  } else {
    countEl.textContent = `${total} sekme`;
  }

  updateMemory();
  updateFooter();
  updateSleepButton();
}

function setSelected(index, scroll = true) {
  if (!state.flat.length) return;
  const nextIndex = Math.max(0, Math.min(index, state.flat.length - 1));

  if (nextIndex >= state.rows.length) {
    state.selected = nextIndex;
    state.renderLimit = Math.max(state.renderLimit, nextIndex + 1);
    render();
  } else {
    const prev = state.selectedRow;
    const next = state.rows[nextIndex];
    state.selected = nextIndex;
    state.selectedRow = next;
    if (prev && prev !== next) {
      prev.classList.remove('selected');
      prev.setAttribute('aria-selected', 'false');
    }
    if (next && next !== prev) {
      next.classList.add('selected');
      next.setAttribute('aria-selected', 'true');
    }
  }

  const row = state.rows[state.selected];
  if (scroll && row) row.scrollIntoView({ block: 'nearest' });
}

function moveSelection(delta) {
  if (!state.flat.length) return;
  const next = (state.selected + delta + state.flat.length) % state.flat.length;
  setSelected(next);
}

function updateMemory() {
  const discarded = state.tabs.reduce((total, tab) => total + (tab.discarded ? 1 : 0), 0);
  memoryEl.textContent = `${discarded} uykuda`;
  memoryEl.title = discarded
    ? `${discarded} sekme bellekte tutulmuyor; tıklanınca yeniden yüklenir.`
    : 'Bellekten boşaltılmış sekme yok.';
}

function updateFooter() {
  const duplicates = findDuplicates(state.tabs);
  dedupeBtn.disabled = duplicates.length === 0;
  dupeCountEl.hidden = duplicates.length === 0;
  dupeCountEl.textContent = String(duplicates.length);
  dedupeBtn.title = duplicates.length
    ? `${duplicates.length} yinelenen sekmeyi kapatır; sabitlenmiş veya etkin kopya korunur`
    : 'Yinelenen sekme yok';

  const visible = state.flat.length;
  copyBtn.disabled = visible === 0;
  copyBtn.title = visible
    ? `Eşleşen ${visible} sekmenin adresini satır satır kopyalar`
    : 'Kopyalanacak sekme yok';
}

function updateSleepButton() {
  const candidates = getSleepCandidates().length;

  if (state.sleepConfirm) {
    sleepBtn.disabled = false;
    sleepBtn.classList.add('confirm');
    sleepBtn.classList.remove('success');
    sleepLabelEl.textContent = 'Onayla?';
    sleepBtn.title = 'Tekrar tıkla: bu penceredeki uygun sekmeler bellekten boşaltılacak';
    sleepBtn.setAttribute('aria-label', 'Askıya alma işlemini onayla');
    return;
  }

  if (state.sleepFeedback) {
    sleepBtn.disabled = true;
    sleepBtn.classList.remove('confirm');
    sleepBtn.classList.add('success');
    sleepLabelEl.textContent = 'Tamam';
    sleepBtn.setAttribute('aria-label', 'Sekmeler askıya alındı');
    return;
  }

  sleepBtn.disabled = candidates === 0;
  sleepBtn.classList.remove('confirm', 'success');
  sleepLabelEl.textContent = 'Askıya al';
  sleepBtn.title = candidates
    ? `Bu penceredeki ${candidates} uygun sekmeyi bellekten boşaltır; tıklanınca yeniden yüklenir`
    : 'Bu pencerede askıya alınacak uygun sekme yok';
  sleepBtn.setAttribute(
    'aria-label',
    candidates
      ? `Bu penceredeki ${candidates} sekmeyi askıya al`
      : 'Askıya alınacak uygun sekme yok'
  );
}

function syncChips() {
  for (const chip of chips) {
    const active = chip.dataset.filter === state.filter;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

/* Eylemler */

async function activateTab(tab) {
  try {
    await chrome.tabs.update(tab.id, { active: true });
  } catch (_) {
    /* sekme arada kapanmış olabilir */
  }
  try {
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch (_) {
    /* pencere kapanmış olabilir */
  }
  window.close();
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (_) {
    /* zaten kapalıysa yok say */
  }
  state.tabs = state.tabs.filter((tab) => tab.id !== tabId);
  render();
  searchEl.focus({ preventScroll: true });
}

async function discardTab(tabId) {
  if (typeof chrome.tabs.discard !== 'function') return;
  const tab = state.tabs.find((item) => item.id === tabId);
  if (!tab || !canDiscard(tab)) return;

  try {
    await chrome.tabs.discard(tabId);
    tab.discarded = true;
  } catch (_) {
    return;
  }
  render();
  searchEl.focus({ preventScroll: true });
}

async function closeDuplicates() {
  const duplicates = findDuplicates(state.tabs);
  if (!duplicates.length) return;

  const results = await Promise.allSettled(
    duplicates.map((tab) => chrome.tabs.remove(tab.id))
  );
  const closedIds = new Set(
    duplicates
      .filter((_, index) => results[index].status === 'fulfilled')
      .map((tab) => tab.id)
  );
  if (!closedIds.size) return;

  state.tabs = state.tabs.filter((tab) => !closedIds.has(tab.id));
  render();
  searchEl.focus({ preventScroll: true });
}

async function discardCurrentWindow() {
  if (typeof chrome.tabs.discard !== 'function') return;
  const candidates = getSleepCandidates();
  resetSleepConfirm();
  if (!candidates.length) {
    updateSleepButton();
    return;
  }

  state.sleepFeedback = true;
  sleepBtn.disabled = true;
  sleepBtn.classList.add('success');
  sleepBtn.classList.remove('confirm');
  sleepLabelEl.textContent = 'Tamam';
  sleepBtn.title = `${candidates.length} sekme askıya alınıyor…`;

  const results = await Promise.allSettled(
    candidates.map((tab) => chrome.tabs.discard(tab.id))
  );
  let discarded = 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      candidates[index].discarded = true;
      discarded += 1;
    }
  });

  render();
  if (!discarded) {
    sleepLabelEl.textContent = 'Olmadı';
    sleepBtn.title = 'Sekmeler askıya alınamadı; başka bir sekme etkin olmuş olabilir.';
  } else {
    sleepBtn.title = `${discarded} sekme askıya alındı; tıklanınca yeniden yüklenir.`;
  }

  clearTimeout(sleepFeedbackTimer);
  sleepFeedbackTimer = setTimeout(() => {
    state.sleepFeedback = false;
    sleepBtn.classList.remove('success');
    updateSleepButton();
  }, SLEEP_FEEDBACK);
}

function handleSleepClick() {
  if (sleepBtn.disabled) return;

  if (!state.sleepConfirm) {
    if (!getSleepCandidates().length) {
      updateSleepButton();
      return;
    }
    state.sleepConfirm = true;
    updateSleepButton();
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(resetSleepConfirm, SLEEP_CONFIRM_TIME);
    return;
  }

  discardCurrentWindow();
}

function resetSleepConfirm() {
  clearTimeout(sleepTimer);
  sleepTimer = null;
  if (!state.sleepConfirm) return;
  state.sleepConfirm = false;
  updateSleepButton();
}

function flashCopyLabel(text, ok = true) {
  clearTimeout(copyTimer);
  copyLabelEl.textContent = text;
  copyBtn.classList.toggle('success', ok);
  copyBtn.classList.toggle('error', !ok);
  copyTimer = setTimeout(() => {
    copyLabelEl.textContent = COPY_LABEL;
    copyBtn.classList.remove('success', 'error');
  }, COPY_FEEDBACK);
}

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  }
  area.remove();
  return ok;
}

async function copyLinks() {
  flushSearchRender();
  const urls = state.flat.map((tab) => tab.url).filter(Boolean);
  if (!urls.length) return;

  const text = urls.join('\n');
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (_) {
    ok = false;
  }
  if (!ok) ok = legacyCopy(text);

  flashCopyLabel(
    ok ? `${urls.length} bağlantı kopyalandı` : 'Kopyalanamadı',
    ok
  );
}

/* Olaylar */

function scheduleSearchRender() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    listEl.scrollTop = 0;
    render();
  }, SEARCH_DELAY);
}

function flushSearchRender() {
  if (searchTimer === null) return;
  clearTimeout(searchTimer);
  searchTimer = null;
  state.query = searchEl.value;
  listEl.scrollTop = 0;
  render();
}

function setFilter(filter) {
  if (!['all', 'window', 'audio', 'pinned'].includes(filter)) return;
  state.filter = filter;
  state.selected = 0;
  state.renderLimit = INITIAL_LIMIT;
  syncChips();
  clearTimeout(searchTimer);
  searchTimer = null;
  listEl.scrollTop = 0;
  render();
}

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  state.selected = 0;
  state.renderLimit = INITIAL_LIMIT;
  scheduleSearchRender();
});

filtersEl.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  setFilter(chip.dataset.filter);
  if (event.detail > 0) searchEl.focus({ preventScroll: true });
});

sleepBtn.addEventListener('click', handleSleepClick);

listEl.addEventListener('click', (event) => {
  const more = event.target.closest('.more');
  if (more) {
    state.renderLimit += MORE_STEP;
    render();
    return;
  }

  const row = event.target.closest('.tab');
  if (!row) return;
  const tab = state.flat[Number(row.dataset.index)];
  if (!tab) return;

  if (event.target.closest('.close')) {
    closeTab(tab.id);
    return;
  }
  if (event.target.closest('.sleep')) {
    discardTab(tab.id);
    return;
  }
  activateTab(tab);
});

listEl.addEventListener('auxclick', (event) => {
  if (event.button !== 1) return;
  const row = event.target.closest('.tab');
  if (!row || event.target.closest('button')) return;
  const tab = state.flat[Number(row.dataset.index)];
  if (!tab) return;
  event.preventDefault();
  closeTab(tab.id);
});

listEl.addEventListener('pointerover', (event) => {
  const row = event.target.closest('.tab');
  if (!row) return;
  const index = Number(row.dataset.index);
  if (index !== state.selected) setSelected(index, false);
});

document.addEventListener('keydown', (event) => {
  if (event.isComposing) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    flushSearchRender();
    moveSelection(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    flushSearchRender();
    moveSelection(-1);
    return;
  }

  if (event.key === 'Enter') {
    if (event.target instanceof HTMLButtonElement) return;
    flushSearchRender();
    const tab = state.flat[state.selected];
    if (tab) {
      event.preventDefault();
      activateTab(tab);
    }
    return;
  }

  if (event.key === 'Delete') {
    if (event.target instanceof HTMLButtonElement) return;
    flushSearchRender();
    const inSearch = event.target === searchEl;
    const caret = searchEl.selectionStart;
    const hasTextAfterCaret = caret !== null && caret < searchEl.value.length;

    if (inSearch && hasTextAfterCaret) return;

    const tab = state.flat[state.selected];
    if (tab) {
      event.preventDefault();
      closeTab(tab.id);
    }
    return;
  }

  if (event.key === 'Escape') {
    if (state.sleepConfirm) {
      resetSleepConfirm();
      return;
    }
    if (searchEl.value) {
      searchEl.value = '';
      state.query = '';
      state.selected = 0;
      state.renderLimit = INITIAL_LIMIT;
      clearTimeout(searchTimer);
      searchTimer = null;
      listEl.scrollTop = 0;
      render();
      return;
    }
    if (state.filter !== 'all') {
      setFilter('all');
      return;
    }
    window.close();
  }
});

dedupeBtn.addEventListener('click', closeDuplicates);
copyBtn.addEventListener('click', copyLinks);

/* Başlangıç */

async function init() {
  if (!globalThis.chrome?.tabs?.query) {
    countEl.textContent = 'Chrome uzantı ortamı gerekli';
    emptyTitleEl.textContent = 'Uzantı ortamı bulunamadı';
    emptyHintEl.textContent = 'Bu sayfayı chrome-extension:// adresi üzerinden aç.';
    emptyEl.hidden = false;
    listEl.hidden = true;
    return;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentWindowId = activeTab ? activeTab.windowId : null;
    state.tabs = sortTabs(await chrome.tabs.query({}));
  } catch (_) {
    countEl.textContent = 'Sekmeler yüklenemedi';
    emptyTitleEl.textContent = 'Sekmeler yüklenemedi';
    emptyHintEl.textContent = 'Uzantıyı chrome://extensions sayfasından yenileyip tekrar dene.';
    emptyEl.hidden = false;
    listEl.hidden = true;
    return;
  }

  render();
  requestAnimationFrame(() => searchEl.focus({ preventScroll: true }));
}

init();
