const fs = require('fs');
const path = require('path');

const HIKE_DATA_PATH = path.join(__dirname, '..', 'static', 'www', 'data', 'hikes_data.js');
const updates = JSON.parse(fs.readFileSync(path.join(__dirname, 'coord_updates.json'), 'utf8'));
let src = fs.readFileSync(HIKE_DATA_PATH, 'utf8');

function esc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

updates.forEach(u => {
    const pat = new RegExp("(id: '" + esc(u.id) + "',[\\s\\S]*?)lat: [0-9.-]+, lng: [0-9.-]+");
    const next = src.replace(pat, `$1lat: ${u.newLat}, lng: ${u.newLng}`);
    if (next === src) console.log('FAILED', u.id);
    else { src = next; console.log('Updated', u.id); }
});

fs.writeFileSync(HIKE_DATA_PATH, src);
