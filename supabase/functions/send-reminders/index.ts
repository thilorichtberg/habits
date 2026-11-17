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
// --- Ende Fälligkeit ---

const fmtLead = (b: number) => {
  const d = Math.floor(b / 1440), h = Math.floor((b % 1440) / 60), m = b % 60;
  return [d && `${d} ${d === 1 ? 'Tag' : 'Tage'}`, h && `${h} ${h === 1 ? 'Stunde' : 'Stunden'}`, m && `${m} ${m === 1 ? 'Minute' : 'Minuten'}`].filter(Boolean).join(' ');
};

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

  let sent = 0;
  for (const [uid, list] of byUser) {
    const { day, minutes } = localParts(list[0].tz);

    const { data: habits } = await db.from('habits')
      .select('id,name,target,days,at_time,remind_before,created,archived')
      .eq('user_id', uid).not('at_time', 'is', null).not('remind_before', 'is', null).lte('created', day);

    const due = dueOccurrences(habits ?? [], day, minutes, LATE_MIN);
    if (!due.length) continue;

    const { data: logs } = await db.from('logs').select('day,habit_id,count')
      .eq('user_id', uid).in('day', [...new Set(due.map((x) => x.occDay))]).in('habit_id', due.map((x) => x.h.id));
    const done = new Map((logs ?? []).map((l) => [l.day + '|' + l.habit_id, l.count]));

    for (const { h, occDay } of due) {
      if ((done.get(occDay + '|' + h.id) ?? 0) >= h.target) continue; // Termin schon erledigt → keine Erinnerung

      // "Beanspruchen": nur wer die Zeile neu einfügt, darf senden. Schützt vor Doppelversand. day = Tag des Termins.
      const { data: claimed } = await db.from('reminders_sent')
        .upsert({ user_id: uid, day: occDay, habit_id: h.id }, { onConflict: 'user_id,day,habit_id', ignoreDuplicates: true })
        .select();
      if (!claimed?.length) continue;

      const t = String(h.at_time).slice(0, 5);
      const b = h.remind_before;
      const when = occDay === day ? 'um '
        : occDay === dayStr(dayNum(day) + 1) ? 'morgen um '
        : `am ${new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(dayNum(occDay) * 86400000))} um `;
      const payload = JSON.stringify({
        title: h.name,
        body: (b > 0 ? `In ${fmtLead(b)}, ${when}${t} Uhr.` : `Jetzt, ${t} Uhr.`) + (h.target > 1 ? ` Ziel: ${h.target}×` : ''),
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
