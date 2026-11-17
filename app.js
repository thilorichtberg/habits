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
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
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

/* ---------- Emoji als optionales Symbol ---------- */
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
function firstGrapheme(str) {                                // genau ein Zeichen (auch zusammengesetzte Emojis wie 🏋️)
  str = String(str || '').trim();
  if (!str) return '';
  if (window.Intl && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)[Symbol.iterator]().next();
    return it.done ? '' : it.value.segment;
  }
  return [...str][0] || '';
}
const cleanEmoji = (v) => { const g = firstGrapheme(v); return EMOJI_RE.test(g) ? g : ''; };   // Buchstaben und Ziffern werden verworfen
const emo = (e) => (e ? `<span class="emoji" aria-hidden="true">${esc(e)}</span>` : '');
const HABIT_EMOJIS = ['💧', '🏃', '🧘', '📚', '🍎', '🥗', '💊', '😴', '🧹', '🦷', '🚴', '🏋️', '✍️', '🌞', '🧠', '🎯'];
const TODO_EMOJIS = ['🛒', '📞', '📧', '💼', '🏠', '💳', '📦', '🎁', '🧾', '✈️', '🔧', '🐶', '📅', '🧺', '🎓', '❤️'];
function emojiFieldHTML(id, value, picks) {
  return `<div class="field"><label for="${id}">Symbol (optional)</label>
    <div class="row emoji-row"><input id="${id}" class="emoji-input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(value)}" placeholder="🙂" aria-label="Symbol, ein Emoji">
      <button type="button" class="btn ghost" data-action="emoji-clear" data-target="${id}">Entfernen</button></div>
    <div class="emoji-picks" role="group" aria-label="Vorschläge">${picks.map((e) => `<button type="button" class="emoji-pick" data-action="emoji-pick" data-emoji="${e}" data-target="${id}" aria-pressed="${e === value}" aria-label="Symbol ${e} wählen">${e}</button>`).join('')}</div></div>`;
}

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
let todoQuery = '';                                         // Suchtext in der To-Do-Liste
let editingTodoId = null;                                   // To-Do-Seite: null = neue Aufgabe
let todoForm = null;                                        // Entwurf der Aufgabe (überlebt Neuzeichnen)
let editBack = { href: '#gewohnheiten', label: 'Gewohnheiten', tab: 'overview' };   // wohin Zurück/Speichern führt: dorthin, woher man die Bearbeitung geöffnet hat
let updating = false;                                       // Update-Prüfung läuft (Einstellungen)
const foldOpen = { skip: false, done: false, tdone: false };               // Heute: aufgeklappte Bereiche bleiben beim Neuzeichnen offen

