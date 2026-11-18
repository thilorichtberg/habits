// Supabase Edge Function: send-reminders
// Wird jede Minute vom Zeitplan (pg_cron) aufgerufen. Schickt Push-Erinnerungen für Habits,
// deren Erinnerungszeit erreicht ist und die heute noch nicht erledigt sind.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const LATE_MIN = 10; // so viele Minuten nach der Zeit wird noch erinnert (falls ein Lauf ausfiel)

// Datum, Minuten seit Mitternacht und Wochentag (0 = Sonntag) in der Zeitzone des Geräts.
function localParts(tz: string, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
  };
}

// --- Fälligkeit (rein rechnerisch, wird getestet) ---
const dayNum = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, dd) / 86400000); };
const dayStr = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const dayWeekday = (n: number) => new Date(n * 86400000).getUTCDay();

// Welche Termine (Habit + Tag) lösen JETZT eine Erinnerung aus?
// Ein Termin ist "Tag + Uhrzeit des Habits". Erinnert wird "Vorlauf" Minuten davor, auch am Vortag oder früher
// (zum Beispiel 33 Stunden vorher). Gerechnet wird in Ortszeit-Minuten der Zeitzone des Geräts; die Zeitumstellung
// wird dabei nicht berücksichtigt (an dem einen Tag kann eine Erinnerung mit langem Vorlauf um eine Stunde abweichen).
function dueOccurrences(habits: any[], day: string, minutes: number, lateMin = 10) {
  const todayN = dayNum(day);
  const nowMin = todayN * 1440 + minutes;
  const out = [] as any[];
  for (const h of habits) {
    const [H, M] = h.at_time.split(':').map(Number);
    const lead = h.remind_before;
    // Bei "x Minuten vorher" nie nach der Uhrzeit selbst erinnern, bei "zur Uhrzeit" noch lateMin Minuten lang.
    const window = lead > 0 ? Math.min(lateMin, lead) : lateMin;
    for (let k = 0; k <= Math.floor(lead / 1440) + 2; k++) {
      const n = todayN + k;
      const occDay = dayStr(n);
      if (!h.days.includes(dayWeekday(n))) continue;
      if (h.created > occDay) continue;
      if (h.archived && h.archived <= occDay) continue;
      const late = nowMin - (n * 1440 + H * 60 + M - lead);
      if (late >= 0 && late <= window) out.push({ h, occDay });
    }
  }
  return out;
}

// Tägliche Sammel-Erinnerung: ist die eingestellte Uhrzeit gerade erreicht (höchstens lateMin Minuten zurück)?
function dailyDue(minutes: number, time: string, lateMin = 10) {
  const [H, M] = String(time).split(':').map(Number);
  const late = minutes - (H * 60 + M);
  return late >= 0 && late <= lateMin;
}
// Welche Habits sind heute noch offen? Geplant für heute, nicht erledigt und nicht übersprungen
// (Übersprungenes hat der Nutzer bewusst entschieden, dafür gibt es keine Erinnerung).
function dailyOpenHabits(habits: any[], logs: any[], day: string, weekday: number) {
  const byHabit = new Map(logs.map((l) => [l.habit_id, l]));
  return habits.filter((h) => {
    if (!h.days.includes(weekday)) return false;
    if (h.created > day) return false;
    if (h.archived && h.archived <= day) return false;
    const l = byHabit.get(h.id);
    if (l && l.skip) return false;
    return !(l && l.count >= h.target);
  });
}
// To-Do-Erinnerungen nutzen dieselbe Rechnung wie die Habits: Eine Aufgabe ist ein Habit, der nur an ihrem Tag stattfindet.
function todoOccurrences(todos: any[], day: string, minutes: number, lateMin = 10) {
  const asHabits = todos.map((t) => {
    const n = dayNum(t.due_day);
    return { ...t, days: [dayWeekday(n)], created: t.due_day, archived: dayStr(n + 1) };   // genau ein Tag: der Tag der Aufgabe
  });
  return dueOccurrences(asHabits, day, minutes, lateMin);
}
// --- Ende Fälligkeit ---

