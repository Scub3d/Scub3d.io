"""
Generate multi-LOD globe data for the hikes page.
Downloads Natural Earth 50m + 110m data and produces:
  - Coastlines at two detail levels (LOD 0 = coarse, LOD 1 = fine)
  - Country border lines
  - State/province border lines (LOD 1 only)
  - Denser fill points for LOD 1

Output: static/www/data/globe_land_data.js (replaces existing, backward compatible)
"""
import json
import math
import os
import requests

NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
URLS = {
    "land_110m": f"{NE_BASE}/ne_110m_land.geojson",
    "land_50m": f"{NE_BASE}/ne_50m_land.geojson",
    "borders_110m": f"{NE_BASE}/ne_110m_admin_0_boundary_lines_land.geojson",
    "borders_50m": f"{NE_BASE}/ne_50m_admin_0_boundary_lines_land.geojson",
    "states_50m": f"{NE_BASE}/ne_50m_admin_1_states_provinces_lines.geojson",
    "lakes_50m": f"{NE_BASE}/ne_50m_lakes.geojson",
}

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "www", "data", "globe_land_data.js")

# LOD 0 (zoomed out): dense enough to match border line density
LOD0_COAST_MIN_DIST = 0.15
LOD0_FILL_STEP = 3.0

# LOD 1 (zoomed in): even denser for close-up viewing
LOD1_COAST_MIN_DIST = 0.08
LOD1_FILL_STEP = 2.0

# Borders
BORDER_MIN_DIST = 0.15  # much denser country borders
STATE_MIN_DIST = 0.3


def download(name, url):
    cache_path = os.path.join(os.path.dirname(__file__), f"_cache_{name}.geojson")
    if os.path.exists(cache_path):
        print(f"  Using cached {name}")
        with open(cache_path) as f:
            return json.load(f)
    print(f"  Downloading {name}...")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    data = r.json()
    with open(cache_path, "w") as f:
        json.dump(data, f)
    return data


def extract_rings(geojson):
    rings = []
    for feature in geojson["features"]:
        geom = feature["geometry"]
        if geom["type"] == "Polygon":
            for ring in geom["coordinates"]:
                rings.append(ring)
        elif geom["type"] == "MultiPolygon":
            for polygon in geom["coordinates"]:
                for ring in polygon:
                    rings.append(ring)
    return rings


def extract_lines(geojson):
    lines = []
    for feature in geojson["features"]:
        geom = feature["geometry"]
        if geom["type"] == "LineString":
            lines.append(geom["coordinates"])
        elif geom["type"] == "MultiLineString":
            for line in geom["coordinates"]:
                lines.append(line)
    return lines


def simplify_ring(ring, min_dist):
    if len(ring) < 3:
        return ring
    result = [ring[0]]
    for i in range(1, len(ring)):
        dx = ring[i][0] - result[-1][0]
        dy = ring[i][1] - result[-1][1]
        if math.sqrt(dx * dx + dy * dy) >= min_dist:
            result.append(ring[i])
    return result


def interpolate_ring(ring, max_gap=3.0, closed=True):
    result = []
    n = len(ring) if closed else len(ring) - 1
    for i in range(n):
        a = ring[i]
        b = ring[(i + 1) % len(ring)]
        result.append(a)
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        dist = math.sqrt(dx * dx + dy * dy)
        if dist > max_gap:
            steps = int(dist / max_gap) + 1
            for s in range(1, steps):
                t = s / steps
                result.append([a[0] + dx * t, a[1] + dy * t])
    if not closed:
        result.append(ring[-1])  # include the final point
    return result


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
    points = []
    for lat_i in range(int(-70 / step), int(80 / step) + 1):
        lat = lat_i * step
        lng_step = step / max(math.cos(math.radians(lat)), 0.3)
        lng = -180.0
        while lng < 180.0:
            for ring in rings:
                if point_in_ring(lat, lng, ring):
                    points.append([round(lat, 1), round(lng, 1)])
                    break
            lng += lng_step
    return points


