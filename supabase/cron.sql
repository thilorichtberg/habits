-- Schritt 7d: Zeitplan, der die Funktion jede Minute aufruft.
-- WICHTIG: NICHT diese Datei bearbeiten. Kopiere den Inhalt in den Supabase SQL Editor und ersetze
-- dort HIER_DEIN_CRON_SECRET durch dein Geheimwort. Das Repository ist öffentlich.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '* * * * *',                                   -- jede Minute
  $$
  select net.http_post(
    -- Der Pfad am Ende ist der "Slug" der Funktion. Im Dashboard hat Supabase ihr den Standardnamen
    -- "clever-function" gegeben, und der Slug bleibt auch nach einer Umbenennung gleich.
    url     := 'https://syzrpidpcgkmpjowpcfp.supabase.co/functions/v1/clever-function',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'HIER_DEIN_CRON_SECRET'),
    body    := '{}'::jsonb
  );
  $$
);

-- Später ausschalten:   select cron.unschedule('send-reminders');
-- Läufe ansehen:        select * from cron.job_run_details order by start_time desc limit 10;
