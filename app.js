'use strict';

/* =====================================================================
   Habits – persönlicher Habit-Tracker (läuft komplett lokal im Browser)
   Daten: localStorage. Jeder Tag hat einen eigenen Eintrag im Log, dadurch
   "resettet" sich die Liste jeden Tag von selbst.
   ===================================================================== */

const KEY = 'habit-tracker-v1';

/* ---------- Supabase (Cloud) ----------
   Die URL und der "publishable" Key sind bewusst öffentlich. Geschützt sind die Daten
   durch Login + Row Level Security in der Datenbank, nicht durch Geheimhaltung des Keys.
   Niemals den service_role-Key hier eintragen. */
const SUPABASE_URL = 'https://syzrpidpcgkmpjowpcfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iOFLmwKaW6Qx65EBhPUzng_MH9q1IPg';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
// Öffentlicher VAPID-Schlüssel (der Private Key liegt nur als Secret in Supabase).
const VAPID_PUBLIC_KEY = 'BLC4GZLRsEzN6e5B_erIs_G9QTG-wPhqDabAjPoVJyyvi0fdvqgtmFAv-z_G3yhnHDTlwuYrWa16jtxWTRWrn8U';
const push = { state: 'idle' };                                // idle | on | error
const cloud = { user: null, sync: 'idle', lastSync: 0, lastAttempt: 0, busy: false, error: '', email: '' };
const WEEK = [1, 2, 3, 4, 5, 6, 0];                    // Mo..So als JS-getDay()-Werte
const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const $ = (s, r = document) => r.querySelector(s);
const fmt = (o) => new Intl.DateTimeFormat('de-DE', o);

/* ---------- Icons (Lucide-Stil, 24px, Strich 2) ---------- */
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>',
  skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  today: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  list: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Datum-Helfer ---------- */
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => key(new Date());

/* ---------- Zustand ---------- */
let state = load();
let view = 'today';
let viewDate = new Date();
let calMonth = { y: viewDate.getFullYear(), m: viewDate.getMonth() };
let lastPct = 0;
let editingId = null;
let reportDate = null;                                     // Tagesbericht: welcher Tag
let habitsSub = 'list';                                     // Habits-Seite: 'list' | 'reminders'
let draft = null;                                          // Formularentwurf (überlebt Neuzeichnen)
let formErr = '';
let deleteArmed = false;
const foldOpen = { skip: false, done: false };               // Heute: aufgeklappte Bereiche bleiben beim Neuzeichnen offen

// Uhrzeit + Vorlauf statt fester Erinnerungszeit: time = "HH:MM" oder '', before = Minuten vorher (0 = pünktlich) oder null (keine Erinnerung).
function migrateHabits(list) {
  for (const h of list) {
    if ('remind' in h) {                                    // alte Fassung: "remind" war die Erinnerungszeit → jetzt Uhrzeit, pünktlich
      if (h.time === undefined) { h.time = h.remind || ''; h.before = h.remind ? 0 : null; }
      delete h.remind;
    }
    if (h.time === undefined) h.time = '';
    if (h.before === undefined) h.before = null;
  }
  return list;
}
const BEFORE_OPTS = [[null, 'Nicht erinnern'], [0, 'Zur Uhrzeit'], [5, '5 Minuten vorher'], [10, '10 Minuten vorher'], [15, '15 Minuten vorher'], [30, '30 Minuten vorher'], [60, '1 Stunde vorher'], [120, '2 Stunden vorher']];
const MAX_BEFORE = 20160;                                    // längster Vorlauf: 14 Tage in Minuten
const PRESETS = BEFORE_OPTS.map(([v]) => v).filter((v) => v !== null);
const fmtLead = (b) => {                                     // 1980 → "1 Tag 9 Stunden"
  const d = Math.floor(b / 1440), h = Math.floor((b % 1440) / 60), m = b % 60;
  return [d && `${d} ${d === 1 ? 'Tag' : 'Tage'}`, h && `${h} ${h === 1 ? 'Stunde' : 'Stunden'}`, m && `${m} ${m === 1 ? 'Minute' : 'Minuten'}`].filter(Boolean).join(' ');
};
const beforeText = (b) => (b === 0 ? 'zur Uhrzeit' : `${fmtLead(b)} vorher`);
const customParts = (b) => (b % 1440 === 0 ? { n: b / 1440, u: 1440 } : b % 60 === 0 ? { n: b / 60, u: 60 } : { n: b, u: 1 });
const maxFor = (unit) => Math.floor(MAX_BEFORE / unit);
const remindAt = (h) => {                                    // Uhrzeit der Erinnerung (bei langem Vorlauf am Vortag oder früher)
  const [H, M] = h.time.split(':').map(Number);
  const m = (((H * 60 + M - h.before) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// Sync-Felder: ts = Änderungszeit je Tageseintrag ("2026-11-17|habitId" → ms), dirty = noch nicht hochgeladene Änderungen.
function emptyState() { return { habits: [], log: {}, skip: {}, ts: {}, dirty: { habits: {}, logs: {} }, notified: {} }; }
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.habits)) {
      const dirty = r.dirty || {};
      return { habits: migrateHabits(r.habits), log: r.log || {}, skip: r.skip || {}, ts: r.ts || {}, dirty: { habits: dirty.habits || {}, logs: dirty.logs || {} }, notified: r.notified || {} };
    }
  } catch (e) { /* leer starten */ }
  return emptyState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Speichern nicht möglich (Speicher voll oder gesperrt).', 'error'); }
}

/* ---------- Übersprungen: Gründe ----------
   Wer einen Habit überspringt, nennt einen Grund. "excused" = entschuldigt: zählt weder als nicht geschafft
   noch in die Quote. Alle anderen Gründe zählen als nicht geschafft. Nur Krankheit ist entschuldigt. */
const REASONS = [
  { id: 'sick', label: 'Krankheit', note: 'Zählt nicht zur Quote', excused: true },
  { id: 'vacation', label: 'Urlaub / Reise', note: 'Zählt als nicht geschafft' },
  { id: 'time', label: 'Keine Zeit', note: 'Zählt als nicht geschafft' },
  { id: 'other', label: 'Sonstiges', note: 'Zählt als nicht geschafft' },
];
const reasonOf = (id) => REASONS.find((r) => r.id === id);
const skipOf = (k, id) => (state.skip[k] && state.skip[k][id]) || null;
const isExcused = (k, id) => { const r = reasonOf(skipOf(k, id)); return !!(r && r.excused); };

