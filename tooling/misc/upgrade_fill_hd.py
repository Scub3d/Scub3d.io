"""
Regenerate FILL_POINTS_HD at higher density (1.0° step instead of 2.0°)
and patch it into the existing globe_land_data.js.
"""
import math
import os
import re
import requests

NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
LAND_50M_URL = f"{NE_BASE}/ne_50m_land.geojson"

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "globe_land_data.js")

FILL_STEP = 1.0  # was 2.0°


def download(url):
    print(f"  Downloading {url.split('/')[-1]}...")
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.json()


def extract_rings(geojson):
    rings = []
    for feat in geojson["features"]:
        geom = feat["geometry"]
        if geom["type"] == "Polygon":
            for ring in geom["coordinates"]:
                rings.append(ring)
        elif geom["type"] == "MultiPolygon":
            for poly in geom["coordinates"]:
                for ring in poly:
                    rings.append(ring)
    return rings


def point_in_ring(lat, lng, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        yi, xi = ring[i][1], ring[i][0]
        yj, xj = ring[j][1], ring[j][0]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def generate_fill_points(rings, step):
    # Build bounding boxes for speed
    ring_bounds = []
    for ring in rings:
        lats = [p[1] for p in ring]
        lngs = [p[0] for p in ring]
        ring_bounds.append((min(lats), max(lats), min(lngs), max(lngs)))

    points = []
    for lat_i in range(int(-70 / step), int(80 / step) + 1):
        lat = lat_i * step
        lng_step = step / max(math.cos(math.radians(lat)), 0.3)
        lng = -180.0
        while lng < 180.0:
            for ri, ring in enumerate(rings):
                mn_lat, mx_lat, mn_lng, mx_lng = ring_bounds[ri]
                if lat < mn_lat or lat > mx_lat or lng < mn_lng or lng > mx_lng:
                    continue
                if point_in_ring(lat, lng, ring):
                    points.append([round(lat, 1), round(lng, 1)])
                    break
            lng += lng_step
    return points


def main():
    print("Downloading 50m land data...")
    land_50 = download(LAND_50M_URL)
    rings = extract_rings(land_50)
    print(f"  {len(rings)} polygon rings")

    print(f"\nGenerating fill points (step={FILL_STEP}°)...")
    points = generate_fill_points(rings, FILL_STEP)
    print(f"  {len(points)} fill points")

    # Read existing file
    print(f"\nPatching {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "r") as f:
        content = f.read()

    # Build new block
    chunks = [f"[{pt[0]},{pt[1]}]" for pt in points]
    new_lines = []
    new_lines.append(f"// HD land fill dots ({FILL_STEP}° step) — {len(points)} pts")
    new_lines.append("var FILL_POINTS_HD = [")
    for i in range(0, len(chunks), 20):
        row = "  " + ",".join(chunks[i:i + 20])
        if i + 20 < len(chunks):
            row += ","
        new_lines.append(row)
    new_lines.append("];")
    new_block = "\n".join(new_lines)

    # Replace old FILL_POINTS_HD block (match comment line + var declaration)
    pattern = r'//[^\n]*\nvar FILL_POINTS_HD = \[[\s\S]*?\];'
    if re.search(pattern, content):
        content = re.sub(pattern, new_block, content)
    else:
        print("ERROR: Could not find FILL_POINTS_HD block to replace!")
        return

    with open(OUTPUT_PATH, "w") as f:
        f.write(content)

    print("Done!")


if __name__ == "__main__":
    main()
