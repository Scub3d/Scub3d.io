/**
 * Sets each hike's meta lat/lng to the bounding box center of its trail
 * geometry. Run after the pipeline (merge + inject + split) so trails_*.json
 * files exist.
 *
 * Run: node tooling/recenter_meta_to_bbox.js
 */
const fs = require('fs');
const path = require('path');

const HIKE_DATA_PATH = path.join(__dirname, '..', 'static', 'www', 'data', 'hikes_data.js');
const TRAILS_DIR = path.join(__dirname, '..', 'static', 'www', 'js', 'trails');

function flatten(t) {
    if (!t || !t.length) return [];
    return Array.isArray(t[0]) && Array.isArray(t[0][0]) ? [].concat(...t) : t;
}

function esc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let src = fs.readFileSync(HIKE_DATA_PATH, 'utf8');
const m = src.match(/var HIKE_DATA = (\[[\s\S]*\]);/);
let hd; eval('hd = ' + m[1]);

const stateCache = {};
function loadState(st) {
    if (!stateCache[st]) {
        const p = path.join(TRAILS_DIR, 'trails_' + st.toLowerCase() + '.json');
        stateCache[st] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    }
    return stateCache[st];
}

let updated = 0, skipped = 0;
for (const h of hd) {
    const m2 = (h.location || '').match(/,\s*(\S+)$/);
    if (!m2) continue;
    const t = loadState(m2[1])[h.id];
    if (!t || !t.length) { skipped++; continue; }
    const pts = flatten(t);
    const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
    const cLng = +((Math.min(...lngs) + Math.max(...lngs)) / 2).toFixed(5);
    const cLat = +((Math.min(...lats) + Math.max(...lats)) / 2).toFixed(5);
    if (Math.abs(cLat - h.lat) < 0.0001 && Math.abs(cLng - h.lng) < 0.0001) continue;

    const pat = new RegExp("(id: '" + esc(h.id) + "',[\\s\\S]*?)lat: [0-9.-]+, lng: [0-9.-]+");
    const next = src.replace(pat, `$1lat: ${cLat}, lng: ${cLng}`);
    if (next !== src) { src = next; updated++; }
}

fs.writeFileSync(HIKE_DATA_PATH, src);
console.log(`Updated ${updated} meta coords to bbox centers. Skipped ${skipped} (no trail data).`);
