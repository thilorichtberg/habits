# Habits

Ein persönlicher Habit-Tracker mit To-Do-Liste, gebaut als **Progressive Web App** für das iPhone (läuft aber in jedem modernen Browser). Ohne Mac, ohne App Store: Die App wird über GitHub Pages ausgeliefert und per „Zum Home-Bildschirm" installiert.

**Demo:** <https://thilorichtberg.github.io/habits/>
Ohne Anmeldung läuft alles lokal im Browser (Daten bleiben auf dem Gerät). Sync und Push-Erinnerungen brauchen ein eigenes Backend, siehe [Eigene Instanz aufsetzen](#eigene-instanz-aufsetzen).

> Persönliches Projekt, das ich für mich und Freunde baue. Die Oberfläche ist auf Deutsch.

## Funktionen

**Habits**
- Abhaken per Kreis, Ziele pro Tag (zum Beispiel „2 Bananen"), frei wählbare Wochentage
- Uhrzeit mit Erinnerung zur Uhrzeit oder **beliebig lange vorher** (Minuten bis 14 Tage)
- Wischgesten: nach links löschen (mit Rückfrage und „Wiederherstellen"), nach rechts **überspringen mit Grund**. „Krankheit" zählt weder als verpasst noch in die Quote
- Optionales Emoji als Symbol, Tagesquote in Prozent, Serie (aktuell und längste)
- Kalender mit Tagesbericht: abgeschlossen, versäumt, übersprungen

**To-Do**
- Heute, Später und Erledigt (eingeklappt), Suche, Unterpunkte
- Presets: Aufgaben samt Unterpunkten als Vorlage speichern und wieder laden
- Zählt bewusst nicht zur Habit-Quote

**Erinnerungen (Web Push)**
- Pro Habit zur eingestellten Zeit, auch bei geschlossener App
- Tägliche Sammel-Erinnerung (Standard 20:00, einstellbar), wenn noch Habits offen sind

**Technik und Bedienung**
- **Local-first:** Die App arbeitet immer lokal und gleicht im Hintergrund mit der Cloud ab. Pro Eintrag gewinnt die jüngere Änderung (last write wins)
- Backup als JSON (Export/Import), Hell- und Dunkelmodus, Seitenleiste für künftige Apps
- Drück-Animationen, Rücksicht auf „Bewegung reduzieren", Screenreader-Namen, Tastatur-Alternativen zu den Wischgesten
- Updates kommen sofort an (Service Worker fragt immer beim Server nach); Version und „Auf Updates prüfen" stehen in den Einstellungen

## Architektur

```
 iPhone (PWA)                         Supabase (EU)
 ┌──────────────────────────┐        ┌───────────────────────────────────────────┐
 │ index.html + app.js      │  HTTPS │ Postgres + Row Level Security             │
 │ localStorage (Wahrheit)  │◄──────►│ Auth (E-Mail + Passwort, Signup aus)      │
 │ Service Worker (sw.js)   │        │ Tabellen: habits, logs, todos, …          │
 └────────────▲─────────────┘        │ pg_cron ──jede Minute──► Edge Function ───┼──► Apple Push
              │ Push-Nachricht       │        (prüft Termine, sendet Web Push)   │    (VAPID)
              └──────────────────────┴───────────────────────────────────────────┘
        Auslieferung der App: GitHub Pages (statische Dateien, kein Build-Schritt)
```

- **Frontend:** reines HTML, CSS und JavaScript, kein Framework, kein Build. Die Ansichten werden als Template-Strings gerendert, Änderungen laufen über ein einziges Zustandsobjekt
- **Sync:** vollständiger Abgleich beim Start und beim Zurückkehren in die App, danach gebündelte Uploads einige Sekunden nach jeder Änderung. Gelöscht wird nur markiert, damit es auf allen Geräten ankommt und rückgängig gemacht werden kann
- **Erinnerungen:** Die Edge Function rechnet in der Zeitzone des Geräts aus, welche Termine jetzt fällig sind (auch Vorlauf über Mitternacht und mehrere Tage). Eine Merktabelle verhindert doppelte Nachrichten
- **Sicherheit:** Der Publishable Key in `app.js` ist öffentlich vorgesehen. Geschützt sind die Daten durch Login und Row Level Security (jeder sieht nur eigene Zeilen), Registrierung ist ausgeschaltet. Geheimnisse (VAPID-Privatschlüssel, Cron-Geheimwort) liegen nur in den Supabase-Secrets, nicht im Repository

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `index.html`, `app.js`, `style.css` | die App |
| `sw.js`, `manifest.webmanifest`, Icons | Service Worker (Offline, Updates, Push), Installierbarkeit |
| `vendor/supabase.js` | supabase-js 2.45.4, bewusst lokal eingebunden (Start auch offline) |
| `supabase/*.sql` | Datenbank-Migrationen (Tabellen, Rechte, Row Level Security) |
| `supabase/functions/send-reminders/` | Edge Function für die Push-Erinnerungen |
| `tools/stamp.py` | stempelt vor jeder Veröffentlichung eine neue Version (umgeht den 10-Minuten-Cache von GitHub Pages) |

## Lokal ausprobieren

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Dann <http://localhost:8080> öffnen. Ohne Backend läuft die App rein lokal.

## Eigene Instanz aufsetzen

Die App ist auf mein Supabase-Projekt eingestellt, dort ist die Registrierung aus. Wer sie nutzen will, braucht ein eigenes Projekt:

1. **Supabase-Projekt anlegen.** In den Einstellungen die Option „Automatically expose new tables" ausschalten (die Migrationen vergeben die Rechte ausdrücklich)
2. **URL und Publishable Key** in `app.js` eintragen (`SUPABASE_URL`, `SUPABASE_KEY`)
3. **Migrationen** im SQL Editor in dieser Reihenfolge ausführen: `schema.sql`, `push.sql`, `uhrzeit-vorlauf.sql`, `ueberspringen.sql`, `todos.sql`, `todo-unterpunkte.sql`, `emoji.sql`, `tagesreminder.sql`
4. **Nutzer anlegen** (Authentication → Users, „Auto Confirm User") und danach „Allow new users to sign up" ausschalten
5. **Push einrichten:**
   - VAPID-Schlüsselpaar erzeugen: `npx web-push generate-vapid-keys`. Den öffentlichen Schlüssel in `app.js` eintragen (`VAPID_PUBLIC_KEY`)
   - Edge Function aus `supabase/functions/send-reminders/index.ts` deployen, **ohne** JWT-Prüfung (`--no-verify-jwt`), und die Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` setzen
   - Zeitplan aus `cron.sql` im SQL Editor ausführen (dort das Geheimwort einsetzen, **nicht** in die Datei schreiben)
6. **Veröffentlichen:** `python3 tools/stamp.py`, committen, pushen. GitHub Pages liefert den Branch `main` aus

Push auf dem iPhone funktioniert nur, wenn die App über „Zum Home-Bildschirm" installiert ist (iOS 16.4 oder neuer).

## Tests

Die App wurde im Browser (Playwright, Handy-Viewports 375 und 390 px, hell und dunkel) und mit simuliertem Backend getestet: Abläufe, Wischgesten, Sync zwischen zwei Geräten, Zeitberechnung der Erinnerungen, Update-Auslieferung gegen einen Server mit GitHub-Pages-Cache-Headern. Die Testskripte liegen noch nicht in diesem Repository.

## Drittanbieter

- [supabase-js](https://github.com/supabase/supabase-js) (MIT), liegt unter `vendor/`
- Symbole im Stil von [Lucide](https://lucide.dev) (ISC)
- [web-push](https://github.com/web-push-libs/web-push) (MPL-2.0), wird zur Laufzeit in der Edge Function geladen

## Lizenz

[MIT](LICENSE). Für den Code von Drittanbietern gelten deren eigene Lizenzen.