/* ---------- Logik ---------- */
function scheduled(k) {
  const wd = parse(k).getDay();
  return state.habits.filter((h) => h.days.includes(wd) && h.created <= k && (!h.archived || h.archived > k));
}
const count = (k, id) => (state.log[k] && state.log[k][id]) || 0;
const counted = (k) => scheduled(k).filter((h) => !isExcused(k, h.id));   // entschuldigte (krank) zählen nicht
function dayPct(k) {
  const hs = counted(k);
  if (!hs.length) return null;
  const sum = hs.reduce((a, h) => a + Math.min(count(k, h.id) / h.target, 1), 0);
  return Math.round((sum / hs.length) * 100);
}
function setCount(k, h, n) {
  n = Math.max(0, Math.min(h.target, n));
  const day = (state.log[k] = state.log[k] || {});
  if (n === 0) delete day[h.id]; else day[h.id] = n;
  if (!Object.keys(day).length) delete state.log[k];
  const tk = k + '|' + h.id;
  state.ts[tk] = Date.now();                               // "0" bleibt als Eintrag erhalten, damit das Zurücknehmen mit synchronisiert wird
  state.dirty.logs[tk] = 1;
  save();
  queuePush();
  render();
  announce(h.target === 1 ? `${h.name}: ${n ? 'erledigt' : 'offen'}` : `${h.name}: ${n} von ${h.target}${n >= h.target ? ', erledigt' : ''}`);
}
function setSkip(k, h, reason) {                            // reason = Grund-ID oder null (Überspringen aufheben)
  const day = (state.skip[k] = state.skip[k] || {});
  if (reason) day[h.id] = reason; else delete day[h.id];
  if (!Object.keys(day).length) delete state.skip[k];
  const tk = k + '|' + h.id;                                 // Zählstand und Grund teilen sich eine Cloud-Zeile
  state.ts[tk] = Date.now();
  state.dirty.logs[tk] = 1;
  save();
  queuePush();
  render();
  const r = reasonOf(reason);
  announce(reason ? `${h.name}: übersprungen, ${r ? r.label : reason}` : `${h.name}: wieder offen`);
}
// Da die Ansicht komplett neu gerendert wird, melden wir Änderungen über eine dauerhafte Live-Region an Screenreader.
function announce(msg) {
  const r = $('#sr-live');
  r.textContent = '';
  setTimeout(() => { r.textContent = msg; }, 50);
}
function streak() {
  const first = state.habits.reduce((m, h) => (h.created < m ? h.created : m), todayKey());
  let d = new Date();
  if (dayPct(key(d)) !== 100) d = addDays(d, -1);        // heute noch offen → zählt gestern weiter
  let n = 0;
  for (let i = 0; i < 1000 && key(d) >= first; i++, d = addDays(d, -1)) {
    const p = dayPct(key(d));
    if (p === null) continue;                            // Tage ohne Habits überspringen
    if (p === 100) n++; else break;
  }
  return n;
}
function daysLabel(days) {
  if (days.length === 7) return 'Täglich';
  const idx = WEEK.map((d, i) => (days.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (idx.join() === '0,1,2,3,4') return 'Mo–Fr';
  if (idx.join() === '5,6') return 'Wochenende';
  return idx.map((i) => WD_SHORT[i]).join(', ');
}

/* ---------- Rendering ---------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// Tab-Leiste: 5 Reiter, in der Mitte "Neu" (Hauptaktion der App)
const TABS = [
  { id: 'today', href: '#heute', label: 'Heute', ic: 'today' },
  { id: 'calendar', href: '#kalender', label: 'Kalender', ic: 'calendar' },
  { id: 'new', href: '#neu', label: 'Neu', ic: 'plus', cls: 'tab-new' },
  { id: 'habits', href: '#gewohnheiten', label: 'Habits', ic: 'list' },
  { id: 'settings', href: '#einstellungen', label: 'Einstellungen', ic: 'gear' },
];
$('#tabbar').innerHTML = `<div class="tabbar-in">${TABS.map((t) =>
  `<a href="${t.href}" data-tab="${t.id}" class="${t.cls || ''}">${t.id === 'new' ? `<span class="plus">${icon(t.ic)}</span>` : `<span class="ico">${icon(t.ic)}</span>`}<span class="lbl">${t.label}</span></a>`).join('')}</div>`;
const tabOf = () => (view === 'report' ? 'calendar' : view === 'form' ? (editingId ? 'habits' : 'new') : view);

const VIEWS = { today: todayHTML, calendar: calendarHTML, report: reportHTML, form: formHTML, habits: habitsHTML, settings: settingsHTML };
function render(fresh) {
  if (!fresh && view === 'form') syncDraft();               // getippten Text vor dem Neuzeichnen sichern
  const fid = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.fid;
  $('#view').innerHTML = VIEWS[view]();
  const cur = tabOf();
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (fid) { const el = $(`[data-fid="${fid}"]`); if (el) el.focus({ preventScroll: true }); }
  if (view === 'today' || view === 'report') animateBar();
}

// Kompakte Tagesübersicht. Aufbau ist immer gleich (Prozent, Unterzeile, Serie, Balken), damit nichts springt.
function heroHTML(pct, sub, streakN) {
  const streakHTML = streakN === null ? '' :
    `<div class="hero-streak ${streakN ? '' : 'off'}" role="img" aria-label="Serie: ${streakN} ${streakN === 1 ? 'Tag' : 'Tage'} in Folge"><span class="fire" aria-hidden="true">🔥</span><strong aria-hidden="true">${streakN}</strong></div>`;
  return `<section class="hero" aria-label="Tagesübersicht">
    <div class="hero-main"><div class="hero-pct">${pct === null ? '–' : `${pct}<span>%</span>`}</div><div class="hero-sub">${sub}</div></div>
    ${streakHTML}
    <div class="hero-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" ${pct === null ? '' : `aria-valuenow="${pct}"`} aria-label="Fortschritt"><i data-pct="${pct ?? 0}" style="transform:scaleX(${lastPct / 100})"></i></div>
  </section>`;
}
function animateBar() {
  const bar = $('.hero-bar i');
  if (!bar) return;
  const target = Number(bar.dataset.pct);
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = `scaleX(${target / 100})`; }));
  lastPct = target;
}

function todayHTML() {
  const k = key(viewDate);
  const isToday = k === todayKey();
  const isFuture = k > todayKey();
  const hs = scheduled(k);
  const cs = counted(k);
  const pct = dayPct(k);
  const doneCount = cs.filter((h) => count(k, h.id) >= h.target).length;

  const head = `<header class="page-head">
    <button class="icon-btn" data-action="day-prev" aria-label="Vorheriger Tag">${icon('left')}</button>
    <div class="titles"><h1>${isToday ? 'Heute' : esc(fmt({ weekday: 'long' }).format(viewDate))}</h1>
      <p>${esc(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(viewDate))}</p></div>
    <button class="icon-btn" data-action="day-next" aria-label="Nächster Tag" ${isToday ? 'disabled' : ''}>${icon('right')}</button>
  </header>`;

  if (!state.habits.length || (isToday && !state.habits.some((h) => !h.archived))) {
    return `<div class="view-in">${head}<div class="empty">
      <h2>Noch keine Gewohnheiten</h2>
      <p>Lege deine erste an, zum Beispiel „2 Bananen essen“ oder „Wasser trinken“.</p>
      <button class="btn primary" data-action="new">${icon('plus')} Gewohnheit anlegen</button></div></div>`;
  }

  const backBtn = isToday ? '' : `<button class="btn block" data-action="go-today" style="margin-bottom:16px">Zurück zu heute</button>`;
  const sub = cs.length ? `${doneCount} von ${cs.length} erledigt` : hs.length ? 'Alles übersprungen' : 'Nichts geplant';
  const hero = heroHTML(pct, sub, streak());

  const open = [], skipped = [], done = [];
  for (const h of hs) { if (skipOf(k, h.id)) skipped.push(h); else if (count(k, h.id) >= h.target) done.push(h); else open.push(h); }
  const canSwipe = !isFuture;

  let main;
  if (!hs.length) main = `<div class="empty"><h2>Für diesen Tag ist nichts geplant</h2><p>Heute ist Pause.</p></div>`;
  else if (open.length) main = `<ul class="list">${open.map((h) => habitRow(k, h, isFuture, canSwipe)).join('')}</ul>${canSwipe ? `<p class="hint swipe-hint">Nach links wischen löscht, nach rechts überspringt.</p>` : ''}`;
  else main = `<div class="empty compact"><h2>Nichts mehr offen</h2><p>Gut gemacht.</p></div>`;

  const folds = foldHTML('skip', 'Übersprungen', skipped, (h) => skippedRow(k, h, isFuture)) + foldHTML('done', 'Erledigt', done, (h) => habitRow(k, h, isFuture, false));
  return `<div class="view-in">${head}${backBtn}${hero}${main}${folds}</div>`;
}

// Einklappbarer Bereich ("Übersprungen", "Erledigt"): standardmäßig zu, der Zustand bleibt beim Neuzeichnen erhalten.
function foldHTML(id, title, items, rowFn) {
  if (!items.length) { foldOpen[id] = false; return ''; }   // leerer Bereich verschwindet und startet beim nächsten Mal wieder zugeklappt
  return `<details class="fold" data-fold="${id}" ${foldOpen[id] ? 'open' : ''}>
    <summary><span>${title}</span><span class="count-badge">${items.length}</span>${icon('right', 'chev')}</summary>
    <ul class="list">${items.map(rowFn).join('')}</ul></details>`;
}

function habitInner(k, h, disabled) {
  const c = count(k, h.id);
  const isDone = c >= h.target;
  const meta = h.time ? `${icon('clock')} ${esc(h.time)}${h.before !== null ? `${icon('bell')}<span class="sr">, mit Erinnerung</span>` : ''}` : '';
  const info = `<div class="info"><div class="name">${esc(h.name)}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div>`;
  const check = `<span class="check" aria-hidden="true">${icon('check')}</span>`;
  if (h.target === 1) {
    return `<button class="habit ${isDone ? 'done' : ''}" data-action="toggle" data-id="${h.id}" data-fid="t-${h.id}" aria-pressed="${isDone}" ${disabled ? 'disabled' : ''}>${check}${info}</button>`;
  }
  return `<div class="habit ${isDone ? 'done' : ''}">${check}${info}
    <div class="counter">
      <button class="icon-btn" data-action="dec" data-id="${h.id}" data-fid="d-${h.id}" aria-label="${esc(h.name)}: eins weniger" ${c === 0 || disabled ? 'disabled' : ''}>${icon('minus')}</button>
      <span class="count">${c}<span class="sr"> von </span><span aria-hidden="true">/</span>${h.target}</span>
      <button class="icon-btn add" data-action="inc" data-id="${h.id}" data-fid="i-${h.id}" aria-label="${esc(h.name)}: eins mehr" ${isDone || disabled ? 'disabled' : ''}>${icon('plus')}</button>
    </div></div>`;
}
function habitRow(k, h, disabled, swipe) {
  return swipe ? swipeRow(h, habitInner(k, h, disabled), true) : `<li>${habitInner(k, h, disabled)}</li>`;
}
// Zeile zum Wischen: nach links = löschen (rot), nach rechts = überspringen (nur wenn skip = true).
// Dazu zwei Knöpfe, die erst beim Tastatur-Fokus sichtbar sind (Alternative zur Wischgeste, auch für Screenreader).
function swipeRow(h, inner, skip) {
  return `<li class="swipe" data-id="${h.id}" data-right="${skip ? 1 : 0}">
    ${skip ? `<div class="swipe-bg skip" aria-hidden="true">${icon('skip')}</div>` : ''}
    <div class="swipe-bg del" aria-hidden="true">${icon('trash')}</div>
    <div class="swipe-front">${inner}</div>
    <div class="swipe-alt">${skip ? `<button type="button" class="sr-btn" data-action="skip-ask" data-id="${h.id}">${esc(h.name)} überspringen</button>` : ''}<button type="button" class="sr-btn" data-action="del-ask" data-id="${h.id}">${esc(h.name)} löschen</button></div></li>`;
}
function skippedRow(k, h, disabled) {
  const r = reasonOf(skipOf(k, h.id));
  return `<li><div class="habit skipped"><span class="check skip-mark" aria-hidden="true">${icon('skip')}</span>
    <div class="info"><div class="name">${esc(h.name)}</div><div class="meta">${esc(r ? r.label : skipOf(k, h.id))}${r && r.excused ? ' · zählt nicht zur Quote' : ''}</div></div>
    <button type="button" class="btn ghost small" data-action="unskip" data-id="${h.id}" data-fid="u-${h.id}" ${disabled ? 'disabled' : ''}>Rückgängig</button></div></li>`;
}

function calendarHTML() {
  const { y, m } = calMonth;
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const tk = todayKey();
  const now = new Date();
  const isCurrent = y === now.getFullYear() && m === now.getMonth();

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cal-cell blank" aria-hidden="true"></div>';
  let sum = 0, n = 0, perfect = 0;
  for (let d = 1; d <= dim; d++) {
    const k = key(new Date(y, m, d));
    const future = k > tk;
    const p = future ? null : dayPct(k);
    const lvl = p === null ? 'none' : p === 0 ? 0 : p < 40 ? 1 : p < 70 ? 2 : p < 100 ? 3 : 4;
    if (p !== null) { sum += p; n++; if (p === 100) perfect++; }
    const label = `${fmt({ day: 'numeric', month: 'long' }).format(new Date(y, m, d))}${p === null ? (future ? ', in der Zukunft' : ', nichts geplant') : `, ${p} Prozent`}. Tagesbericht öffnen`;
    cells += `<button class="cal-cell ${k === tk ? 'today' : ''} ${future ? 'future' : ''}" data-l="${lvl}" data-action="open-day" data-date="${k}" aria-label="${esc(label)}" ${future ? 'disabled' : ''}>
      <span class="d">${d}</span><span class="p" aria-hidden="true">${p === null ? '' : p + '%'}</span></button>`;
  }
  const avg = n ? Math.round(sum / n) : 0;
  const title = fmt({ month: 'long', year: 'numeric' }).format(first);
  return `<div class="view-in">
    <header class="page-head">
      <button class="icon-btn" data-action="cal-prev" aria-label="Vorheriger Monat">${icon('left')}</button>
      <div class="titles"><h1>${esc(title)}</h1></div>
      <button class="icon-btn" data-action="cal-next" aria-label="Nächster Monat" ${isCurrent ? 'disabled' : ''}>${icon('right')}</button>
    </header>
    <section class="cal-card" aria-label="Kalender">
      <div class="cal-weekdays" aria-hidden="true">${WD_SHORT.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend" aria-hidden="true"><span>0 %</span><i style="background:var(--surface-2)"></i><i style="background:var(--l1)"></i><i style="background:var(--l2)"></i><i style="background:var(--l3)"></i><i style="background:var(--l4)"></i><span>100 %</span></div>
    </section>
    <section class="summary" aria-label="Monatsübersicht">
      <div class="stat"><div class="v">${n ? avg + ' %' : '–'}</div><div class="l">Ø Erfüllung</div></div>
      <div class="stat"><div class="v">${perfect}</div><div class="l">${perfect === 1 ? 'perfekter Tag' : 'perfekte Tage'}</div></div>
    </section>
    <p class="hint muted" style="margin-top:16px">Tippe auf einen Tag für den Tagesbericht.</p>
  </div>`;
}

/* ---------- Tagesbericht (aus dem Kalender) ---------- */
function reportHTML() {
  const k = reportDate;
  const d = parse(k);
  const isToday = k === todayKey();
  const hs = scheduled(k);
  const cs = counted(k);
  const pct = dayPct(k);
  const skipped = hs.filter((h) => skipOf(k, h.id));
  const ok = hs.filter((h) => !skipOf(k, h.id) && count(k, h.id) >= h.target);
  const miss = hs.filter((h) => !skipOf(k, h.id) && count(k, h.id) < h.target);
  const okCounted = cs.filter((h) => count(k, h.id) >= h.target).length;
  const row = (h, cls) => {
    const r = reasonOf(skipOf(k, h.id));
    const val = cls === 'skip' ? esc(r ? r.label : skipOf(k, h.id)) : `${count(k, h.id)} von ${h.target}`;
    return `<li class="rep-row ${cls}"><span class="mark" aria-hidden="true">${icon(cls === 'ok' ? 'check' : cls === 'skip' ? 'skip' : 'x')}</span>
    <div class="info"><div class="name">${esc(h.name)}</div></div><span class="val">${val}</span></li>`;
  };
  const group = (id, title, items, cls) => items.length
    ? `<section class="group" aria-labelledby="${id}"><h2 id="${id}">${title} <span class="count-badge">${items.length}</span></h2><ul class="list">${items.map((h) => row(h, cls)).join('')}</ul></section>` : '';
  const sub = cs.length ? `${okCounted} von ${cs.length} erledigt` : hs.length ? 'Alles übersprungen' : 'Nichts geplant';

  return `<div class="view-in">
    <a class="back" href="#kalender">${icon('left')} Kalender</a>
    <header class="page-head">
      <button class="icon-btn" data-action="rep-prev" aria-label="Vorheriger Tag">${icon('left')}</button>
      <div class="titles"><h1>${esc(fmt({ weekday: 'long' }).format(d))}</h1><p>${esc(fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(d))}</p></div>
      <button class="icon-btn" data-action="rep-next" aria-label="Nächster Tag" ${isToday ? 'disabled' : ''}>${icon('right')}</button>
    </header>
    ${heroHTML(pct, sub, null)}
    ${hs.length ? group('g-ok', 'Abgeschlossen', ok, 'ok') + group('g-miss', isToday ? 'Noch offen' : 'Versäumt', miss, 'miss') + group('g-skip', 'Übersprungen', skipped, 'skip')
      : '<div class="empty"><h2>Für diesen Tag war nichts geplant</h2></div>'}
    <div class="report-actions"><button class="btn" data-action="edit-day" data-date="${k}">${isToday ? 'Zu Heute' : 'Tag nachtragen oder ändern'}</button></div>
  </div>`;
}

/* ---------- Neu / Bearbeiten (ganze Seite statt Dialog) ---------- */
function newDraft(h) {
  const d = h ? { name: h.name, target: h.target, days: [...h.days], time: h.time || '', before: h.time ? h.before : null }
              : { name: '', target: 1, days: [...WEEK], time: '', before: null };
  d.custom = d.before !== null && !PRESETS.includes(d.before);   // Wert außerhalb der Auswahl → "Eigene Zeit"
  const cp = d.custom ? customParts(d.before) : { n: 1, u: 1440 };
  d.cn = cp.n; d.cu = cp.u;
  return d;
}
function syncDraft() {                                       // DOM → Entwurf
  if (!draft || !$('#habit-form')) return;
  draft.name = $('#f-name').value;
  draft.target = parseInt($('#f-target').value, 10) || 1;
  draft.days = [...document.querySelectorAll('#habit-form input[name="day"]:checked')].map((i) => Number(i.value));
  draft.time = $('#f-time').value;
  const sel = $('#f-before').value;
  draft.custom = sel === 'custom';
  const nEl = $('#f-before-n');
  draft.cu = Number($('#f-before-u').value) || 1;
  draft.cn = nEl.value;                                      // bleibt wie getippt (auch leer), damit Neuzeichnen nichts verschluckt
  const n = parseInt(nEl.value, 10);
  if (!draft.time) draft.before = null;
  else if (draft.custom) draft.before = n >= 1 ? n * draft.cu : null;   // Grenze (14 Tage) wird erst beim Speichern geprüft, nicht beim Tippen
  else draft.before = sel === '' ? null : Number(sel);
}
function formHTML() {
  const h = editingId ? state.habits.find((x) => x.id === editingId) : null;
  if (!draft) draft = newDraft(h);
  const d = draft;
  return `<div class="view-in form-wrap">
    ${h ? `<a class="back" href="#gewohnheiten">${icon('left')} Habits</a>` : ''}
    <header class="page-head left"><div class="titles"><h1>${h ? 'Bearbeiten' : 'Neue Gewohnheit'}</h1>
      <p>${h ? 'Ändere Ziel, Tage oder Erinnerung.' : 'Was möchtest du dir angewöhnen?'}</p></div></header>
    <form id="habit-form" class="form-page" novalidate>
      <div class="field"><label for="f-name">Name</label>
        <input id="f-name" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="z. B. 2 Bananen essen" value="${esc(d.name)}" ${formErr ? 'aria-invalid="true" aria-describedby="f-name-err"' : ''}>
        <p class="error" id="f-name-err" role="alert" ${formErr ? '' : 'hidden'}>${esc(formErr)}</p></div>
      <div class="field"><label for="f-target">Ziel pro Tag</label>
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="Ziel verringern">${icon('minus')}</button>
          <input id="f-target" type="number" inputmode="numeric" min="1" max="99" value="${d.target}" aria-describedby="f-target-hint">
          <button type="button" data-step="1" aria-label="Ziel erhöhen">${icon('plus')}</button></div>
        <p class="hint" id="f-target-hint">Zum Beispiel 2 für zwei Bananen.</p></div>
      <fieldset class="field"><legend>Wochentage</legend>
        <div class="chips">${WEEK.map((wd, i) => `<label><input type="checkbox" name="day" value="${wd}" aria-label="${WD_LONG[i]}" ${d.days.includes(wd) ? 'checked' : ''}><span aria-hidden="true">${WD_SHORT[i]}</span></label>`).join('')}</div></fieldset>
      <div class="field"><label for="f-time">Uhrzeit (optional)</label>
        <div class="row"><input id="f-time" type="time" value="${esc(d.time)}"><button type="button" class="btn ghost" data-action="clear-time">Entfernen</button></div>
        <p class="hint">Wann machst du das normalerweise?</p></div>
      <div class="field"><label for="f-before">Erinnerung</label>
        <select id="f-before" ${d.time ? '' : 'disabled'} aria-describedby="f-before-hint">${beforeOptions(d)}</select>
        <div id="f-custom" class="custom-before" ${d.time && d.custom ? '' : 'hidden'}>
          <div class="row">
            <input id="f-before-n" class="num" type="number" inputmode="numeric" min="1" max="${maxFor(d.cu)}" step="1" value="${esc(d.cn)}" aria-label="Wie lange vorher erinnern: Zahl">
            <select id="f-before-u" aria-label="Wie lange vorher erinnern: Einheit">${[[1, 'Minuten'], [60, 'Stunden'], [1440, 'Tage']].map(([v, t]) => `<option value="${v}" ${v === d.cu ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <span class="muted nowrap">vorher</span></div>
          <p class="error" id="f-before-err" role="alert" hidden></p>
        </div>
        <p class="hint" id="f-before-hint">Braucht eine Uhrzeit. Bis zu 14 Tage vorher möglich.</p></div>
      <div class="actions"><button type="submit" class="btn primary">${h ? 'Speichern' : 'Gewohnheit anlegen'}</button></div>
      ${h ? `<button type="button" class="btn danger ${deleteArmed ? 'armed' : ''}" data-action="delete-habit" data-fid="del">${deleteArmed ? 'Wirklich löschen?' : 'Löschen'}</button>` : ''}
    </form></div>`;
}

function beforeOptions(d) {
  const cur = d.custom ? 'custom' : d.before;
  return [...BEFORE_OPTS, ['custom', 'Eigene Zeit …']]
    .map(([v, t]) => `<option value="${v === null ? '' : v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('');
}

/* ---------- Habits (Liste | Erinnerungen) ---------- */
const pushActive = () => 'Notification' in window && Notification.permission === 'granted' && push.state === 'on';
function habitsHTML() {
  const hs = state.habits.filter((h) => !h.archived);
  const seg = `<nav class="seg" aria-label="Ansicht wählen">
    <a href="#gewohnheiten" ${habitsSub === 'list' ? 'aria-current="page"' : ''}>Habits</a>
    <a href="#erinnerungen" ${habitsSub === 'reminders' ? 'aria-current="page"' : ''}>Erinnerungen</a></nav>`;
  const head = `<header class="page-head left"><div class="titles"><h1>${habitsSub === 'list' ? 'Gewohnheiten' : 'Erinnerungen'}</h1>
    <p>${habitsSub === 'list' ? `${hs.length} aktive ${hs.length === 1 ? 'Gewohnheit' : 'Gewohnheiten'}` : 'Wann du erinnert wirst'}</p></div></header>`;

  let body;
  if (habitsSub === 'list') {
    body = hs.length
      ? `<ul class="list">${hs.map((h) => `<li class="swipe" data-id="${h.id}" data-right="0">
          <div class="swipe-bg del" aria-hidden="true">${icon('trash')}</div>
          <div class="swipe-front"><a class="card-row" draggable="false" href="#bearbeiten/${h.id}" data-fid="e-${h.id}">
          <div class="info"><div class="name">${esc(h.name)}</div>
          <div class="meta">${h.target > 1 ? `Ziel ${h.target} · ` : ''}${daysLabel(h.days)}${h.time ? ` · ${esc(h.time)} Uhr` : ''}</div></div>${icon('right')}</a></div>
          <div class="swipe-alt"><button type="button" class="sr-btn" data-action="del-ask" data-id="${h.id}">${esc(h.name)} löschen</button></div></li>`).join('')}</ul>
        <p class="hint swipe-hint">Nach links wischen löscht.</p>`
      : `<div class="empty"><h2>Noch nichts angelegt</h2><p>Tippe unten auf „Neu“, um deine erste Gewohnheit zu erstellen.</p></div>`;
  } else {
    const rs = hs.filter((h) => h.time && h.before !== null).sort((a, b) => remindAt(a).localeCompare(remindAt(b)));
    body = rs.length
      ? `<ul class="list">${rs.map((h) => `<li><a class="card-row" href="#bearbeiten/${h.id}" data-fid="r-${h.id}">
          <span class="rem-time">${remindAt(h)}</span>
          <div class="info"><div class="name">${esc(h.name)}</div><div class="meta">${h.before === 0 ? 'Um' : beforeText(h.before) + ' ·'} ${esc(h.time)} Uhr</div><div class="meta">${daysLabel(h.days)}</div></div>${icon('right')}</a></li>`).join('')}</ul>`
      : `<div class="empty"><h2>Noch keine Erinnerungen</h2><p>Lege beim Anlegen oder Bearbeiten einer Gewohnheit eine Uhrzeit fest und wähle, wie lange vorher du erinnert werden willst.</p></div>`;
    if (!pushActive()) body += `<div class="notice"><p>Erinnerungen kommen erst, wenn Benachrichtigungen aktiv sind.</p><a href="#einstellungen">Zu den Einstellungen</a></div>`;
  }
  return `<div class="view-in">${head}${seg}${body}</div>`;
}

/* ---------- Einstellungen ---------- */
function notifPanelHTML() {
  const notifOK = 'Notification' in window;
  const perm = notifOK ? Notification.permission : 'unsupported';
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let notifText, notifBtn = '', notifErr = '';
  const btn = (label) => `<button class="btn primary" data-action="notif">${icon('bell')} ${label}</button>`;
  if (!notifOK || !('PushManager' in window)) notifText = standalone ? 'Dein Browser unterstützt keine Push-Nachrichten.' : 'Installiere die App zuerst auf dem Home-Bildschirm (Teilen → „Zum Home-Bildschirm“). Erst dann sind Benachrichtigungen möglich.';
  else if (perm === 'denied') notifText = 'Blockiert. Erlaube Benachrichtigungen in den iPhone-Einstellungen unter „Mitteilungen“.';
  else if (!sb || !cloud.user) notifText = 'Melde dich oben an. Der Server schickt die Erinnerungen und muss wissen, an wen.';
  else if (perm === 'granted' && push.state === 'on') notifText = 'Aktiv. Erinnerungen kommen auch bei geschlossener App.';
  else {
    notifText = perm === 'granted' ? 'Erlaubt, aber noch nicht beim Server eingerichtet.' : 'Noch nicht aktiviert.';
    if (push.state === 'error') notifErr = '<p class="error" role="alert">Die Einrichtung ist fehlgeschlagen. Prüfe dein Internet und versuche es erneut.</p>';
    notifBtn = btn(push.state === 'error' ? 'Erneut versuchen' : 'Erinnerungen aktivieren');
  }
  return `<div class="panel"><p class="status">${esc(notifText)}</p>${notifErr}${notifBtn}</div>`;
}
function settingsHTML() {
  return `<div class="view-in">
    <header class="page-head left"><div class="titles"><h1>Einstellungen</h1></div></header>
    <section class="section" aria-labelledby="h-cloud"><h2 id="h-cloud">Konto &amp; Cloud</h2>${accountHTML()}</section>
    <section class="section" aria-labelledby="h-notif"><h2 id="h-notif">Benachrichtigungen</h2>${notifPanelHTML()}</section>
    <section class="section" aria-labelledby="h-backup"><h2 id="h-backup">Backup</h2>
      <div class="panel"><p>Deine Daten liegen auf diesem Gerät${cloud.user ? ' und in der Cloud' : ''}. Ein Export gibt dir zusätzlich eine eigene Sicherungsdatei.</p>
      <div class="btn-row"><button class="btn" data-action="export">${icon('download')} Exportieren</button>
      <button class="btn" data-action="import">${icon('upload')} Importieren</button></div></div></section>
  </div>`;
}

/* ---------- Konto / Login ---------- */
function accountHTML() {
  if (!sb) return '<div class="panel"><p>Die Cloud-Anbindung konnte nicht geladen werden. Starte die App mit Internetverbindung neu.</p></div>';
  if (cloud.user) {
    const pending = Object.keys(state.dirty.habits).length + Object.keys(state.dirty.logs).length;
    const time = cloud.lastSync ? fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(cloud.lastSync)) : '';
    let msg;
    if (cloud.sync === 'syncing') msg = 'Synchronisiere …';
    else if (cloud.sync === 'error') msg = `<span class="error">Synchronisierung fehlgeschlagen.</span> Deine Daten sind auf diesem Gerät sicher${pending ? ` (${pending} Änderungen warten)` : ''}. Die App versucht es später erneut.`;
    else if (cloud.sync === 'ok') msg = `Synchronisiert um ${time} Uhr.${pending ? ` ${pending} Änderungen warten noch.` : ''}`;
    else msg = 'Noch nicht synchronisiert.';
    return `<div class="panel"><p class="status">Angemeldet als ${esc(cloud.user.email)}</p><p>${msg}</p>
      <div class="btn-row"><button class="btn" data-action="sync" ${cloud.sync === 'syncing' ? 'disabled' : ''}>Jetzt synchronisieren</button>
      <button class="btn ghost" data-action="logout">Abmelden</button></div></div>`;
  }
  return `<form class="panel" id="login-form" novalidate>
    <p>Melde dich an, um deine Daten in der Cloud zu sichern. Ohne Anmeldung bleibt alles nur auf diesem Gerät.</p>
    <div class="field"><label for="l-email">E-Mail</label>
      <input id="l-email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" value="${esc(cloud.email)}"></div>
    <div class="field"><label for="l-pass">Passwort</label>
      <input id="l-pass" type="password" autocomplete="current-password"></div>
    <p class="error" role="alert" ${cloud.error ? '' : 'hidden'}>${esc(cloud.error)}</p>
    <button class="btn primary" type="submit" ${cloud.busy ? 'disabled' : ''}>${cloud.busy ? 'Anmelden …' : 'Anmelden'}</button>
  </form>`;
}
function loginError(err) {
  const m = String((err && err.message) || '');
  if (err && err.status === 400) return 'E-Mail oder Passwort stimmt nicht.';
  if (!err.status || /fetch|network/i.test(m)) return 'Keine Verbindung. Prüfe dein Internet und versuche es erneut.';
  if (err.status === 429) return 'Zu viele Versuche. Warte einen Moment und probiere es dann erneut.';
  return 'Anmeldung fehlgeschlagen. Versuche es später erneut.';
}
$('#view').addEventListener('submit', async (e) => {
  if (e.target.id === 'habit-form') { e.preventDefault(); submitHabit(); return; }
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const email = $('#l-email').value.trim();
  const password = $('#l-pass').value;
  cloud.email = email;
  if (!email || !password) { cloud.error = 'Bitte gib E-Mail und Passwort ein.'; render(); return; }
  cloud.busy = true; cloud.error = ''; render();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  cloud.busy = false;
  if (error) {
    cloud.error = loginError(error);
    render();
    const f = $('#l-pass'); if (f) f.focus();
  }                                                         // Erfolg: onAuthStateChange übernimmt
});
/* ---------- Cloud-Sync (local-first) ----------
   Grundidee: Die App arbeitet immer auf den lokalen Daten. Der Sync gleicht sie mit Supabase ab.
   - Pull: alle Zeilen aus der Cloud holen (beim Start, Login, Wiederkehr in die App, Online-Gehen).
   - Merge: pro Datensatz gewinnt die jüngere Änderung ("last write wins", nach Gerätezeit).
   - Push: lokal geänderte Datensätze ("dirty") hochladen, kurz nach jeder Änderung (Debounce).
   Datensätze ohne Zeitstempel (Altdaten von vor dem Sync) zählen als "uralt": die Cloud gewinnt bei Konflikt,
   was nur lokal existiert, wird hochgeladen. So geht beim ersten Login nichts verloren. */
const logKey = (day, id) => day + '|' + id;
const splitKey = (k) => { const i = k.indexOf('|'); return [k.slice(0, i), k.slice(i + 1)]; };
const msToIso = (ms) => new Date(ms || 0).toISOString();
const lts = (v) => (v === undefined ? -1 : v);              // fehlender Zeitstempel (Altdaten) = älter als alles, auch als 0

function touchHabit(h, ts = Date.now()) { h.updated = ts; state.dirty.habits[h.id] = 1; queuePush(); }
function timeFromCloud(r) {                                  // neue Spalten at_time/remind_before; alte Zeilen haben nur "remind"
  const t = r.at_time || r.remind;
  const before = r.remind_before !== null && r.remind_before !== undefined ? r.remind_before : (t && !r.at_time ? 0 : null);
  return { time: t ? t.slice(0, 5) : '', before: t ? before : null };
}
function habitFromCloud(r) {
  return { id: r.id, name: r.name, target: r.target, days: r.days, ...timeFromCloud(r), created: r.created, archived: r.archived || null, updated: Date.parse(r.updated_at) };
}
function setLocalCount(day, id, n) {
  const d = (state.log[day] = state.log[day] || {});
  if (n > 0) d[id] = n; else delete d[id];
  if (!Object.keys(d).length) delete state.log[day];
}
async function fetchAll(table, orderCols) {                // Supabase liefert max. 1000 Zeilen pro Abruf, daher seitenweise
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*').range(from, from + 999);
    for (const c of orderCols) q = q.order(c);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
function setLocalSkip(day, id, reason) {
  const d = (state.skip[day] = state.skip[day] || {});
  if (reason) d[id] = reason; else delete d[id];
  if (!Object.keys(d).length) delete state.skip[day];
}
function mergeFromCloud(habitRows, logRows) {
  let changed = false;
  const cHabits = new Map(habitRows.map((r) => [r.id, r]));
  for (const r of habitRows) {
    const local = state.habits.find((h) => h.id === r.id);
    const cts = Date.parse(r.updated_at);
    if (!local) { state.habits.push(habitFromCloud(r)); changed = true; }
    else if (cts > lts(local.updated)) { Object.assign(local, habitFromCloud(r)); delete state.dirty.habits[local.id]; changed = true; }
  }
  for (const h of state.habits) {                           // lokal neuer oder in der Cloud unbekannt → hochladen
    const r = cHabits.get(h.id);
    if (!r || lts(h.updated) > Date.parse(r.updated_at)) state.dirty.habits[h.id] = 1;
  }
  const cLogs = new Map(logRows.map((r) => [logKey(r.day, r.habit_id), r]));
  for (const r of logRows) {
    const k = logKey(r.day, r.habit_id);
    const cts = Date.parse(r.updated_at);
    if (cts > lts(state.ts[k])) { setLocalCount(r.day, r.habit_id, r.count); setLocalSkip(r.day, r.habit_id, r.skip); state.ts[k] = cts; delete state.dirty.logs[k]; changed = true; }
  }
  const localKeys = new Set(Object.keys(state.ts));
  for (const [day, m] of Object.entries(state.log)) for (const id of Object.keys(m)) localKeys.add(logKey(day, id));
  for (const [day, m] of Object.entries(state.skip)) for (const id of Object.keys(m)) localKeys.add(logKey(day, id));
  for (const k of localKeys) {
    const r = cLogs.get(k);
    if (!r || lts(state.ts[k]) > Date.parse(r.updated_at)) state.dirty.logs[k] = 1;
  }
  return changed;
}
async function upsertChunks(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw error;
  }
}
async function pushDirty() {
  const uid = cloud.user.id;
  const hs = state.habits.filter((h) => state.dirty.habits[h.id]);
  const ls = Object.keys(state.dirty.logs).map((k) => { const [day, id] = splitKey(k); return { k, day, id, ts: state.ts[k] || 0, count: count(day, id), skip: skipOf(day, id) }; });
  await upsertChunks('habits', hs.map((h) => ({ user_id: uid, id: h.id, name: h.name, target: h.target, days: h.days, at_time: h.time || null, remind_before: h.time && h.before != null ? h.before : null, remind: null, created: h.created, archived: h.archived || null, updated_at: msToIso(h.updated) })), 'user_id,id');
  await upsertChunks('logs', ls.map((l) => ({ user_id: uid, day: l.day, habit_id: l.id, count: l.count, skip: l.skip, updated_at: msToIso(l.ts) })), 'user_id,day,habit_id');
  const sent = {};                                          // nur löschen, was sich während des Hochladens nicht erneut geändert hat
  hs.forEach((h) => { sent['h' + h.id] = h.updated; });
  ls.forEach((l) => { sent['l' + l.k] = l.ts; });
  for (const h of hs) if ((h.updated) === sent['h' + h.id] && state.dirty.habits[h.id]) delete state.dirty.habits[h.id];
  for (const l of ls) if ((state.ts[l.k] || 0) === l.ts) delete state.dirty.logs[l.k];
}
let syncing = false, pending = null, pushTimer;
async function runSync(full) {
  if (!sb || !cloud.user) return;
  if (syncing) { pending = pending || full; if (full) pending = true; return; }
  syncing = true; cloud.sync = 'syncing'; cloud.lastAttempt = Date.now();
  if (view === 'settings') render();
  let changed = false;
  try {
    if (full) {
      const [hr, lr] = await Promise.all([fetchAll('habits', ['id']), fetchAll('logs', ['day', 'habit_id'])]);
      changed = mergeFromCloud(hr, lr);
    }
    await pushDirty();
    cloud.sync = 'ok'; cloud.lastSync = Date.now();
  } catch (e) {
    cloud.sync = 'error';
    console.warn('Sync fehlgeschlagen', e);
  } finally {
    syncing = false;
    save();
    if ((changed || view === 'settings') && view !== 'form') render();   // Formular nie unter den Fingern neu zeichnen
    if (pending !== null) { const f = pending; pending = null; runSync(f); }
  }
}
function queuePush() {                                      // Debounce: mehrere schnelle Taps werden gebündelt
  if (!sb || !cloud.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => runSync(false), 1500);
}
const hasDirty = () => Object.keys(state.dirty.habits).length + Object.keys(state.dirty.logs).length > 0;
if (sb) {
  // Feuert beim Start (INITIAL_SESSION), nach Login/Logout und beim Token-Refresh.
  sb.auth.onAuthStateChange((event, session) => {
    const before = cloud.user ? cloud.user.id : null;
    cloud.user = session ? session.user : null;
    const now = cloud.user ? cloud.user.id : null;
    if (before === now) return;                             // z. B. Token-Refresh: nichts neu zeichnen
    cloud.sync = 'idle'; cloud.error = '';
    if (view === 'settings') render();
    if (now) setTimeout(() => { runSync(true); setupPush(false); }, 0);            // nicht direkt im Callback auf Supabase warten
  });
}

/* ---------- Toast (optional mit Aktion, z. B. "Wiederherstellen") ---------- */
let toastTimer, toastAction = null;
function toast(msg, type, action) {
  const t = $('#toast');
  toastAction = action || null;
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-btn'; b.dataset.toastAction = ''; b.textContent = action.label;
    t.append(b);
  }
  t.classList.toggle('error', type === 'error');          // Fehlermeldungen sind immer rot (design-regeln.md R2.1)
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 3200);
}
function hideToast() { $('#toast').classList.remove('show', 'has-action'); toastAction = null; }
$('#toast').addEventListener('click', (e) => {
  if (!e.target.closest('[data-toast-action]') || !toastAction) return;
  const a = toastAction; hideToast(); a.run();
});