// --- Texte der Benachrichtigungen (rein, wird getestet) ---
// Der Titel ist immer "Habits" (iOS zeigt ihn fett), darunter steht die eigentliche Nachricht.
const fmtLead = (b: number) => {
  const d = Math.floor(b / 1440), h = Math.floor((b % 1440) / 60), m = b % 60;
  return [d && `${d} ${d === 1 ? 'Tag' : 'Tage'}`, h && `${h} ${h === 1 ? 'Stunde' : 'Stunden'}`, m && `${m} ${m === 1 ? 'Minute' : 'Minuten'}`].filter(Boolean).join(' ');
};
function whenWord(occDay: string, day: string): string {
  return occDay === day ? 'um '
    : occDay === dayStr(dayNum(day) + 1) ? 'morgen um '
    : `am ${new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(dayNum(occDay) * 86400000))} um `;
}
const habitLabel = (h: any) => (h.emoji ? h.emoji + ' ' : '') + h.name;
function reminderBody(h: any, b: number, when: string, t: string): string {
  const goal = h.target > 1 ? ` · Ziel: ${h.target}×` : '';
  return (b > 0 ? `${habitLabel(h)} in ${fmtLead(b)} (${when}${t} Uhr)` : `${habitLabel(h)} jetzt (${t} Uhr)`) + goal;
}
function dailyBody(open: any[]): string {
  const rest = open.length - 3;
  return `Noch offen heute: ${open.slice(0, 3).map(habitLabel).join(', ')}${rest > 0 ? (rest === 1 ? ' und ein weiteres' : ` und ${rest} weitere`) : ''}`;
}
// --- Ende Texte ---

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

async function send(s: any, payload: string): Promise<number> {
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
      { TTL: 3600 },
    );
    return 1;
  } catch (e: any) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      // Gerät hat sich abgemeldet oder die App wurde gelöscht → Adresse aufräumen
      await db.from('push_subscriptions').delete().eq('user_id', s.user_id).eq('endpoint', s.endpoint);
    } else {
      console.error('Push fehlgeschlagen', e.statusCode, e.body);
    }
    return 0;
  }
}

