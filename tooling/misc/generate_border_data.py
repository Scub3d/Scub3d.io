"""
Generate BORDER_GROUPS JS data from Natural Earth 110m admin-0 boundary lines.
Appends to static/www/data/globe_land_data.js alongside existing COAST_GROUPS and FILL_POINTS.

Usage: python tooling/generate_border_data.py
"""
import json
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOJSON_PATH = os.path.join(REPO_ROOT, 'tooling', 'ne_110m_admin_0_boundary_lines_land.geojson')
OUTPUT_PATH = os.path.join(REPO_ROOT, 'static', 'www', 'data', 'globe_border_data.js')

with open(GEOJSON_PATH, 'r') as f:
    data = json.load(f)

groups = []
for feature in data['features']:
    geom = feature['geometry']
    if geom['type'] == 'LineString':
        coords_list = [geom['coordinates']]
    elif geom['type'] == 'MultiLineString':
        coords_list = geom['coordinates']
    else:
        continue

    for coords in coords_list:
        # GeoJSON is [lng, lat], convert to [lat, lng] and round to 2 decimals
        points = []
        for lng, lat in coords:
            points.append([round(lat, 2), round(lng, 2)])
        if len(points) >= 2:
            groups.append(points)

# Write JS file
with open(OUTPUT_PATH, 'w') as f:
    f.write('// Auto-generated from Natural Earth 110m admin-0 boundary lines (land only)\n')
    f.write('// Each group is an array of [lat, lng] pairs forming a country border segment\n')
    f.write('var BORDER_GROUPS = [\n')
    for i, group in enumerate(groups):
        line = '  [' + ','.join('[{},{}]'.format(p[0], p[1]) for p in group) + ']'
        if i < len(groups) - 1:
            line += ','
        f.write(line + '\n')
    f.write('];\n')

print(f'Generated {len(groups)} border groups -> {OUTPUT_PATH}')