/* ---------- Löschen, Überspringen, Dialoge (unten eingeblendet) ---------- */
const sheet = $('#sheet');
let sheetCtx = null;
function openSheet(html) {
  sheet.innerHTML = html;
  if (!sheet.open) sheet.showModal();
  const h2 = sheet.querySelector('h2');                      // Fokus auf die Überschrift statt auf den ersten Knopf: nichts wirkt vorausgewählt
  if (h2) { h2.tabIndex = -1; h2.focus(); }
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('click', (e) => {
  if (e.target === sheet) { closeSheet(); return; }          // Tippen neben das Blatt schließt es
  const b = e.target.closest('[data-sheet]');
  if (!b || !sheetCtx) return;
  const h = state.habits.find((x) => x.id === sheetCtx.id);
  const { k } = sheetCtx;
  closeSheet();
  if (!h) return;
  if (b.dataset.sheet === 'confirm-delete') removeHabit(h);
  if (b.dataset.sheet === 'reason') {
    setSkip(k, h, b.dataset.reason);
    const r = reasonOf(b.dataset.reason);
    toast(`„${h.name}“ übersprungen (${r ? r.label : b.dataset.reason})`, undefined, { label: 'Rückgängig', run: () => setSkip(k, h, null) });
  }
});
const ageDays = (h) => Math.round((parse(todayKey()) - parse(h.created)) / 864e5);
function requestDelete(id) {
  const h = state.habits.find((x) => x.id === id);
  if (!h || h.archived) return;
  if (ageDays(h) > 1) {                                      // älter als 1 Tag → erst nachfragen
    sheetCtx = { id, k: key(viewDate) };
    openSheet(`<h2 id="sheet-title">„${esc(h.name)}“ löschen?</h2>
      <p class="sheet-text">Vergangene Tage bleiben im Kalender erhalten. Direkt danach kannst du das Löschen rückgängig machen.</p>
      <button type="button" class="btn danger armed block" data-sheet="confirm-delete">Löschen</button>
      <button type="button" class="btn ghost block" data-sheet="close">Abbrechen</button>`);
  } else removeHabit(h);
}
function removeHabit(h, rerender = true) {
  h.archived = todayKey(); touchHabit(h);                    // Historie bleibt erhalten
  save();
  if (rerender) render();
  toast(`„${h.name}“ gelöscht`, undefined, { label: 'Wiederherstellen', run: () => restoreHabit(h.id) });
}
function restoreHabit(id) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  h.archived = null; touchHabit(h);
  save(); render();
  toast('Wiederhergestellt');
}
function askSkip(id) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  sheetCtx = { id, k: key(viewDate) };
  openSheet(`<h2 id="sheet-title">Warum überspringst du „${esc(h.name)}“?</h2>
    <div class="reasons">${REASONS.map((r) => `<button type="button" class="reason ${r.excused ? 'excused' : ''}" data-sheet="reason" data-reason="${r.id}"><strong>${r.label}</strong><span>${r.note}</span></button>`).join('')}</div>
    <button type="button" class="btn ghost block" data-sheet="close">Abbrechen</button>`);
}
$('#view').addEventListener('toggle', (e) => {               // aufgeklappt/zugeklappt merken
  const d = e.target;
  if (d.matches && d.matches('details.fold')) foldOpen[d.dataset.fold] = d.open;
}, true);