Deno.serve(async (req) => {
  // Nur der Zeitplan kennt das Geheimwort.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* leerer Body ist ok */ }

  const { data: subs, error } = await db.from('push_subscriptions').select('*');
  if (error) return json({ error: error.message }, 500);

  // Testmodus: {"test": true} schickt sofort eine Nachricht an alle Geräte.
  if (body.test) {
    let n = 0;
    for (const s of subs ?? []) n += await send(s, JSON.stringify({ title: 'Habits', body: 'Test erfolgreich.', tag: 'test' }));
    return json({ test: true, sent: n });
  }

  const byUser = new Map<string, any[]>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  // Einstellungen der täglichen Erinnerung (ohne Zeile: Standard an um 20:00). Ein Lesefehler darf die übrigen Erinnerungen nie stören.
  const { data: setRows } = await db.from('user_settings').select('*');
  const settings = new Map((setRows ?? []).map((r: any) => [r.user_id, r]));

  let sent = 0;
  for (const [uid, list] of byUser) {
    const { day, minutes, weekday } = localParts(list[0].tz);

    // ---- Tägliche Sammel-Erinnerung ----
    const cfg: any = settings.get(uid) ?? { daily_enabled: true, daily_time: '20:00:00' };
    if (cfg.daily_enabled && dailyDue(minutes, cfg.daily_time, LATE_MIN)) {
      const { data: all } = await db.from('habits').select('id,name,emoji,target,days,created,archived').eq('user_id', uid).lte('created', day);
      const { data: todayLogs } = await db.from('logs').select('habit_id,count,skip').eq('user_id', uid).eq('day', day);
      const open = dailyOpenHabits(all ?? [], todayLogs ?? [], day, weekday);
      if (open.length) {
        const { data: claimed } = await db.from('reminders_sent')
          .upsert({ user_id: uid, day, habit_id: '__daily__' }, { onConflict: 'user_id,day,habit_id', ignoreDuplicates: true })
          .select();
        if (claimed?.length) {
          const payload = JSON.stringify({ title: 'Habits', body: dailyBody(open), tag: 'daily-' + day });
          for (const s of list) sent += await send(s, payload);
        }
      }
    }

    // ---- To-Do-Erinnerungen (Tag + Uhrzeit der Aufgabe, gleiche Logik wie bei den Habits) ----
    try {
    const { data: todos, error: todoErr } = await db.from('todos')
      .select('id,text,emoji,due_day,at_time,remind_before')
      .eq('user_id', uid).eq('done', false).eq('deleted', false)
      .not('due_day', 'is', null).not('at_time', 'is', null).not('remind_before', 'is', null)
      .gte('due_day', day).lte('due_day', dayStr(dayNum(day) + 16));
    if (todoErr) throw todoErr;
    for (const { h, occDay } of todoOccurrences(todos ?? [], day, minutes, LATE_MIN)) {
      const { data: claimed } = await db.from('reminders_sent')
        .upsert({ user_id: uid, day: occDay, habit_id: 'todo:' + h.id }, { onConflict: 'user_id,day,habit_id', ignoreDuplicates: true })
        .select();
      if (!claimed?.length) continue;
      const payload = JSON.stringify({
        title: 'Habits',
        body: reminderBody({ emoji: h.emoji, name: h.text, target: 1 }, h.remind_before, whenWord(occDay, day), String(h.at_time).slice(0, 5)),
        tag: 'todo-' + h.id + '-' + occDay,
      });
      for (const s of list) sent += await send(s, payload);
    }
    } catch (e) { console.error('To-Do-Erinnerungen fehlgeschlagen', e); }   // darf die Habit-Erinnerungen nie stoppen

    const { data: habits } = await db.from('habits')
      .select('id,name,emoji,target,days,at_time,remind_before,created,archived')
      .eq('user_id', uid).not('at_time', 'is', null).not('remind_before', 'is', null).lte('created', day);

    const due = dueOccurrences(habits ?? [], day, minutes, LATE_MIN);
    if (!due.length) continue;

    const { data: logs } = await db.from('logs').select('day,habit_id,count,skip')
      .eq('user_id', uid).in('day', [...new Set(due.map((x) => x.occDay))]).in('habit_id', due.map((x) => x.h.id));
    const done = new Map((logs ?? []).map((l) => [l.day + '|' + l.habit_id, l]));

    for (const { h, occDay } of due) {
      const l = done.get(occDay + '|' + h.id);
      if (l && (l.skip || l.count >= h.target)) continue; // Termin erledigt oder übersprungen → keine Erinnerung

      // "Beanspruchen": nur wer die Zeile neu einfügt, darf senden. Schützt vor Doppelversand. day = Tag des Termins.
      const { data: claimed } = await db.from('reminders_sent')
        .upsert({ user_id: uid, day: occDay, habit_id: h.id }, { onConflict: 'user_id,day,habit_id', ignoreDuplicates: true })
        .select();
      if (!claimed?.length) continue;

      const t = String(h.at_time).slice(0, 5);
      const b = h.remind_before;
      const when = whenWord(occDay, day);
      const payload = JSON.stringify({
        title: 'Habits',
        body: reminderBody(h, b, when, t),
        tag: 'habit-' + h.id + '-' + occDay,
      });
      for (const s of list) sent += await send(s, payload);
    }
  }

  // Alte Merkzettel aufräumen
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  await db.from('reminders_sent').delete().lt('day', cutoff);

  return json({ sent, users: byUser.size });
});
