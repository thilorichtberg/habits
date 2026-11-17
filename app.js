'use strict';

/* =====================================================================
   Habits – persönlicher Habit-Tracker (läuft komplett lokal im Browser)
   Daten: localStorage. Jeder Tag hat einen eigenen Eintrag im Log, dadurch
   "resettet" sich die Liste jeden Tag von selbst.
   ===================================================================== */

const KEY = 'habit-tracker-v1';
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

function emptyState() { return { habits: [], log: {}, notified: {} }; }
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.habits)) return { habits: r.habits, log: r.log || {}, notified: r.notified || {} };
  } catch (e) { /* leer starten */ }
  return emptyState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Speichern nicht möglich (Speicher voll oder gesperrt).'); }
}

/* ---------- Logik ---------- */
function scheduled(k) {
  const wd = parse(k).getDay();
  return state.habits.filter((h) => h.days.includes(wd) && h.created <= k && (!h.archived || h.archived > k));
}
const count = (k, id) => (state.log[k] && state.log[k][id]) || 0;
function dayPct(k) {
  const hs = scheduled(k);
  if (!hs.length) return null;
  const sum = hs.reduce((a, h) => a + Math.min(count(k, h.id) / h.target, 1), 0);
  return Math.round((sum / hs.length) * 100);
}
function setCount(k, h, n) {
  n = Math.max(0, Math.min(h.target, n));
  const day = (state.log[k] = state.log[k] || {});
  if (n === 0) delete day[h.id]; else day[h.id] = n;
  if (!Object.keys(day).length) delete state.log[k];
  save();
  render();
  announce(h.target === 1 ? `${h.name}: ${n ? 'erledigt' : 'offen'}` : `${h.name}: ${n} von ${h.target}${n >= h.target ? ', erledigt' : ''}`);
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
function render() {
  const fid = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.fid;
  const html = view === 'today' ? todayHTML() : view === 'calendar' ? calendarHTML() : habitsHTML();
  $('#view').innerHTML = html;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (fid) { const el = $(`[data-fid="${fid}"]`); if (el) el.focus({ preventScroll: true }); }
  if (view === 'today') animateRing();
}

function ringHTML(pct) {
  const C = 2 * Math.PI * 45;
  return `<div class="ring" role="img" aria-label="${pct} Prozent erreicht">
    <svg viewBox="0 0 104 104"><circle class="track" cx="52" cy="52" r="45"/>
    <circle class="bar" cx="52" cy="52" r="45" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - lastPct / 100)}" data-c="${C}"/></svg>
    <div class="pct" aria-hidden="true">${pct}%</div></div>`;
}
function animateRing() {
  const bar = $('.ring .bar');
  if (!bar) return;
  const target = Number(bar.closest('.ring').getAttribute('aria-label').split(' ')[0]);
  const C = Number(bar.dataset.c);
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.strokeDashoffset = C * (1 - target / 100); }));
  lastPct = target;
}

function todayHTML() {
  const k = key(viewDate);
  const isToday = k === todayKey();
  const isFuture = k > todayKey();
  const hs = scheduled(k);
  const pct = dayPct(k) ?? 0;
  const done = hs.filter((h) => count(k, h.id) >= h.target).length;
  const st = streak();

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
  const hero = `<section class="hero" aria-label="Tagesfortschritt">${ringHTML(pct)}
    <div class="stats"><strong>${hs.length ? `${done} von ${hs.length} erledigt` : 'Nichts geplant'}</strong>
    ${st > 0 ? `<span class="chip-streak">${icon('flame')} ${st} ${st === 1 ? 'Tag' : 'Tage'} in Folge</span>` : '<span class="muted">Schließe alle Habits ab, um eine Serie zu starten.</span>'}
    </div></section>`;

  let list;
  if (!hs.length) {
    list = `<div class="empty"><h2>Für diesen Tag ist nichts geplant</h2><p>Heute ist Pause.</p></div>`;
  } else {
    list = `<ul class="list">${hs.map((h) => habitRow(k, h, isFuture)).join('')}</ul>`;
  }
  return `<div class="view-in">${head}${backBtn}${hero}${list}</div>`;
}