/* ---------- Formular-Logik (Neu / Bearbeiten) ---------- */
function submitHabit() {
  syncDraft();
  const name = draft.name.trim();
  if (!name) {
    formErr = 'Bitte gib einen Namen ein.';
    render(true);
    $('#f-name').focus();
    return;
  }
  formErr = '';
  if (draft.time && draft.custom && (draft.before === null || draft.before > MAX_BEFORE)) {   // "Eigene Zeit" ungültig
    const er = $('#f-before-err');
    er.textContent = draft.before === null ? 'Bitte gib eine Zahl ab 1 ein.' : 'Höchstens 14 Tage vorher möglich.'; er.hidden = false;
    $('#f-before-n').setAttribute('aria-invalid', 'true');
    $('#f-before-n').focus();
    return;
  }
  const target = clamp(draft.target, 1, 99);
  const days = draft.days.length ? draft.days : [...WEEK];
  const time = draft.time || '';
  const before = time ? draft.before : null;
  const wasEdit = !!editingId;
  if (wasEdit) {
    const h = state.habits.find((x) => x.id === editingId);
    Object.assign(h, { name, target, days, time, before });
    touchHabit(h);
  } else {
    const h = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, target, days, time, before, created: todayKey(), archived: null };
    state.habits.push(h);
    touchHabit(h);
  }
  save();
  draft = null; deleteArmed = false;
  toast(wasEdit ? 'Gespeichert' : 'Gewohnheit angelegt');
  location.hash = wasEdit ? '#gewohnheiten' : '#heute';
}
function deleteHabit() {
  if (!deleteArmed) { deleteArmed = true; render(); return; }  // erst nachfragen
  const h = state.habits.find((x) => x.id === editingId);
  draft = null; deleteArmed = false;
  if (h) removeHabit(h, false);
  location.hash = '#gewohnheiten';
}
function onFormInput(e) {
  const id = e.target.id;
  const sel = $('#f-before');
  const custom = $('#f-custom');
  if (id === 'f-time') {                                     // Uhrzeit steuert das Erinnerungs-Feld
    const had = draft && draft.time;
    if (e.target.value && !had && sel.value === '') sel.value = '0';   // erste Uhrzeit → gleich "Zur Uhrzeit" vorwählen
    if (!e.target.value) sel.value = '';
    sel.disabled = !e.target.value;
  }
  if (id === 'f-before' && sel.value === 'custom') {          // "Eigene Zeit": mit dem bisherigen Wert vorbelegen
    const cp = draft && draft.before != null ? customParts(draft.before) : { n: (draft && draft.cn) || 1, u: (draft && draft.cu) || 1440 };
    $('#f-before-n').value = cp.n; $('#f-before-u').value = cp.u;
  }
  if (id === 'f-before-u') $('#f-before-n').max = maxFor(Number(e.target.value));
  if (id === 'f-before-n' || id === 'f-before-u') { const er = $('#f-before-err'); er.hidden = true; $('#f-before-n').removeAttribute('aria-invalid'); }
  custom.hidden = !($('#f-time').value && sel.value === 'custom');
  if (id === 'f-before' && !custom.hidden) custom.scrollIntoView({ block: 'nearest' });   // Feld nicht unter der festen Speichern-Leiste lassen
  syncDraft();
}
$('#view').addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#habit-form')) onFormInput(e); });

