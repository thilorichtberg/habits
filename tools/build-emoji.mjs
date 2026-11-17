// Erzeugt emoji-de.json (alle Emojis mit deutschen Namen und Suchbegriffen) aus dem Paket "emojibase-data".
// Quelle der Texte: Unicode CLDR (Unicode License), aufbereitet von emojibase (MIT).
//
//   npm i emojibase-data      (in einem beliebigen Arbeitsordner)
//   node tools/build-emoji.mjs <Pfad-zu>/node_modules/emojibase-data emoji-de.json
//
// Format: { groups: [Gruppennamen], list: [[emoji, name, suchbegriffe ("a|b|c"), gruppe, unicode-version, hauttöne|0], ...] }
// "hauttöne" sind die 5 Varianten (hell bis dunkel) für Personen-Emojis, sonst 0.
import { readFileSync, writeFileSync } from 'node:fs';
const [dir = 'node_modules/emojibase-data', out = 'emoji-de.json'] = process.argv.slice(2);
const data = JSON.parse(readFileSync(`${dir}/de/data.json`, 'utf8'));
const msg = JSON.parse(readFileSync(`${dir}/de/messages.json`, 'utf8'));
const keys = msg.groups.filter((g) => g.key !== 'component');              // Hautfarben-Bausteine und Co. sind keine eigenen Emojis
const groups = keys.map((g) => g.message);
const idx = new Map(msg.groups.map((g, i) => [g.order ?? i, g.key]));
const gIndex = (g) => { const key = msg.groups.find((x) => x.order === g)?.key; return keys.findIndex((k) => k.key === key); };
const list = [];
for (const e of data) {
  if (e.group === undefined) continue;
  const g = gIndex(e.group);
  if (g < 0) continue;
  const skins = (e.skins || []).filter((s) => typeof s.tone === 'number').sort((a, b) => a.tone - b.tone).map((s) => s.emoji);
  list.push([e.emoji, e.label, (e.tags || []).join('|'), g, e.version, skins.length === 5 ? skins : 0]);
}
writeFileSync(out, JSON.stringify({ groups, list }));
console.log(`${list.length} Emojis, ${list.filter((x) => x[5]).length} davon mit Hauttönen, ${groups.length} Gruppen`);