function habitRow(k, h, disabled) {
  const c = count(k, h.id);
  const isDone = c >= h.target;
  const meta = [h.target > 1 ? `Ziel ${h.target}` : '', h.remind ? `${icon('bell')} ${esc(h.remind)}` : ''].filter(Boolean).join(' · ');
  const info = `<div class="info"><div class="name">${esc(h.name)}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div>`;
  if (h.target === 1) {
    return `<li><button class="habit ${isDone ? 'done' : ''}" data-action="toggle" data-id="${h.id}" data-fid="t-${h.id}" aria-pressed="${isDone}" ${disabled ? 'disabled' : ''}>
      ${info}<span class="check">${icon('check')}</span></button></li>`;
  }
  return `<li><div class="habit ${isDone ? 'done' : ''}">${info}
    <div class="counter">
      <button class="icon-btn" data-action="dec" data-id="${h.id}" data-fid="d-${h.id}" aria-label="${esc(h.name)}: eins weniger" ${c === 0 || disabled ? 'disabled' : ''}>${icon('minus')}</button>
      <span class="count">${c}<span class="sr"> von </span><span aria-hidden="true">/</span>${h.target}</span>
      <button class="icon-btn add" data-action="inc" data-id="${h.id}" data-fid="i-${h.id}" aria-label="${esc(h.name)}: eins mehr" ${isDone || disabled ? 'disabled' : ''}>${icon('plus')}</button>
    </div></div></li>`;
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
    const label = `${fmt({ day: 'numeric', month: 'long' }).format(new Date(y, m, d))}${p === null ? (future ? ', in der Zukunft' : ', nichts geplant') : `, ${p} Prozent`}`;
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
    <p class="hint muted" style="margin-top:16px">Tippe auf einen Tag, um ihn anzusehen oder nachzutragen.</p>
  </div>`;
}

function habitsHTML() {
  const hs = state.habits.filter((h) => !h.archived);
  const notifOK = 'Notification' in window;
  const perm = notifOK ? Notification.permission : 'unsupported';
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let notifText, notifBtn = '';
  if (!notifOK) notifText = standalone ? 'Dein Browser unterstützt keine Benachrichtigungen.' : 'Installiere die App zuerst auf dem Home-Bildschirm (Teilen → „Zum Home-Bildschirm“). Erst dann sind Benachrichtigungen möglich.';
  else if (perm === 'granted') notifText = 'Aktiviert. Erinnerungen erscheinen, solange die App geöffnet oder kürzlich im Hintergrund war.';
  else if (perm === 'denied') notifText = 'Blockiert. Erlaube Benachrichtigungen in den iPhone-Einstellungen unter „Mitteilungen“.';
  else { notifText = 'Noch nicht aktiviert.'; notifBtn = `<button class="btn primary" data-action="notif">${icon('bell')} Erinnerungen aktivieren</button>`; }

  return `<div class="view-in">
    <header class="page-head left"><div class="titles"><h1>Gewohnheiten</h1><p>${hs.length} aktive ${hs.length === 1 ? 'Gewohnheit' : 'Gewohnheiten'}</p></div></header>
    <button class="btn primary block" data-action="new" style="margin-bottom:16px">${icon('plus')} Neue Gewohnheit</button>
    ${hs.length ? `<ul class="list">${hs.map((h) => `<li><button class="card-row" data-action="edit" data-id="${h.id}" data-fid="e-${h.id}">
      <div class="info"><div class="name">${esc(h.name)}</div>
      <div class="meta">${h.target > 1 ? `Ziel ${h.target} · ` : ''}${daysLabel(h.days)}${h.remind ? ` · ${esc(h.remind)} Uhr` : ''}</div></div>${icon('edit')}</button></li>`).join('')}</ul>` : '<p class="muted">Noch nichts angelegt.</p>'}

    <section class="section" aria-labelledby="h-notif"><h2 id="h-notif">Erinnerungen</h2>
      <div class="panel"><p class="status">${esc(notifText)}</p>${notifBtn}</div></section>

    <section class="section" aria-labelledby="h-backup"><h2 id="h-backup">Backup</h2>
      <div class="panel"><p>Deine Daten liegen nur auf diesem Gerät. Wenn du die App löschst, sind sie weg. Exportiere sie deshalb ab und zu.</p>
      <div class="btn-row"><button class="btn" data-action="export">${icon('download')} Exportieren</button>
      <button class="btn" data-action="import">${icon('upload')} Importieren</button></div></div></section>
  </div>`;
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Dialog: Habit anlegen / bearbeiten ---------- */
const dlg = $('#habit-dialog');
const form = $('#habit-form');
const daysBox = $('#f-days');
const fName = $('#f-name'), fTarget = $('#f-target'), fRemind = $('#f-remind');   // nicht form.name/form.target: das sind eingebaute Form-Eigenschaften
const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
daysBox.innerHTML = WEEK.map((d, i) =>
  `<label><input type="checkbox" value="${d}" aria-label="${WD_LONG[i]}" checked><span aria-hidden="true">${WD_SHORT[i]}</span></label>`).join('');

function openDialog(id) {
  editingId = id || null;
  const h = id ? state.habits.find((x) => x.id === id) : null;
  $('#dlg-title').textContent = h ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit';
  fName.value = h ? h.name : '';
  fTarget.value = h ? h.target : 1;
  fRemind.value = h ? h.remind || '' : '';
  daysBox.querySelectorAll('input').forEach((i) => { i.checked = h ? h.days.includes(Number(i.value)) : true; });
  clearErr();
  const del = $('#f-delete');
  del.hidden = !h;
  del.classList.remove('armed');
  del.textContent = 'Löschen';
  dlg.showModal();
  if (!h) fName.focus();
}
function clearErr() {
  $('#f-name-err').hidden = true;
  fName.removeAttribute('aria-invalid');
  fName.removeAttribute('aria-describedby');
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = fName.value.trim();
  if (!name) {
    $('#f-name-err').hidden = false;
    fName.setAttribute('aria-invalid', 'true');
    fName.setAttribute('aria-describedby', 'f-name-err');
    fName.focus();
    return;
  }
  const target = Math.max(1, Math.min(99, parseInt(fTarget.value, 10) || 1));
  let days = [...daysBox.querySelectorAll('input:checked')].map((i) => Number(i.value));
  if (!days.length) days = [...WEEK];
  const remind = fRemind.value || '';
  if (editingId) {
    Object.assign(state.habits.find((x) => x.id === editingId), { name, target, days, remind });
  } else {
    state.habits.push({ id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, target, days, remind, created: todayKey(), archived: null });
  }
  save();
  dlg.close();
  render();
  toast(editingId ? 'Gespeichert' : 'Gewohnheit angelegt');
});
$('#f-cancel').addEventListener('click', () => dlg.close());
$('#f-remind-clear').addEventListener('click', () => { fRemind.value = ''; });
$('#f-delete').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Wirklich löschen?'; return; }
  const h = state.habits.find((x) => x.id === editingId);
  if (h) h.archived = todayKey();                          // Historie bleibt erhalten
  save();
  dlg.close();
  render();
  toast('Gelöscht. Frühere Tage bleiben im Kalender erhalten.');
});
form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
  fTarget.value = Math.max(1, Math.min(99, (parseInt(fTarget.value, 10) || 1) + Number(b.dataset.step)));
}));
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => {                      // Fokus zurück, da die Ansicht neu gerendert wurde
  const el = (editingId && $(`[data-fid="e-${editingId}"]`)) || $('[data-action="new"]');
  if (el) el.focus({ preventScroll: true });
});

/* ---------- Klicks ---------- */
$('#view').addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const k = key(viewDate);
  const h = el.dataset.id ? state.habits.find((x) => x.id === el.dataset.id) : null;
  switch (a) {
    case 'toggle': setCount(k, h, count(k, h.id) >= h.target ? 0 : h.target); break;
    case 'inc': setCount(k, h, count(k, h.id) + 1); break;
    case 'dec': setCount(k, h, count(k, h.id) - 1); break;
    case 'day-prev': viewDate = addDays(viewDate, -1); render(); break;
    case 'day-next': viewDate = addDays(viewDate, 1); render(); break;
    case 'go-today': viewDate = new Date(); render(); break;
    case 'cal-prev': calMonth = shiftMonth(-1); render(); break;
    case 'cal-next': calMonth = shiftMonth(1); render(); break;
    case 'open-day': viewDate = parse(el.dataset.date); location.hash = '#heute'; break;
    case 'new': openDialog(); break;
    case 'edit': openDialog(el.dataset.id); break;
    case 'notif': requestNotif(); break;
    case 'export': exportData(); break;
    case 'import': $('#import-file').click(); break;
  }
});
function shiftMonth(n) {
  const d = new Date(calMonth.y, calMonth.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

/* ---------- Navigation (Hash) ---------- */
const ROUTES = { '#heute': 'today', '#kalender': 'calendar', '#gewohnheiten': 'habits' };
function route(fromNav) {
  view = ROUTES[location.hash] || 'today';
  render();
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
    state = { habits: d.habits, log: d.log || {}, notified: {} };
    save(); render(); toast('Backup eingespielt');
  } catch (err) { toast('Datei konnte nicht gelesen werden.'); }
});

/* ---------- Erinnerungen ---------- */
async function requestNotif() {
  try {
    const r = await Notification.requestPermission();
    toast(r === 'granted' ? 'Erinnerungen aktiviert' : 'Nicht erlaubt');
  } catch (e) { toast('Benachrichtigungen nicht möglich'); }
  render();
}
async function notify(h) {
  const opts = { body: h.target > 1 ? `Ziel heute: ${h.target}×` : 'Noch offen für heute.', icon: 'icon-192.png', tag: 'habit-' + h.id };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
    if (reg) await reg.showNotification(h.name, opts); else new Notification(h.name, opts);
  } catch (e) { /* ignorieren */ }
}
function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const k = key(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  state.notified[k] = state.notified[k] || {};
  let dirty = false;
  for (const h of scheduled(k)) {
    if (!h.remind || state.notified[k][h.id]) continue;
    const [H, M] = h.remind.split(':').map(Number);
    const diff = mins - (H * 60 + M);
    if (diff < 0 || diff > 90) continue;                    // nur im Zeitfenster (max. 90 Min. verspätet)
    state.notified[k][h.id] = true; dirty = true;
    if (count(k, h.id) < h.target) notify(h);
  }
  for (const d of Object.keys(state.notified)) if (d !== k) { delete state.notified[d]; dirty = true; }
  if (dirty) save();
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
  checkReminders();
}
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ---------- Start ---------- */
route();
tick();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