def generate_ocean_points(rings, step):
    """Sample a grid and keep points that are NOT inside any land polygon."""
    points = []
    for lat_i in range(int(-70 / step), int(80 / step) + 1):
        lat = lat_i * step
        lng_step = step / max(math.cos(math.radians(lat)), 0.3)
        lng = -180.0
        while lng < 180.0:
            is_land = False
            for ring in rings:
                if point_in_ring(lat, lng, ring):
                    is_land = True
                    break
            if not is_land:
                points.append([round(lat, 1), round(lng, 1)])
            lng += lng_step
    return points


def process_coastlines(rings, min_dist, max_gap=2.5):
    groups = []
    total = 0
    for ring in rings:
        simplified = simplify_ring(ring, min_dist)
        interpolated = interpolate_ring(simplified, max_gap=max_gap)
        if len(interpolated) >= 3:
            groups.append(interpolated)
            total += len(interpolated)
    return groups, total


def process_lines(lines, min_dist, max_gap=None):
    groups = []
    total = 0
    for line in lines:
        simplified = simplify_ring(line, min_dist)
        if max_gap:
            simplified = interpolate_ring(simplified, max_gap=max_gap, closed=False)
        if len(simplified) >= 2:
            groups.append(simplified)
            total += len(simplified)
    return groups, total


def format_ring_js(ring, precision=2):
    pairs = [f"[{round(pt[1], precision)},{round(pt[0], precision)}]" for pt in ring]
    return "[" + ",".join(pairs) + "]"


def write_array(f, var_name, groups, comment, precision=2):
    f.write(f"// {comment}\n")
    f.write(f"var {var_name} = [\n")
    for i, group in enumerate(groups):
        f.write("  " + format_ring_js(group, precision))
        if i < len(groups) - 1:
            f.write(",")
        f.write("\n")
    f.write("];\n\n")


def write_points(f, var_name, points, comment):
    f.write(f"// {comment}\n")
    f.write(f"var {var_name} = [\n")
    chunks = [f"[{pt[0]},{pt[1]}]" for pt in points]
    for i in range(0, len(chunks), 20):
        f.write("  " + ",".join(chunks[i:i + 20]))
        if i + 20 < len(chunks):
            f.write(",")
        f.write("\n")
    f.write("];\n\n")