// Uhrzeit + Vorlauf statt fester Erinnerungszeit: time = "HH:MM" oder '', before = Minuten vorher (0 = pünktlich) oder null (keine Erinnerung).
function migrateHabits(list) {
  for (const h of list) {
    if ('remind' in h) {                                    // alte Fassung: "remind" war die Erinnerungszeit → jetzt Uhrzeit, pünktlich
      if (h.time === undefined) { h.time = h.remind || ''; h.before = h.remind ? 0 : null; }
      delete h.remind;
    }
    if (h.emoji === undefined) h.emoji = '';
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
function defaultSettings() { return { dailyEnabled: true, dailyTime: '20:00', updated: 0 }; }   // updated 0 = nie geändert, der Server nimmt dann dieselben Standardwerte
function emptyState() { return { habits: [], log: {}, skip: {}, todos: [], presets: [], settings: defaultSettings(), ts: {}, dirty: { habits: {}, logs: {}, todos: {}, presets: {}, settings: false }, notified: {} }; }
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.habits)) {
      const dirty = r.dirty || {};
      return { habits: migrateHabits(r.habits), log: r.log || {}, skip: r.skip || {}, todos: (r.todos || []).map((t) => ({ ...t, subs: t.subs || [], emoji: t.emoji || '' })), presets: r.presets || [], settings: { ...defaultSettings(), ...(r.settings || {}) }, ts: r.ts || {}, dirty: { habits: dirty.habits || {}, logs: dirty.logs || {}, todos: dirty.todos || {}, presets: dirty.presets || {}, settings: !!dirty.settings }, notified: r.notified || {} };
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

/* ---------- To-Do (einfache Liste, zählt nicht zur Habit-Quote) ----------
   Eine Aufgabe liegt in "Heute" oder "Später" und kann erledigt werden. Löschen markiert nur (deleted),
   damit es auf allen Geräten ankommt und per "Wiederherstellen" zurückgenommen werden kann. */
const findTodo = (id) => state.todos.find((t) => t.id === id);
function touchTodo(t) { t.updated = Date.now(); state.dirty.todos[t.id] = 1; save(); queuePush(); }
const newSid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const activePresets = () => state.presets.filter((p) => !p.deleted).sort((a, b) => a.name.localeCompare(b.name, 'de'));
function touchPreset(p) { p.updated = Date.now(); state.dirty.presets[p.id] = 1; save(); queuePush(); }
function saveTodoPreset(name, subTexts, emoji = '') {                    // gleicher Name = vorhandenes Preset aktualisieren
  const same = state.presets.find((p) => !p.deleted && p.name.toLowerCase() === name.toLowerCase());
  if (same) { same.subs = subTexts; same.emoji = emoji; touchPreset(same); return; }
  const now = Date.now();
  const p = { id: 'p' + now.toString(36) + Math.random().toString(36).slice(2, 5), name, emoji, subs: subTexts, deleted: false, created: now, updated: now };
  state.presets.push(p);
  touchPreset(p);
}
function removePreset(id) {
  const p = state.presets.find((x) => x.id === id);
  if (!p) return;
  p.deleted = true; touchPreset(p); render();
  toast(`Preset „${p.name}“ gelöscht`, undefined, { label: 'Wiederherstellen', run: () => { p.deleted = false; touchPreset(p); render(); } });
}
function toggleSub(todoId, subId) {
  const t = findTodo(todoId);
  const s = t && t.subs.find((x) => x.id === subId);
  if (!s) return;
  s.done = !s.done;
  touchTodo(t); render();
  announce(`${s.text}: ${s.done ? 'erledigt' : 'wieder offen'}`);
}
// ---- Seite "Neue Aufgabe" / "Aufgabe bearbeiten": Titel, Unterpunkte, Bereich, Preset
function newTodoDraft(t) {
  return t ? { text: t.text, emoji: t.emoji || '', subs: t.subs.map((s) => ({ ...s })), list: t.list, savePreset: false }
           : { text: '', emoji: '', subs: [], list: 'today', savePreset: false };
}
function syncTodoDraft() {                                   // DOM → Entwurf
  if (!todoForm || !$('#todo-edit-form')) return;
  const prev = new Map(todoForm.subs.map((s) => [s.id, s]));
  todoForm.text = $('#tf-text').value;
  todoForm.emoji = cleanEmoji($('#tf-emoji').value);
  todoForm.subs = [...document.querySelectorAll('#todo-edit-form .sub-input')].map((i) => ({ id: i.dataset.sid, text: i.value, done: !!(prev.get(i.dataset.sid) || {}).done }));
  const l = document.querySelector('#todo-edit-form input[name="tf-list"]:checked');
  if (l) todoForm.list = l.value;
  todoForm.savePreset = $('#tf-preset').checked;
}
function addSubRow() {
  syncTodoDraft();
  todoForm.subs.push({ id: newSid(), text: '', done: false });
  render(true);
  const inputs = document.querySelectorAll('#todo-edit-form .sub-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}
function delSubRow(sid) {
  syncTodoDraft();
  todoForm.subs = todoForm.subs.filter((s) => s.id !== sid);
  render(true);
}
function applyPreset(id) {
  const p = state.presets.find((x) => x.id === id && !x.deleted);
  if (!p) return;
  syncTodoDraft();
  todoForm.text = p.name;
  todoForm.emoji = p.emoji || '';
  todoForm.subs = p.subs.map((text) => ({ id: newSid(), text, done: false }));
  render(true);
  announce(`Preset geladen: ${p.name}`);
}
function submitTodo() {
  syncTodoDraft();
  const text = todoForm.text.trim().slice(0, 200);
  if (!text) {
    const er = $('#tf-err');
    er.textContent = 'Bitte gib einen Titel ein.'; er.hidden = false;
    $('#tf-text').setAttribute('aria-invalid', 'true'); $('#tf-text').focus();
    return;
  }
  const subs = todoForm.subs.map((s) => ({ id: s.id, text: s.text.trim().slice(0, 200), done: !!s.done })).filter((s) => s.text);
  const wasEdit = !!editingTodoId;
  if (wasEdit) {
    const t = findTodo(editingTodoId);
    Object.assign(t, { text, emoji: todoForm.emoji, subs, list: todoForm.list });
    touchTodo(t);
  } else {
    const now = Date.now();
    const t = { id: 't' + now.toString(36) + Math.random().toString(36).slice(2, 5), text, emoji: todoForm.emoji, subs, list: todoForm.list, done: false, deleted: false, created: now, updated: now };
    state.todos.push(t);
    touchTodo(t);
  }
  if (todoForm.savePreset) saveTodoPreset(text, subs.map((s) => s.text), todoForm.emoji);
  todoForm = null;
  toast(wasEdit ? 'Gespeichert' : 'Aufgabe hinzugefügt');
  location.hash = '#todo';
}
function toggleTodo(id) {
  const t = findTodo(id);
  if (!t) return;
  t.done = !t.done;
  touchTodo(t); render();
  announce(`${t.text}: ${t.done ? 'erledigt' : 'wieder offen'}`);
}
function moveTodo(id) {                                      // Heute ⇄ Später
  const t = findTodo(id);
  if (!t || t.done) return;
  t.list = t.list === 'today' ? 'later' : 'today';
  touchTodo(t); render();
  toast(`„${t.text}“ nach ${t.list === 'today' ? 'Heute' : 'Später'} verschoben`, undefined, { label: 'Rückgängig', run: () => moveTodo(id) });
}
function removeTodo(id, rerender = true) {
  const t = findTodo(id);
  if (!t) return;
  t.deleted = true; touchTodo(t); if (rerender) render();
  toast(`„${t.text}“ gelöscht`, undefined, { label: 'Wiederherstellen', run: () => { t.deleted = false; touchTodo(t); render(); toast('Wiederhergestellt'); } });
}
/* ---------- Rendering ---------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// Tab-Leiste: 5 Reiter, in der Mitte "Neu" (Hauptaktion der App)
const TABS = [
  { id: 'today', href: '#heute', label: 'Heute', ic: 'today' },
  { id: 'overview', href: '#uebersicht', label: 'Übersicht', ic: 'chart' },
  { id: 'new', href: '#neu', label: 'Neu', ic: 'plus', cls: 'tab-new' },
  { id: 'todo', href: '#todo', label: 'To-Do', ic: 'list' },
  { id: 'settings', href: '#einstellungen', label: 'Einstellungen', ic: 'gear' },
];
$('#tabbar').innerHTML = `<div class="tabbar-in"><span class="tab-indicator" aria-hidden="true"></span>${TABS.map((t) =>
  `<a href="${t.href}" data-tab="${t.id}" class="${t.cls || ''}" title="${t.label}">${t.id === 'new' ? `<span class="plus">${icon(t.ic)}</span>` : `<span class="ico">${icon(t.ic)}</span>`}<span class="lbl sr">${t.label}</span></a>`).join('')}</div>`;   // nur Symbole sichtbar, der Name bleibt für Screenreader
// Die türkise Hinterlegung ist ein einziges Element, das zum gewählten Reiter gleitet (bei allen Reitern gleich groß).
let indicatorPlaced = false;
function moveIndicator(instant) {
  const ind = $('.tab-indicator'), cur = $('.tabbar a[aria-current="page"]');
  if (!ind || !cur) return;
  if (!cur.offsetWidth) return;
  const ix = 6, iy = 4;   // Layout-Maße (offset*), nicht getBoundingClientRect: das enthielte die Drück-Animation des Reiters
  ind.classList.toggle('instant', !!instant);
  ind.style.width = `${cur.offsetWidth - 2 * ix}px`;
  ind.style.height = `${cur.offsetHeight - 2 * iy}px`;
  const wrap = ind.parentElement.getBoundingClientRect(), r = cur.getBoundingClientRect();
  const left = r.left + r.width / 2 - wrap.left - cur.offsetWidth / 2;   // Mittelpunkt bleibt bei der Drück-Animation gleich, so wird die Skalierung herausgerechnet
  ind.style.transform = `translate(${left + ix}px, ${cur.offsetTop + iy}px)`;
  if (instant) { void ind.offsetWidth; ind.classList.remove('instant'); indicatorPlaced = true; }
}
window.addEventListener('resize', () => moveIndicator(true));
const tabOf = () => (['calendar', 'report', 'habits'].includes(view) ? 'overview' : view === 'todoform' ? 'todo' : view === 'form' ? (editingId ? editBack.tab : 'new') : view);   // Kalender, Bericht, Gewohnheiten gehören zur Übersicht

const VIEWS = { today: todayHTML, overview: overviewHTML, calendar: calendarHTML, report: reportHTML, form: formHTML, habits: habitsHTML, todo: todoPageHTML, todoform: todoFormHTML, settings: settingsHTML };
function render(fresh) {
  if (!fresh && view === 'form') syncDraft();
  if (!fresh && view === 'todoform') syncTodoDraft();               // getippten Text vor dem Neuzeichnen sichern
  const fid = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.fid;
  $('#view').innerHTML = VIEWS[view]();
  const cur = tabOf();
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  moveIndicator(!indicatorPlaced);                            // beim ersten Mal sofort, danach gleitend
  if (fid) { const el = $(`[data-fid="${fid}"]`); if (el) el.focus({ preventScroll: true }); }
  if (view === 'today' || view === 'report') animateBar();
  replayPress();                                              // das neu gezeichnete Element federt nach, auf das gerade getippt wurde
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
  // Nur der Kreis links schließt den Habit ab. Der Rest der Zeile (Name, Zeit, freie Fläche) öffnet die Bearbeitung.
  const check = `<button type="button" class="habit-check" data-action="toggle" data-id="${h.id}" data-fid="t-${h.id}" aria-pressed="${isDone}" aria-label="${esc(h.name)}: ${isDone ? 'wieder öffnen' : 'als erledigt markieren'}" ${disabled ? 'disabled' : ''}><span class="check" aria-hidden="true">${icon('check')}</span></button>`;
  const info = `<a class="info habit-main" draggable="false" href="#bearbeiten/${h.id}" data-fid="m-${h.id}"><div class="name">${emo(h.emoji)}${esc(h.name)}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</a>`;
  if (h.target === 1) return `<div class="habit ${isDone ? 'done' : ''}">${check}${info}</div>`;
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
  return `<li><div class="habit skipped"><span class="habit-check static" aria-hidden="true"><span class="check skip-mark">${icon('skip')}</span></span>
    <a class="info habit-main" draggable="false" href="#bearbeiten/${h.id}" data-fid="m-${h.id}"><div class="name">${emo(h.emoji)}${esc(h.name)}</div><div class="meta">${esc(r ? r.label : skipOf(k, h.id))}${r && r.excused ? ' · zählt nicht zur Quote' : ''}</div></a>
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
    <a class="back" href="#uebersicht">${icon('left')} Übersicht</a>
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
    <div class="info"><div class="name">${emo(h.emoji)}${esc(h.name)}</div></div><span class="val">${val}</span></li>`;
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
  const d = h ? { name: h.name, emoji: h.emoji || '', target: h.target, days: [...h.days], time: h.time || '', before: h.time ? h.before : null }
              : { name: '', emoji: '', target: 1, days: [...WEEK], time: '', before: null };
  d.custom = d.before !== null && !PRESETS.includes(d.before);   // Wert außerhalb der Auswahl → "Eigene Zeit"
  const cp = d.custom ? customParts(d.before) : { n: 1, u: 1440 };
  d.cn = cp.n; d.cu = cp.u;
  return d;
}
function syncDraft() {                                       // DOM → Entwurf
  if (!draft || !$('#habit-form')) return;
  draft.name = $('#f-name').value;
  draft.emoji = cleanEmoji($('#f-emoji').value);
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
    ${h ? `<a class="back" href="${editBack.href}">${icon('left')} ${editBack.label}</a>` : ''}
    <header class="page-head left"><div class="titles"><h1>${h ? 'Bearbeiten' : 'Neue Gewohnheit'}</h1>
      <p>${h ? 'Ändere Ziel, Tage oder Erinnerung.' : 'Was möchtest du dir angewöhnen?'}</p></div></header>
    <form id="habit-form" class="form-page" novalidate>
      <div class="field"><label for="f-name">Name</label>
        <input id="f-name" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="z. B. 2 Bananen essen" value="${esc(d.name)}" ${formErr ? 'aria-invalid="true" aria-describedby="f-name-err"' : ''}>
        <p class="error" id="f-name-err" role="alert" ${formErr ? '' : 'hidden'}>${esc(formErr)}</p></div>
      ${emojiFieldHTML('f-emoji', d.emoji, HABIT_EMOJIS)}
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
/* ---------- Übersicht: Kennzahlen, Kalender-Vorschau, Zugang zu den Gewohnheiten ---------- */
function avg30() {                                           // Ø Tagesquote der letzten 30 abgeschlossenen Tage (heute zählt noch nicht mit)
  const t = new Date();
  let sum = 0, n = 0;
  for (let i = 1; i <= 30; i++) { const p = dayPct(key(addDays(t, -i))); if (p !== null) { sum += p; n++; } }
  return n ? Math.round(sum / n) : null;
}
function longestStreak() {                                   // längste Serie überhaupt (Tage mit 100 %, Tage ohne Plan zählen nicht)
  const first = state.habits.reduce((m, h) => (h.created < m ? h.created : m), todayKey());
  let best = 0, run = 0;
  for (let d = parse(first), end = parse(todayKey()); d <= end; d = addDays(d, 1)) {
    const p = dayPct(key(d));
    if (p === null) continue;
    if (p === 100) { run++; if (run > best) best = run; } else run = 0;
  }
  return best;
}
const tageText = (n) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
function miniCalHTML() {                                     // verkleinerter Monat, tippen öffnet den ganzen Kalender
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), tk = todayKey();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="mini-cell blank" aria-hidden="true"></span>';
  for (let d = 1; d <= dim; d++) {
    const k = key(new Date(y, m, d));
    const p = k > tk ? null : dayPct(k);
    const lvl = p === null ? 'none' : p === 0 ? 0 : p < 40 ? 1 : p < 70 ? 2 : p < 100 ? 3 : 4;
    cells += `<span class="mini-cell ${k === tk ? 'today' : ''}" data-l="${lvl}">${d}</span>`;
  }
  return `<div class="cal-preview-head"><strong>${esc(fmt({ month: 'long', year: 'numeric' }).format(now))}</strong>${icon('right')}</div>
    <div class="mini-week" aria-hidden="true">${WD_SHORT.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="mini-grid" aria-hidden="true">${cells}</div>`;
}
function overviewHTML() {
  const avg = avg30(), st = streak(), best = longestStreak();
  const nh = state.habits.filter((h) => !h.archived).length;
  return `<div class="view-in">
    <header class="page-head left"><div class="titles"><h1>Übersicht</h1><p>Deine Zahlen auf einen Blick</p></div></header>
    <section class="stats-card" aria-label="Kennzahlen">
      <div><div class="stat-pct">${avg === null ? '–' : `${avg}<span>%</span>`}</div><div class="stat-cap">Ø letzte 30 Tage</div></div>
      <div class="stat-streaks">
        <div class="stat-best" role="img" aria-label="Längste Serie: ${tageText(best)}">${icon('trophy')}<span aria-hidden="true">${best}</span></div>
        <div class="hero-streak ${st ? '' : 'off'}" role="img" aria-label="Aktuelle Serie: ${tageText(st)}"><span class="fire" aria-hidden="true">🔥</span><strong aria-hidden="true">${st}</strong></div>
      </div></section>
    <a class="cal-preview" href="#kalender" aria-label="Kalender öffnen">${miniCalHTML()}</a>
    <a class="card-row" href="#gewohnheiten"><div class="info"><div class="name">Gewohnheiten</div><div class="meta">${nh} aktiv · Erinnerungen</div></div>${icon('right')}</a>
  </div>`;
}

/* ---------- Gewohnheiten (Alle | Erinnerungen), erreichbar über die Übersicht ---------- */
function habitsHTML() {
  const hs = state.habits.filter((h) => !h.archived);
  const head = `<a class="back" href="#uebersicht">${icon('left')} Übersicht</a>
    <header class="page-head left"><div class="titles"><h1>Gewohnheiten</h1><p>${hs.length} aktive ${hs.length === 1 ? 'Gewohnheit' : 'Gewohnheiten'}</p></div></header>`;
  const filters = `<nav class="filters" aria-label="Filter">
    <a class="chip-filter" href="#gewohnheiten" ${habitsSub === 'list' ? 'aria-current="page"' : ''}>Alle</a>
    <a class="chip-filter" href="#erinnerungen" ${habitsSub === 'reminders' ? 'aria-current="page"' : ''}>Erinnerungen</a></nav>`;
  let body;
  if (habitsSub === 'list') {
    body = hs.length
      ? `<ul class="list">${hs.map((h) => `<li class="swipe" data-id="${h.id}" data-right="0">
          <div class="swipe-bg del" aria-hidden="true">${icon('trash')}</div>
          <div class="swipe-front"><a class="card-row" draggable="false" href="#bearbeiten/${h.id}" data-fid="e-${h.id}">
          <div class="info"><div class="name">${emo(h.emoji)}${esc(h.name)}</div>
          <div class="meta">${h.target > 1 ? `Ziel ${h.target} · ` : ''}${daysLabel(h.days)}${h.time ? ` · ${esc(h.time)} Uhr` : ''}</div></div>${icon('right')}</a></div>
          <div class="swipe-alt"><button type="button" class="sr-btn" data-action="del-ask" data-id="${h.id}">${esc(h.name)} löschen</button></div></li>`).join('')}</ul>
        <p class="hint swipe-hint">Nach links wischen löscht.</p>`
      : `<div class="empty"><h2>Noch nichts angelegt</h2><p>Tippe unten auf „Neu“, um deine erste Gewohnheit zu erstellen.</p></div>`;
  } else {
    const rs = hs.filter((h) => h.time && h.before !== null).sort((a, b) => remindAt(a).localeCompare(remindAt(b)));
    body = rs.length
      ? `<ul class="list">${rs.map((h) => `<li><a class="card-row" href="#bearbeiten/${h.id}" data-fid="r-${h.id}">
          <span class="rem-time">${remindAt(h)}</span>
          <div class="info"><div class="name">${emo(h.emoji)}${esc(h.name)}</div><div class="meta">${h.before === 0 ? 'Um' : beforeText(h.before) + ' ·'} ${esc(h.time)} Uhr</div><div class="meta">${daysLabel(h.days)}</div></div>${icon('right')}</a></li>`).join('')}</ul>`
      : `<div class="empty"><h2>Noch keine Erinnerungen</h2><p>Lege beim Anlegen oder Bearbeiten einer Gewohnheit eine Uhrzeit fest und wähle, wie lange vorher du erinnert werden willst.</p></div>`;
    if (!pushActive()) body += `<div class="notice"><p>Erinnerungen kommen erst, wenn Benachrichtigungen aktiv sind.</p><a href="#einstellungen">Zu den Einstellungen</a></div>`;
  }
  return `<div class="view-in">${head}${filters}${body}</div>`;
}

/* ---------- To-Do-Seite (eigener Reiter) ---------- */
function todoPageHTML() {
  const open = state.todos.filter((t) => !t.deleted && !t.done).length;
  return `<div class="view-in"><header class="page-head left"><div class="titles"><h1>To-Do</h1><p>${open} offene ${open === 1 ? 'Aufgabe' : 'Aufgaben'}</p></div></header>${todoHTML()}</div>`;
}

/* ---------- To-Do-Ansicht: Heute, Später, Erledigt (eingeklappt) ---------- */
function todoHTML() {
  return `<div class="todo-bar">
      <label class="search"><span class="sr">Aufgaben durchsuchen</span>${icon('search')}<input id="todo-search" type="search" placeholder="Suchen …" autocomplete="off" enterkeyhint="search" value="${esc(todoQuery)}"></label>
      <button type="button" class="icon-btn add" data-action="todo-new" aria-label="Neue Aufgabe erstellen">${icon('plus')}</button></div>
    <div id="todo-results">${todoResultsHTML()}</div>`;
}
const todoMatches = (t, q) => !q || t.text.toLowerCase().includes(q) || t.subs.some((s) => s.text.toLowerCase().includes(q));
function todoResultsHTML() {
  const q = todoQuery.trim().toLowerCase();
  const all = state.todos.filter((t) => !t.deleted && todoMatches(t, q)).sort((a, b) => b.created - a.created);   // neueste oben
  const today = all.filter((t) => !t.done && t.list === 'today');
  const later = all.filter((t) => !t.done && t.list === 'later');
  const done = all.filter((t) => t.done).sort((a, b) => b.updated - a.updated);
  const section = (id, title, items, empty) => `<section class="group" aria-labelledby="${id}"><h2 id="${id}">${title} <span class="count-badge">${items.length}</span></h2>
    ${items.length ? `<ul class="list">${items.map(todoRow).join('')}</ul>` : `<p class="todo-empty">${empty}</p>`}</section>`;
  if (q && !all.length) return `<p class="todo-empty">Keine Treffer für „${esc(todoQuery.trim())}“.</p>`;
  return `${section('t-today', 'Heute', today, q ? 'Keine Treffer.' : 'Nichts für heute.')}
    ${section('t-later', 'Später', later, q ? 'Keine Treffer.' : 'Leer. Nach rechts wischen schiebt eine Aufgabe hierher.')}
    ${all.length ? '<p class="hint swipe-hint">Nach rechts wischen verschiebt zwischen Heute und Später, nach links löscht.</p>' : ''}
    ${foldHTML('tdone', 'Erledigt', done, todoRow)}`;
}
function todoRow(t) {
  const subs = t.subs || [];
  const nDone = subs.filter((x) => x.done).length;
  const inner = `<div class="todo ${t.done ? 'done' : ''}">
    <div class="todo-main">
      <button type="button" class="todo-check" data-action="todo-toggle" data-id="${t.id}" data-fid="tc-${t.id}" aria-pressed="${t.done}" aria-label="${esc(t.text)}: ${t.done ? 'wieder öffnen' : 'als erledigt markieren'}"><span class="check" aria-hidden="true">${icon('check')}</span></button>
      <button type="button" class="todo-text" data-action="todo-edit" data-id="${t.id}" data-fid="te-${t.id}">${emo(t.emoji)}${esc(t.text)}</button>
      ${subs.length ? `<span class="todo-progress ${nDone === subs.length ? 'all' : ''}" role="img" aria-label="${nDone} von ${subs.length} Unterpunkten erledigt">${nDone}/${subs.length}</span>` : ''}
    </div>
    ${subs.length ? `<ul class="subs">${subs.map((x) => `<li class="sub ${x.done ? 'done' : ''}">
      <button type="button" class="sub-check" data-action="sub-toggle" data-id="${t.id}" data-sub="${x.id}" data-fid="sc-${x.id}" aria-pressed="${x.done}" aria-label="${esc(x.text)}: ${x.done ? 'wieder öffnen' : 'als erledigt markieren'}"><span class="check small" aria-hidden="true">${icon('check')}</span></button>
      <span class="sub-text">${esc(x.text)}</span></li>`).join('')}</ul>` : ''}</div>`;
  const target = t.list === 'today' ? 'Später' : 'Heute';
  return `<li class="swipe" data-kind="todo" data-id="${t.id}" data-right="${t.done ? 0 : 1}">
    ${t.done ? '' : `<div class="swipe-bg skip" aria-hidden="true">${icon(t.list === 'today' ? 'clock' : 'calendar')}</div>`}
    <div class="swipe-bg del" aria-hidden="true">${icon('trash')}</div>
    <div class="swipe-front">${inner}</div>
    <div class="swipe-alt">${t.done ? '' : `<button type="button" class="sr-btn" data-action="todo-move" data-id="${t.id}">${esc(t.text)} nach ${target} verschieben</button>`}<button type="button" class="sr-btn" data-action="todo-del" data-id="${t.id}">${esc(t.text)} löschen</button></div></li>`;
}

/* ---------- Seite: Neue Aufgabe / Aufgabe bearbeiten ---------- */
function todoFormHTML() {
  const t = editingTodoId ? findTodo(editingTodoId) : null;
  if (!todoForm) todoForm = newTodoDraft(t);
  const d = todoForm;
  const presets = activePresets();
  const presetBlock = t ? '' : `<section class="presets" aria-labelledby="pr-h"><h2 id="pr-h">Presets</h2>
    ${presets.length
      ? `<ul class="preset-list">${presets.map((p) => `<li class="preset"><button type="button" class="preset-load" data-action="preset-load" data-id="${p.id}"><strong>${emo(p.emoji)}${esc(p.name)}</strong><span>${p.subs.length} ${p.subs.length === 1 ? 'Unterpunkt' : 'Unterpunkte'}</span></button><button type="button" class="icon-btn" data-action="preset-del" data-id="${p.id}" aria-label="Preset ${esc(p.name)} löschen">${icon('x')}</button></li>`).join('')}</ul>`
      : `<p class="hint">Noch keine Presets. Unten „Als Preset speichern“ ankreuzen, dann kannst du die Aufgabe hier wieder laden.</p>`}</section>`;
  return `<div class="view-in form-wrap">
    <a class="back" href="#todo">${icon('left')} To-Do</a>
    <header class="page-head left"><div class="titles"><h1>${t ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h1></div></header>
    <form id="todo-edit-form" class="form-page" novalidate>
      ${presetBlock}
      <div class="field"><label for="tf-text">Aufgabe</label>
        <input id="tf-text" type="text" maxlength="200" autocomplete="off" enterkeyhint="done" placeholder="z. B. Koffer packen" value="${esc(d.text)}">
        <p class="error" id="tf-err" role="alert" hidden></p></div>
      ${emojiFieldHTML('tf-emoji', d.emoji, TODO_EMOJIS)}
      <fieldset class="field"><legend>Unterpunkte</legend>
        ${d.subs.length ? `<ul class="sub-edit-list">${d.subs.map((x, i) => `<li class="sub-edit"><input type="text" class="sub-input" maxlength="200" data-sid="${x.id}" value="${esc(x.text)}" placeholder="Unterpunkt" aria-label="Unterpunkt ${i + 1}" enterkeyhint="next" autocomplete="off">
          <button type="button" class="icon-btn" data-action="sub-del" data-sid="${x.id}" aria-label="Unterpunkt ${i + 1} entfernen">${icon('x')}</button></li>`).join('')}</ul>` : ''}
        <button type="button" class="btn ghost add-sub" data-action="sub-add">${icon('plus')} Unterpunkt hinzufügen</button></fieldset>
      <fieldset class="field"><legend>Bereich</legend>
        <div class="chips two">${[['today', 'Heute'], ['later', 'Später']].map(([v, l]) => `<label><input type="radio" name="tf-list" value="${v}" ${d.list === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="check-row"><input type="checkbox" id="tf-preset" ${d.savePreset ? 'checked' : ''}><span>Als Preset speichern</span></label>
      <div class="actions"><button type="submit" class="btn primary">${t ? 'Speichern' : 'Hinzufügen'}</button></div>
      ${t ? `<button type="button" class="btn danger" data-action="todo-form-del">Löschen</button>` : ''}
    </form></div>`;
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
    <section class="section" aria-labelledby="h-daily"><h2 id="h-daily">Tägliche Erinnerung</h2>
      <div class="panel">
        <label class="check-row"><input type="checkbox" id="set-daily" ${state.settings.dailyEnabled ? 'checked' : ''}><span>Jeden Tag erinnern, wenn noch Habits offen sind</span></label>
        <div class="field"><label for="set-daily-time">Uhrzeit</label><input id="set-daily-time" type="time" value="${esc(state.settings.dailyTime)}" ${state.settings.dailyEnabled ? '' : 'disabled'}></div>
        <p>Die Nachricht kommt nur, wenn heute noch Habits weder abgehakt noch übersprungen sind. Sie braucht aktive Benachrichtigungen und eine Anmeldung.</p>
      </div></section>
    <section class="section" aria-labelledby="h-app"><h2 id="h-app">App</h2>
      <div class="panel"><p class="status">Version ${esc(appVersion())}</p>
      <p>Neue Versionen kommen von selbst an. Falls du eine Änderung nicht siehst, tippe hier.</p>
      <div class="btn-row"><button class="btn" data-action="check-update" ${updating ? 'disabled' : ''}>${icon('refresh')} ${updating ? 'Prüfe …' : 'Auf Updates prüfen'}</button></div></div></section>

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
    const pending = Object.keys(state.dirty.habits).length + Object.keys(state.dirty.logs).length + Object.keys(state.dirty.todos).length + Object.keys(state.dirty.presets).length + (state.dirty.settings ? 1 : 0);
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
  if (e.target.id === 'todo-edit-form') { e.preventDefault(); submitTodo(); return; }
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
  return { id: r.id, name: r.name, emoji: r.emoji || '', target: r.target, days: r.days, ...timeFromCloud(r), created: r.created, archived: r.archived || null, updated: Date.parse(r.updated_at) };
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
function todoFromCloud(r) {
  return { id: r.id, text: r.text, list: r.list, done: !!r.done, deleted: !!r.deleted, emoji: r.emoji || '', subs: Array.isArray(r.subs) ? r.subs : [], created: Date.parse(r.created_at), updated: Date.parse(r.updated_at) };
}
function presetFromCloud(r) {
  return { id: r.id, name: r.name, emoji: r.emoji || '', subs: Array.isArray(r.subs) ? r.subs : [], deleted: !!r.deleted, created: Date.parse(r.created_at), updated: Date.parse(r.updated_at) };
}
function mergeList(arr, rows, fromCloud, dirty) {            // Listen mit id: pro Eintrag gewinnt die jüngere Änderung
  let changed = false;
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    const local = arr.find((x) => x.id === r.id);
    const cts = Date.parse(r.updated_at);
    if (!local) { arr.push(fromCloud(r)); changed = true; }
    else if (cts > lts(local.updated)) { Object.assign(local, fromCloud(r)); delete dirty[local.id]; changed = true; }
  }
  for (const x of arr) {
    const r = byId.get(x.id);
    if (!r || lts(x.updated) > Date.parse(r.updated_at)) dirty[x.id] = 1;
  }
  return changed;
}
function mergeSettings(rows) {                               // eine Zeile pro Nutzer, die jüngere Änderung gewinnt
  const r = rows[0];
  if (!r) { if (state.settings.updated > 0) state.dirty.settings = true; return false; }
  const cts = Date.parse(r.updated_at);
  if (cts > state.settings.updated) { state.settings = { dailyEnabled: !!r.daily_enabled, dailyTime: String(r.daily_time).slice(0, 5), updated: cts }; state.dirty.settings = false; return true; }
  if (state.settings.updated > cts) state.dirty.settings = true;
  return false;
}
function mergeFromCloud(habitRows, logRows, todoRows = [], presetRows = [], settingsRows = []) {
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
  if (mergeList(state.todos, todoRows, todoFromCloud, state.dirty.todos)) changed = true;
  if (mergeList(state.presets, presetRows, presetFromCloud, state.dirty.presets)) changed = true;
  if (mergeSettings(settingsRows)) changed = true;
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
  await upsertChunks('habits', hs.map((h) => ({ user_id: uid, id: h.id, name: h.name, emoji: h.emoji || null, target: h.target, days: h.days, at_time: h.time || null, remind_before: h.time && h.before != null ? h.before : null, remind: null, created: h.created, archived: h.archived || null, updated_at: msToIso(h.updated) })), 'user_id,id');
  const ts = state.todos.filter((t) => state.dirty.todos[t.id]);
  await upsertChunks('todos', ts.map((t) => ({ user_id: uid, id: t.id, text: t.text, emoji: t.emoji || null, list: t.list, done: t.done, deleted: t.deleted, subs: t.subs || [], created_at: msToIso(t.created), updated_at: msToIso(t.updated) })), 'user_id,id');
  const ps = state.presets.filter((p) => state.dirty.presets[p.id]);
  await upsertChunks('todo_presets', ps.map((p) => ({ user_id: uid, id: p.id, name: p.name, emoji: p.emoji || null, subs: p.subs, deleted: p.deleted, created_at: msToIso(p.created), updated_at: msToIso(p.updated) })), 'user_id,id');
  await upsertChunks('logs', ls.map((l) => ({ user_id: uid, day: l.day, habit_id: l.id, count: l.count, skip: l.skip, updated_at: msToIso(l.ts) })), 'user_id,day,habit_id');
  if (state.dirty.settings) {
    const st = state.settings, sentAt = st.updated;
    const { error } = await sb.from('user_settings').upsert([{ user_id: uid, daily_enabled: st.dailyEnabled, daily_time: st.dailyTime, updated_at: msToIso(st.updated) }], { onConflict: 'user_id' });
    if (error) throw error;
    if (st.updated === sentAt) state.dirty.settings = false;
  }
  const sent = {};                                          // nur löschen, was sich während des Hochladens nicht erneut geändert hat
  hs.forEach((h) => { sent['h' + h.id] = h.updated; });
  ls.forEach((l) => { sent['l' + l.k] = l.ts; });
  for (const h of hs) if ((h.updated) === sent['h' + h.id] && state.dirty.habits[h.id]) delete state.dirty.habits[h.id];
  ts.forEach((t) => { sent['t' + t.id] = t.updated; });
  for (const t of ts) if (t.updated === sent['t' + t.id] && state.dirty.todos[t.id]) delete state.dirty.todos[t.id];
  ps.forEach((p) => { sent['p' + p.id] = p.updated; });
  for (const p of ps) if (p.updated === sent['p' + p.id] && state.dirty.presets[p.id]) delete state.dirty.presets[p.id];
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
      const [hr, lr, tr, pr, sr] = await Promise.all([fetchAll('habits', ['id']), fetchAll('logs', ['day', 'habit_id']), fetchAll('todos', ['id']), fetchAll('todo_presets', ['id']), fetchAll('user_settings', ['user_id'])]);
      changed = mergeFromCloud(hr, lr, tr, pr, sr);
    }
    await pushDirty();
    cloud.sync = 'ok'; cloud.lastSync = Date.now();
  } catch (e) {
    cloud.sync = 'error';
    console.warn('Sync fehlgeschlagen', e);
  } finally {
    syncing = false;
    save();
    if ((changed || view === 'settings') && view !== 'form' && view !== 'todoform') render();   // Formular nie unter den Fingern neu zeichnen
    if (pending !== null) { const f = pending; pending = null; runSync(f); }
  }
}
function queuePush() {                                      // Debounce: mehrere schnelle Taps werden gebündelt
  if (!sb || !cloud.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => runSync(false), 1500);
}
const hasDirty = () => Object.keys(state.dirty.habits).length + Object.keys(state.dirty.logs).length + Object.keys(state.dirty.todos).length + Object.keys(state.dirty.presets).length + (state.dirty.settings ? 1 : 0) > 0;
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
  openSheet(`<div class="sheet-head"><h2 id="sheet-title">Warum überspringst du „${esc(h.name)}“?</h2>
    <button type="button" class="icon-btn" data-sheet="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="reasons two">${REASONS.map((r) => `<button type="button" class="reason ${r.excused ? 'excused' : ''}" data-sheet="reason" data-reason="${r.id}" aria-label="${r.label}: ${r.note.toLowerCase()}"><strong>${r.label}</strong></button>`).join('')}</div>
    <p class="sheet-note">Krankheit zählt nicht zur Quote, alles andere zählt als nicht geschafft.</p>`);
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
    Object.assign(h, { name, emoji: draft.emoji, target, days, time, before });
    touchHabit(h);
  } else {
    const h = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, emoji: draft.emoji, target, days, time, before, created: todayKey(), archived: null };
    state.habits.push(h);
    touchHabit(h);
  }
  save();
  draft = null; deleteArmed = false;
  toast(wasEdit ? 'Gespeichert' : 'Gewohnheit angelegt');
  location.hash = wasEdit ? editBack.href : '#heute';
}
function deleteHabit() {
  if (!deleteArmed) { deleteArmed = true; render(); return; }  // erst nachfragen
  const h = state.habits.find((x) => x.id === editingId);
  draft = null; deleteArmed = false;
  if (h) removeHabit(h, false);
  location.hash = editBack.href;
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
$('#view').addEventListener('input', (e) => {
  if (e.target.classList && e.target.classList.contains('emoji-input')) {                         // nur ein Emoji zulassen
    const v = cleanEmoji(e.target.value);
    if (e.target.value !== v) e.target.value = v;
    document.querySelectorAll(`.emoji-pick[data-target="${e.target.id}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.emoji === v)));
  }
  if (e.target.id === 'todo-search') { todoQuery = e.target.value; $('#todo-results').innerHTML = todoResultsHTML(); }   // nur die Ergebnisse neu zeichnen, das Feld behält Fokus und Cursor
  if (e.target.closest && e.target.closest('#todo-edit-form')) {
    syncTodoDraft();
    if (e.target.id === 'tf-text') { $('#tf-err').hidden = true; e.target.removeAttribute('aria-invalid'); }
  }
  if (e.target.closest && e.target.closest('#habit-form')) onFormInput(e);
});
$('#view').addEventListener('change', (e) => {                 // Einstellungen der täglichen Erinnerung
  if (e.target.id !== 'set-daily' && e.target.id !== 'set-daily-time') return;
  if (e.target.id === 'set-daily') { state.settings.dailyEnabled = e.target.checked; $('#set-daily-time').disabled = !e.target.checked; }
  else if (/^\d{2}:\d{2}$/.test(e.target.value)) state.settings.dailyTime = e.target.value;
  else { e.target.value = state.settings.dailyTime; return; }                                    // leere Uhrzeit: alten Wert behalten
  state.settings.updated = Date.now(); state.dirty.settings = true;
  save(); queuePush();
  toast(state.settings.dailyEnabled ? `Tägliche Erinnerung um ${state.settings.dailyTime} Uhr` : 'Tägliche Erinnerung aus');
});
$('#view').addEventListener('keydown', (e) => {              // Enter in einem Unterpunkt legt den nächsten an
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sub-input')) { e.preventDefault(); addSubRow(); }
});

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
    case 'todo-toggle': toggleTodo(el.dataset.id); break;
    case 'emoji-pick': case 'emoji-clear': {
      const i = $('#' + el.dataset.target);
      i.value = a === 'emoji-pick' ? el.dataset.emoji : '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      break;
    }
    case 'todo-new': location.hash = '#todo-neu'; break;
    case 'todo-edit': location.hash = '#todo-bearbeiten/' + el.dataset.id; break;
    case 'sub-toggle': toggleSub(el.dataset.id, el.dataset.sub); break;
    case 'sub-add': addSubRow(); break;
    case 'sub-del': delSubRow(el.dataset.sid); break;
    case 'preset-load': applyPreset(el.dataset.id); break;
    case 'preset-del': removePreset(el.dataset.id); break;
    case 'todo-form-del': { const id = editingTodoId; todoForm = null; removeTodo(id, false); location.hash = '#todo'; break; }
    case 'todo-move': moveTodo(el.dataset.id); break;
    case 'todo-del': removeTodo(el.dataset.id); break;
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
    case 'check-update': checkForUpdate(); break;
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
  const todo = s.li.dataset.kind === 'todo';
  if (s.dx > 0) {
    if (todo) { s.front.style.transform = 'translateX(110%)'; setTimeout(() => moveTodo(id), 170); return; }   // Heute ⇄ Später
    reset(); askSkip(id); return;
  }
  if (todo) { s.front.style.transform = 'translateX(-110%)'; setTimeout(() => removeTodo(id), 170); return; }
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
  const cameFrom = view;
  const [page, ...rest] = location.hash.replace(/^#/, '').split('/');
  const arg = rest.join('/');
  deleteArmed = false; formErr = '';
  switch (page) {
    case 'uebersicht': view = 'overview'; break;
    case 'kalender': view = 'calendar'; break;
    case 'tag':
      if (/^\d{4}-\d{2}-\d{2}$/.test(arg) && arg <= todayKey()) { view = 'report'; reportDate = arg; } else view = 'calendar';
      break;
    case 'neu': view = 'form'; editingId = null; draft = newDraft(null); break;
    case 'bearbeiten': {
      const h = state.habits.find((x) => x.id === arg && !x.archived);
      if (h) {
        if (cameFrom !== 'form') editBack = cameFrom === 'today' ? { href: '#heute', label: 'Heute', tab: 'today' } : { href: '#gewohnheiten', label: 'Gewohnheiten', tab: 'overview' };
        view = 'form'; editingId = h.id; draft = newDraft(h);
      } else { view = 'habits'; habitsSub = 'list'; }
      break;
    }
    case 'gewohnheiten': view = 'habits'; habitsSub = 'list'; break;
    case 'erinnerungen': view = 'habits'; habitsSub = 'reminders'; break;
    case 'todo': view = 'todo'; break;
    case 'todo-neu': view = 'todoform'; editingTodoId = null; todoForm = newTodoDraft(null); break;
    case 'todo-bearbeiten': {
      const t = findTodo(arg);
      if (t && !t.deleted) { view = 'todoform'; editingTodoId = t.id; todoForm = newTodoDraft(t); } else view = 'todo';
      break;
    }
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
    state = { ...emptyState(), habits: migrateHabits(d.habits), log: d.log || {}, skip: d.skip || {}, todos: (d.todos || []).map((t) => ({ ...t, subs: t.subs || [] })), presets: d.presets || [], settings: { ...defaultSettings(), ...(d.settings || {}) } };
    const now = Date.now();                                 // alles gilt als frisch geändert und wird hochgeladen
    state.habits.forEach((h) => touchHabit(h, now));
    for (const src of [state.log, state.skip]) for (const [day, m] of Object.entries(src)) for (const id of Object.keys(m)) { state.ts[day + '|' + id] = now; state.dirty.logs[day + '|' + id] = 1; }
    state.todos.forEach((t) => { t.updated = now; state.dirty.todos[t.id] = 1; });
    state.presets.forEach((p) => { p.updated = now; state.dirty.presets[p.id] = 1; });
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

/* ---------- Seitenleiste: weitere Apps ---------- */
const drawer = $('#drawer');
drawer.innerHTML = `<div class="drawer-head"><h2 id="drawer-title">Meine Apps</h2>
  <button type="button" class="icon-btn" data-drawer="close" aria-label="Menü schließen">${icon('x')}</button></div>
  <ul class="apps">
    <li><button type="button" class="app-item current" data-drawer="close" aria-current="true">${icon('today')}<span class="app-name">Habits</span></button></li>
    <li><button type="button" class="app-item" disabled>${icon('utensils')}<span class="app-name">Ernährung</span><span class="soon">Bald</span></button></li>
    <li><button type="button" class="app-item" disabled>${icon('wallet')}<span class="app-name">Finanzen</span><span class="soon">Bald</span></button></li>
  </ul>`;
$('#menu-btn').addEventListener('click', () => drawer.showModal());
drawer.addEventListener('click', (e) => { if (e.target === drawer || e.target.closest('[data-drawer="close"]')) drawer.close(); });
window.addEventListener('hashchange', () => { if (drawer.open) drawer.close(); });

/* ---------- Drück-Animation für jeden Knopf ----------
   Beim Drücken schrumpft das Element schnell (90 ms), beim Loslassen federt es mit kleinem Überschwingen zurück.
   Wird die Ansicht nach dem Tippen neu gezeichnet (fast jede Aktion), spielt render() das Zurückfedern am neuen
   Element ab. Bei "Bewegung reduzieren" passiert nichts. Weg-Wischen und Scrollen brechen das Drücken ab. */
const PRESS = 'button, a[href], summary, .chips label, .check-row';
const noMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let press = null, lastPress = null;
function pressTarget(t) {
  const el = t && t.closest && t.closest(PRESS);
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
  if (el.classList.contains('sr-btn') && el !== document.activeElement) return null;   // unsichtbare Tastatur-Knöpfe
  return el;
}
function pressSelector(el) {                                  // so findet render() das Element nach dem Neuzeichnen wieder
  if (el.dataset.fid) return `[data-fid="${el.dataset.fid}"]`;
  if (el.dataset.action) return `[data-action="${el.dataset.action}"]` + ['id', 'date', 'sub', 'reason'].map((k) => (el.dataset[k] ? `[data-${k}="${el.dataset[k]}"]` : '')).join('');
  return null;
}
function playRelease(el) {
  el.classList.remove('pressing', 'release');
  void el.offsetWidth;                                       // Animation neu starten
  el.classList.add('release');
  el.addEventListener('animationend', function done(e) { if (e.target !== el) return; el.classList.remove('release'); el.removeEventListener('animationend', done); });
}
function replayPress() {
  if (!lastPress || Date.now() - lastPress.t > 400) return;
  const sel = lastPress.sel; lastPress = null;
  const el = sel && document.querySelector(sel);
  if (el && !el.classList.contains('release')) playRelease(el);
}
function clearPress() { if (press) { press.el.classList.remove('pressing'); press = null; } }
document.addEventListener('pointerdown', (e) => {
  if (noMotion() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const el = pressTarget(e.target);
  if (!el) return;
  clearPress();
  el.classList.remove('release');
  el.classList.add('pressing');
  press = { el, x: e.clientX, y: e.clientY, pid: e.pointerId };
}, { passive: true });
document.addEventListener('pointermove', (e) => {             // Finger wandert weg (Wischen/Scrollen): Drücken abbrechen
  if (press && e.pointerId === press.pid && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clearPress();
}, { passive: true });
function endPress(e, cancelled) {
  if (!press || e.pointerId !== press.pid) return;
  const p = press; press = null;
  p.el.classList.remove('pressing');
  if (cancelled) return;
  playRelease(p.el);
  lastPress = { sel: pressSelector(p.el), t: Date.now() };
}
document.addEventListener('pointerup', (e) => endPress(e, false), { passive: true });
document.addEventListener('pointercancel', (e) => endPress(e, true), { passive: true });
document.addEventListener('click', (e) => {                    // Tastatur (Enter/Leertaste) löst ebenfalls das Zurückfedern aus
  if (e.detail !== 0 || noMotion()) return;
  const el = pressTarget(e.target);
  if (el) { playRelease(el); lastPress = { sel: pressSelector(el), t: Date.now() }; }
}, true);

/* ---------- Start ---------- */
route();
tick();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
/* ---------- Updates: Version anzeigen, selbst prüfen, neuer Service Worker lädt die Seite neu ---------- */
function appVersion() { return (document.querySelector('meta[name="app-version"]') || {}).content || 'unbekannt'; }
async function checkForUpdate() {
  updating = true; render();
  try {
    const html = await (await fetch('./?check=' + Date.now(), { cache: 'no-store' })).text();     // frische Startseite, am Zwischenspeicher vorbei
    const live = (html.match(/<meta name="app-version" content="([^"]*)"/) || [])[1];
    if (!live) throw new Error('keine Version gefunden');
    if (live === appVersion()) { updating = false; render(); toast('Du hast die neueste Version'); return; }
    toast('Neue Version wird geladen …');
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    location.replace(location.pathname + '?u=' + Date.now() + location.hash);                       // neue Adresse = garantiert frisch
  } catch (e) {
    updating = false; render(); toast('Update-Prüfung fehlgeschlagen. Bist du online?', 'error');
  }
}
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {                              // ein neuer Service Worker hat übernommen
    if (!hadController || reloading) return;
    if (view === 'form' || view === 'todoform') { toast('Neue Version da', undefined, { label: 'Neu laden', run: () => location.reload() }); return; }   // nie ein offenes Formular wegwerfen
    reloading = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.update();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });   // beim Zurückkehren in die App nach Updates sehen
  }).catch(() => {});
}
