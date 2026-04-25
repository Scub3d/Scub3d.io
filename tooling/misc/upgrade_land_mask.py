"""
Regenerate LAND_MASK at higher resolution (0.25° = 1440x720) and patch it
into the existing globe_land_data.js, replacing the old 360x180 mask.
"""
import math
import os
import re
import requests

NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
LAND_50M_URL = f"{NE_BASE}/ne_50m_land.geojson"

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "globe_land_data.js")

# New resolution: 0.25° per cell
MASK_W = 1440  # longitude cells
MASK_H = 720   # latitude cells
CELL_SIZE = 0.25  # degrees per cell


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


def main():
    print("Downloading 50m land data...")
    land_50 = download(LAND_50M_URL)
    rings = extract_rings(land_50)
    print(f"  {len(rings)} polygon rings")

    # Build bounding boxes for rings to speed up point-in-ring tests
    print(f"\nGenerating land mask ({MASK_W}x{MASK_H}, {CELL_SIZE}° resolution)...")
    ring_bounds = []
    for ring in rings:
        lats = [p[1] for p in ring]
        lngs = [p[0] for p in ring]
        ring_bounds.append((min(lats), max(lats), min(lngs), max(lngs)))

    total = MASK_W * MASK_H
    land_mask = []
    done = 0
    for lat_i in range(MASK_H):
        lat = lat_i * CELL_SIZE - 90 + CELL_SIZE / 2
        for lng_i in range(MASK_W):
            lng = lng_i * CELL_SIZE - 180 + CELL_SIZE / 2
            is_land = 0
            for ri, ring in enumerate(rings):
                mn_lat, mx_lat, mn_lng, mx_lng = ring_bounds[ri]
                if lat < mn_lat or lat > mx_lat or lng < mn_lng or lng > mx_lng:
                    continue
                if point_in_ring(lat, lng, ring):
                    is_land = 1
                    break
            land_mask.append(is_land)
            done += 1
        if lat_i % 36 == 0:
            print(f"  {done}/{total} ({100*done/total:.0f}%)")

    land_count = sum(land_mask)
    print(f"  Land cells: {land_count}/{len(land_mask)} ({100*land_count/len(land_mask):.1f}%)")

    # Read existing file
    print(f"\nPatching {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "r") as f:
        content = f.read()

    # Build new mask block
    new_lines = []
    new_lines.append(f"// Land mask — {MASK_W}x{MASK_H} ({CELL_SIZE}° resolution), row-major from lat -90 to +89, lng -180 to +179")
    new_lines.append(f"// {land_count} land cells / {len(land_mask)} total ({100*land_count/len(land_mask):.1f}%)")
    new_lines.append("var LAND_MASK = [")
    for i in range(0, len(land_mask), MASK_W):
        row = ",".join(str(v) for v in land_mask[i:i+MASK_W])
        if i + MASK_W < len(land_mask):
            row += ","
        new_lines.append(row)
    new_lines.append("];")
    new_block = "\n".join(new_lines)

    # Replace old mask block
    pattern = r'// Land mask —.*?\nvar LAND_MASK = \[[\s\S]*?\];'
    if re.search(pattern, content):
        content = re.sub(pattern, new_block, content)
    else:
        # Fallback: find by variable name
        pattern2 = r'// .*?land.*?\n// .*?\nvar LAND_MASK = \[[\s\S]*?\];'
        content = re.sub(pattern2, new_block, content)

    with open(OUTPUT_PATH, "w") as f:
        f.write(content)

    print("Done!")


if __name__ == "__main__":
    main()