/* ---------- Klicks ---------- */
$('#view').addEventListener('click', (e) => {
  const stp = e.target.closest('[data-step]');               // Plus/Minus am Ziel-Feld
  if (stp) {
    const i = $('#f-target');
    i.value = clamp((parseInt(i.value, 10) || 1) + Number(stp.dataset.step), 1, 99);
    syncDraft();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const k = key(viewDate);
  const h = el.dataset.id ? state.habits.find((x) => x.id === el.dataset.id) : null;
  switch (a) {
    case 'toggle': setCount(k, h, count(k, h.id) >= h.target ? 0 : h.target); break;
    case 'inc': setCount(k, h, count(k, h.id) + 1); break;
    case 'dec': setCount(k, h, count(k, h.id) - 1); break;
    case 'unskip': setSkip(k, h, null); break;
    case 'skip-ask': askSkip(el.dataset.id); break;
    case 'del-ask': requestDelete(el.dataset.id); break;
    case 'day-prev': viewDate = addDays(viewDate, -1); render(); break;
    case 'day-next': viewDate = addDays(viewDate, 1); render(); break;
    case 'go-today': viewDate = new Date(); render(); break;
    case 'cal-prev': calMonth = shiftMonth(-1); render(); break;
    case 'cal-next': calMonth = shiftMonth(1); render(); break;
    case 'open-day': location.hash = '#tag/' + el.dataset.date; break;
    case 'rep-prev': location.hash = '#tag/' + key(addDays(parse(reportDate), -1)); break;
    case 'rep-next': location.hash = '#tag/' + key(addDays(parse(reportDate), 1)); break;
    case 'edit-day': viewDate = parse(el.dataset.date); location.hash = '#heute'; break;
    case 'new': location.hash = '#neu'; break;
    case 'clear-time': $('#f-time').value = ''; onFormInput({ target: $('#f-time') }); break;
    case 'delete-habit': deleteHabit(); break;
    case 'notif': setupPush(true); break;
    case 'sync': runSync(true).then(() => { if (cloud.sync === 'error') toast('Synchronisierung fehlgeschlagen', 'error'); }); break;
    case 'logout': sb.auth.signOut().then(() => toast('Abgemeldet')); break;
    case 'export': exportData(); break;
    case 'import': $('#import-file').click(); break;
  }
});
/* ---------- Wischen: links = löschen, rechts = überspringen ----------
   Läuft über Pointer-Events (Finger und Maus). touch-action: pan-y lässt senkrechtes Scrollen dem Browser.
   Ab SW_THRESH Pixeln gilt die Geste als "weit genug": beim Loslassen wird die Aktion ausgelöst. */
const SW_THRESH = 96, SW_MAX = 150, SW_LOCK = 10;
let sw = null, swSuppress = false;
$('#view').addEventListener('pointerdown', (e) => {
  const li = e.target.closest('.swipe');
  if (!li || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (e.target.closest('input, select, textarea, summary, .swipe-alt')) return;
  sw = { li, front: li.querySelector('.swipe-front'), x: e.clientX, y: e.clientY, pid: e.pointerId, locked: false, dx: 0, right: li.dataset.right === '1' };
});
window.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.pid) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.locked) {
    if (Math.abs(dy) > SW_LOCK && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }   // senkrecht = Scrollen, nicht wischen
    if (Math.abs(dx) < SW_LOCK) return;
    sw.locked = true;
    sw.li.classList.add('dragging');
    try { sw.li.setPointerCapture(e.pointerId); } catch (_) { /* egal */ }
  }
  const x = Math.max(-SW_MAX, Math.min(sw.right ? SW_MAX : 0, dx));
  sw.dx = x;
  sw.front.style.transform = `translateX(${x}px)`;
  sw.li.dataset.dir = x < 0 ? 'left' : x > 0 ? 'right' : '';
  sw.li.classList.toggle('armed', Math.abs(x) >= SW_THRESH);
});
function endSwipe(e, cancelled) {
  if (!sw || e.pointerId !== sw.pid) return;
  const s = sw; sw = null;
  if (!s.locked) return;
  swSuppress = true; setTimeout(() => { swSuppress = false; }, 60);   // der Klick nach dem Wischen soll nichts auslösen
  s.li.classList.remove('dragging');
  const id = s.li.dataset.id;
  const reset = () => { s.front.style.transform = ''; s.li.classList.remove('armed'); s.li.dataset.dir = ''; };
  if (cancelled || Math.abs(s.dx) < SW_THRESH) { reset(); return; }
  if (s.dx > 0) { reset(); askSkip(id); return; }
  const h = state.habits.find((x) => x.id === id);
  if (h && ageDays(h) > 1) { reset(); requestDelete(id); return; }   // Bestätigung nötig → Zeile bleibt, Dialog erscheint
  s.front.style.transform = 'translateX(-110%)';                     // sonst herausgleiten lassen und löschen
  setTimeout(() => requestDelete(id), 170);
}
window.addEventListener('pointerup', (e) => endSwipe(e, false));
window.addEventListener('pointercancel', (e) => endSwipe(e, true));
$('#view').addEventListener('click', (e) => { if (swSuppress) { e.preventDefault(); e.stopPropagation(); } }, true);