def main():
    print("Downloading Natural Earth data...")
    land_110 = download("land_110m", URLS["land_110m"])
    land_50 = download("land_50m", URLS["land_50m"])
    borders_50 = download("borders_50m", URLS["borders_50m"])
    states_50 = download("states_50m", URLS["states_50m"])
    lakes_50 = download("lakes_50m", URLS["lakes_50m"])

    # Extract geometry
    rings_110 = extract_rings(land_110)
    rings_50 = extract_rings(land_50)
    border_lines_50 = extract_lines(borders_50)
    state_lines_50 = extract_lines(states_50)

    # Extract Great Lakes only — filter by bounding box (lat 41-49, lng -92 to -76)
    lake_rings_50 = extract_rings(lakes_50)
    great_lake_rings = []
    for ring in lake_rings_50:
        # Check if any point falls within the Great Lakes region
        in_region = False
        for pt in ring:
            lng, lat = pt[0], pt[1]
            if 41.0 <= lat <= 49.0 and -92.0 <= lng <= -76.0:
                in_region = True
                break
        if in_region and len(ring) >= 15:
            great_lake_rings.append(ring)
    print(f"\nRaw: {len(rings_110)} rings (110m), {len(rings_50)} rings (50m)")
    print(f"Raw: {len(lake_rings_50)} lake rings, {len(great_lake_rings)} Great Lakes rings")
    print(f"Raw: {len(border_lines_50)} border lines (50m), {len(state_lines_50)} state lines")

    # Combine land coastlines + Great Lakes shores
    combined_rings_50 = rings_50 + great_lake_rings

    # Process LOD 0 (dense, matching border line density + lakes)
    print("\nProcessing LOD 0 (50m + lakes, border-matched density)...")
    coast0, coast0_pts = process_coastlines(combined_rings_50, LOD0_COAST_MIN_DIST, max_gap=0.4)
    fill0 = generate_fill_points(rings_50, LOD0_FILL_STEP)
    print(f"  Coast: {len(coast0)} groups, {coast0_pts} pts")
    print(f"  Fill: {len(fill0)} pts")

    # Process LOD 1 (dense + lakes, for close-up viewing)
    print("\nProcessing LOD 1 (50m + lakes, dense)...")
    coast1, coast1_pts = process_coastlines(combined_rings_50, LOD1_COAST_MIN_DIST, max_gap=0.25)
    fill1 = generate_fill_points(rings_50, LOD1_FILL_STEP)
    print(f"  Coast: {len(coast1)} groups, {coast1_pts} pts")
    print(f"  Fill: {len(fill1)} pts")

    # Generate land mask (360x180, 1° resolution, row-major from lat -90 to +89)
    print("\nGenerating land mask (360x180)...")
    land_mask = []
    for lat_i in range(180):  # 0..179 → lat -90..+89
        lat = lat_i - 90 + 0.5  # center of each cell
        for lng_i in range(360):  # 0..359 → lng -180..+179
            lng = lng_i - 180 + 0.5
            is_land = 0
            for ring in rings_50:
                if point_in_ring(lat, lng, ring):
                    is_land = 1
                    break
            land_mask.append(is_land)
    land_count = sum(land_mask)
    print(f"  Land cells: {land_count}/{len(land_mask)} ({100*land_count/len(land_mask):.1f}%)")

    # Generate ocean dots
    print("\nGenerating ocean dots...")
    ocean_pts = generate_ocean_points(rings_50, 1.5)
    print(f"  Ocean: {len(ocean_pts)} pts")

    # Process borders (50m source + interpolation for density)
    print("\nProcessing borders...")
    borders, border_pts = process_lines(border_lines_50, BORDER_MIN_DIST, max_gap=0.4)
    states, state_pts = process_lines(state_lines_50, STATE_MIN_DIST, max_gap=0.8)
    print(f"  Country borders: {len(borders)} segments, {border_pts} pts")
    print(f"  State lines: {len(states)} segments, {state_pts} pts")

    # Write output
    print(f"\nWriting {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "w") as f:
        f.write("// Auto-generated globe data — multi-LOD with borders\n")
        f.write("// LOD 0 = zoomed out (110m), LOD 1 = zoomed in (50m)\n\n")

        # LOD 0 (backward compatible variable names)
        write_array(f, "COAST_GROUPS", coast0,
                    f"LOD 0: Coastlines (110m) — {len(coast0)} groups, {coast0_pts} pts")
        write_points(f, "FILL_POINTS", fill0,
                     f"LOD 0: Interior fill — {len(fill0)} pts")

        # LOD 1
        write_array(f, "COAST_GROUPS_HD", coast1,
                    f"LOD 1: Coastlines (50m) — {len(coast1)} groups, {coast1_pts} pts")
        write_points(f, "FILL_POINTS_HD", fill1,
                     f"LOD 1: Interior fill — {len(fill1)} pts")

        # Borders (always visible)
        write_array(f, "BORDER_GROUPS", borders,
                    f"Country borders (110m) — {len(borders)} segments, {border_pts} pts")
        write_array(f, "STATE_GROUPS", states,
                    f"State/province lines (50m) — {len(states)} segments, {state_pts} pts")

        # Ocean dots
        write_points(f, "OCEAN_POINTS", ocean_pts,
                     f"Ocean fill dots — {len(ocean_pts)} pts")

        # Land mask (360x180, 1° resolution)
        f.write(f"// Land mask — 360x180 (1° resolution), row-major from lat -90 to +89, lng -180 to +179\n")
        f.write(f"// {land_count} land cells / {len(land_mask)} total ({100*land_count/len(land_mask):.1f}%)\n")
        f.write("var LAND_MASK = [")
        for i in range(0, len(land_mask), 360):
            f.write(",".join(str(v) for v in land_mask[i:i+360]))
            if i + 360 < len(land_mask):
                f.write(",")
            f.write("\n")
        f.write("];\n\n")

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\nDone! {OUTPUT_PATH} ({size_kb:.1f} KB)")
    print(f"  LOD 0: {coast0_pts + len(fill0)} pts total")
    print(f"  LOD 1: {coast1_pts + len(fill1)} pts total")
    print(f"  Borders: {border_pts + state_pts} pts total")
    print(f"  Ocean: {len(ocean_pts)} pts")


if __name__ == "__main__":
    main()
