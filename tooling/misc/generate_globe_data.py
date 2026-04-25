"""
Download Natural Earth 110m land GeoJSON and generate JS arrays for the globe.
Outputs: static/www/data/globe_land_data.js with COAST_GROUPS and FILL_POINTS.
"""
import json
import math
import os
import requests

GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "www", "data", "globe_land_data.js")

# Simplification: skip points closer than this many degrees to reduce size
COAST_MIN_DIST = 1.0  # degrees between coastline points
FILL_STEP = 4.0       # degrees between fill sample grid points


def download_geojson():
    print("Downloading Natural Earth 110m land GeoJSON...")
    r = requests.get(GEOJSON_URL, timeout=30)
    r.raise_for_status()
    return r.json()


def extract_rings(geojson):
    """Extract all polygon rings (outer boundaries) as [[lng, lat], ...] arrays."""
    rings = []
    for feature in geojson["features"]:
        geom = feature["geometry"]
        if geom["type"] == "Polygon":
            for ring in geom["coordinates"]:
                rings.append(ring)  # ring is [[lng, lat], [lng, lat], ...]
        elif geom["type"] == "MultiPolygon":
            for polygon in geom["coordinates"]:
                for ring in polygon:
                    rings.append(ring)
    return rings


def simplify_ring(ring, min_dist):
    """Remove points that are too close together."""
    if len(ring) < 3:
        return ring
    result = [ring[0]]
    for i in range(1, len(ring)):
        dx = ring[i][0] - result[-1][0]
        dy = ring[i][1] - result[-1][1]
        if math.sqrt(dx*dx + dy*dy) >= min_dist:
            result.append(ring[i])
    return result


def interpolate_ring(ring, max_gap=3.0):
    """Add intermediate points where gaps are too large."""
    result = []
    for i in range(len(ring)):
        a = ring[i]
        b = ring[(i + 1) % len(ring)]
        result.append(a)
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        dist = math.sqrt(dx*dx + dy*dy)
        if dist > max_gap:
            steps = int(dist / max_gap) + 1
            for s in range(1, steps):
                t = s / steps
                result.append([a[0] + dx*t, a[1] + dy*t])
    return result


def point_in_ring(lat, lng, ring):
    """Ray-casting point-in-polygon. Ring is [[lng, lat], ...]."""
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
    """Sample a grid and keep points that fall inside any ring."""
    print(f"Generating fill points (step={step})...")
    points = []
    for lat in range(int(-70), int(80), int(step)):
        lng_step = step / max(math.cos(math.radians(lat)), 0.3)
        lng = -180.0
        while lng < 180.0:
            for ring in rings:
                if point_in_ring(lat, lng, ring):
                    points.append([round(lat, 1), round(lng, 1)])
                    break
            lng += lng_step
    return points


def format_ring_for_js(ring):
    """Format a ring as a JS array of [lat,lng] pairs (note: GeoJSON is [lng,lat])."""
    pairs = []
    for pt in ring:
        pairs.append(f"[{round(pt[1], 2)},{round(pt[0], 2)}]")
    return "[" + ",".join(pairs) + "]"


def main():
    data = download_geojson()
    rings = extract_rings(data)
    print(f"Extracted {len(rings)} polygon rings")

    # Process coastline rings
    coast_groups = []
    total_coast_pts = 0
    for ring in rings:
        simplified = simplify_ring(ring, COAST_MIN_DIST)
        interpolated = interpolate_ring(simplified, max_gap=2.5)
        if len(interpolated) >= 3:
            coast_groups.append(interpolated)
            total_coast_pts += len(interpolated)

    print(f"Coastline: {len(coast_groups)} groups, {total_coast_pts} total points")

    # Generate fill points
    fill_points = generate_fill_points(rings, FILL_STEP)
    print(f"Fill: {len(fill_points)} points")

    # Write JS file
    print(f"Writing {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "w") as f:
        f.write("// Auto-generated from Natural Earth 110m land GeoJSON\n")
        f.write("// Each group is an array of [lat, lng] pairs forming a coastline ring\n")
        f.write("var COAST_GROUPS = [\n")
        for i, group in enumerate(coast_groups):
            f.write("  " + format_ring_for_js(group))
            if i < len(coast_groups) - 1:
                f.write(",")
            f.write("\n")
        f.write("];\n\n")

        f.write("// Sparse interior fill points [lat, lng]\n")
        f.write("var FILL_POINTS = [\n")
        chunks = []
        for pt in fill_points:
            chunks.append(f"[{pt[0]},{pt[1]}]")
        # Write in rows of 20
        for i in range(0, len(chunks), 20):
            f.write("  " + ",".join(chunks[i:i+20]))
            if i + 20 < len(chunks):
                f.write(",")
            f.write("\n")
        f.write("];\n")

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Done! {OUTPUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
