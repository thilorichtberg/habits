#!/usr/bin/env python3
"""Stempelt eine neue Versionsnummer in index.html (vor jedem Hochladen ausführen).

Die Version steht an zwei Stellen: in der Meta-Angabe "app-version" (die App zeigt sie in den Einstellungen an
und vergleicht sie beim Update-Check) und als "?v=..." an app.js, style.css und vendor/supabase.js. Dadurch hat jede
Veröffentlichung neue Adressen, und kein Browser kann alte Dateien aus dem Zwischenspeicher nehmen.
"""
import datetime, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
index = root / "index.html"
now = datetime.datetime.now(datetime.timezone.utc).astimezone()
label = now.strftime("%Y-%m-%d %H:%M")
token = now.strftime("%Y%m%d%H%M")

html = index.read_text(encoding="utf-8")
html = re.sub(r'(<meta name="app-version" content=")[^"]*(")', rf'\g<1>{label}\g<2>', html)
html = re.sub(r'((?:href|src)="(?:style\.css|app\.js|vendor/supabase\.js))(?:\?v=[^"]*)?(")', rf'\g<1>?v={token}\g<2>', html)
index.write_text(html, encoding="utf-8")
print(f"Version gestempelt: {label} ({token})")