function shiftMonth(n) {
  const d = new Date(calMonth.y, calMonth.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

/* ---------- Navigation (Hash) ----------
   #heute · #kalender · #tag/2026-11-17 · #neu · #gewohnheiten · #erinnerungen · #bearbeiten/<id> · #einstellungen */
function route(fromNav) {
  const [page, ...rest] = location.hash.replace(/^#/, '').split('/');
  const arg = rest.join('/');
  deleteArmed = false; formErr = '';
  switch (page) {
    case 'kalender': view = 'calendar'; break;
    case 'tag':
      if (/^\d{4}-\d{2}-\d{2}$/.test(arg) && arg <= todayKey()) { view = 'report'; reportDate = arg; } else view = 'calendar';
      break;
    case 'neu': view = 'form'; editingId = null; draft = newDraft(null); break;
    case 'bearbeiten': {
      const h = state.habits.find((x) => x.id === arg && !x.archived);
      if (h) { view = 'form'; editingId = h.id; draft = newDraft(h); } else { view = 'habits'; habitsSub = 'list'; }
      break;
    }
    case 'gewohnheiten': view = 'habits'; habitsSub = 'list'; break;
    case 'erinnerungen': view = 'habits'; habitsSub = 'reminders'; break;
    case 'einstellungen': view = 'settings'; break;
    default: view = 'today';
  }
  render(true);
  window.scrollTo(0, 0);
  if (fromNav === true) $('#view').focus({ preventScroll: true });   // Screenreader/Tastatur landen im neuen Inhalt
}
window.addEventListener('hashchange', () => route(true));

/* ---------- Backup ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'habit-tracker', version: 1, exported: new Date().toISOString(), data: state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `habits-backup-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup erstellt');
}
$('#import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const d = j.data || j;
    if (!Array.isArray(d.habits) || typeof (d.log || {}) !== 'object') throw new Error('format');
    if (!confirm('Alle aktuellen Daten durch das Backup ersetzen?')) return;
    state = { ...emptyState(), habits: migrateHabits(d.habits), log: d.log || {}, skip: d.skip || {} };
    const now = Date.now();                                 // alles gilt als frisch geändert und wird hochgeladen
    state.habits.forEach((h) => touchHabit(h, now));
    for (const src of [state.log, state.skip]) for (const [day, m] of Object.entries(src)) for (const id of Object.keys(m)) { state.ts[day + '|' + id] = now; state.dirty.logs[day + '|' + id] = 1; }
    save(); queuePush(); render(); toast('Backup eingespielt');
  } catch (err) { toast('Datei konnte nicht gelesen werden.', 'error'); }
});

/* ---------- Push-Erinnerungen ----------
   Die Erinnerungen verschickt der Server (Supabase Edge Function + Zeitplan). Die App meldet nur dieses Gerät an:
   1) Erlaubnis fragen (muss direkt aus einem Tipp heraus passieren, sonst blockt iOS)
   2) Beim Push-Dienst (Apple) anmelden → ergibt eine Adresse samt Schlüsseln
   3) Diese Adresse samt Zeitzone in der Tabelle push_subscriptions speichern */
const urlB64ToUint8 = (b64) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
async function setupPush(interactive) {
  if (!sb || !cloud.user || !('PushManager' in window) || !('Notification' in window)) return;
  try {
    if (interactive && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') { toast('Nicht erlaubt', 'error'); render(); return; }
    }
    if (Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: cloud.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, { onConflict: 'user_id,endpoint' });
    if (error) throw error;
    push.state = 'on';
    if (interactive) toast('Erinnerungen aktiviert');
  } catch (e) {
    console.warn('Push-Einrichtung fehlgeschlagen', e);
    push.state = 'error';
    if (interactive) toast('Einrichtung fehlgeschlagen', 'error');
  }
  if (view === 'settings' || view === 'habits') render();
}

/* ---------- Tageswechsel & Hintergrund ---------- */
let lastDay = todayKey();
function tick() {
  const t = todayKey();
  if (t !== lastDay) {                                      // Mitternacht: neuer Tag, alles frisch
    if (key(viewDate) === lastDay) viewDate = new Date();
    lastDay = t;
    render();
  }
  if (cloud.user && hasDirty() && !syncing && Date.now() - cloud.lastAttempt > 60000) runSync(true);   // Wiederholung nach Fehler
}
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); runSync(true); setupPush(false); } });
window.addEventListener('online', () => runSync(true));

/* ---------- Start ---------- */
route();
tick();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
