/**
 * Splits trail geometry out of HIKE_DATA into one JSON file per trail
 * (keyed by hike id). Loaded on demand by hikes.js → loadTrail(id).
 *
 * Output: static/www/data/trails/{hikeId}.json — coords[] (LineString) or
 *         coords[][] (MultiLineString)
 *
 * After writing, the inline `trail:` arrays in HIKE_DATA are nulled out
 * to avoid duplicating the geometry in the JS bundle.
 *
 * Run: node tooling/split_trails_per_file.js
 */
const fs = require('fs');
const path = require('path');

const HIKE_DATA_PATH = path.join(__dirname, '..', 'static', 'www', 'data', 'hikes_data.js');
const TRAILS_DIR = path.join(__dirname, '..', 'static', 'www', 'js', 'trails');

const src = fs.readFileSync(HIKE_DATA_PATH, 'utf8');
const match = src.match(/var HIKE_DATA = (\[[\s\S]*\]);/);
if (!match) { console.error('Could not parse HIKE_DATA'); process.exit(1); }

let hikeData;
eval('hikeData = ' + match[1]);

if (!fs.existsSync(TRAILS_DIR)) fs.mkdirSync(TRAILS_DIR, { recursive: true });

let written = 0;
let totalBytes = 0;
for (const h of hikeData) {
    if (!h.trail || h.trail.length === 0) continue;
    const file = path.join(TRAILS_DIR, `${h.id}.json`);
    const json = JSON.stringify(h.trail);
    fs.writeFileSync(file, json, 'utf8');
    totalBytes += Buffer.byteLength(json, 'utf8');
    written++;
}
console.log(`Wrote ${written} per-trail files, total ${(totalBytes / 1024).toFixed(0)} KB`);

const cleaned = src.replace(/        trail: \[\[[\s\S]*?\]\]\n    \}/g, '        trail: null\n    }');
fs.writeFileSync(HIKE_DATA_PATH, cleaned, 'utf8');
console.log(`HIKE_DATA after null-out: ${(fs.statSync(HIKE_DATA_PATH).size / 1024).toFixed(0)} KB`);
