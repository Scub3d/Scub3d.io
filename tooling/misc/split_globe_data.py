"""
Splits static/www/data/globe_land_data.js (produced by generate_globe_data_hd.py)
into the 5 per-category files under static/www/data/globe/ that the frontend
loads individually.

Workflow:
    1. python tooling/generate_globe_data_hd.py  # writes globe_land_data.js
    2. python tooling/split_globe_data.py        # splits into 5 files + removes source

Layout after split:
    static/www/data/globe/
        coast_lod0.js   # COAST_GROUPS + FILL_POINTS                 (LOD 0, 110m)
        coast_lod1.js   # COAST_GROUPS_HD + FILL_POINTS_HD           (LOD 1, 50m)
        borders.js      # BORDER_GROUPS + STATE_GROUPS
        ocean.js        # OCEAN_POINTS
        mask.js         # LAND_MASK_B64 + LAND_MASK_W + LAND_MASK_H
"""
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOURCE = os.path.join(REPO_ROOT, "static", "www", "data", "globe_land_data.js")
DEST_DIR = os.path.join(REPO_ROOT, "static", "www", "data", "globe")

# Order matters — matches the order the generator writes variables.
# Each entry: (output filename, list of top-level `var NAME =` identifiers)
SPLITS = [
    ("coast_lod0.js", ["COAST_GROUPS", "FILL_POINTS"]),
    ("coast_lod1.js", ["COAST_GROUPS_HD", "FILL_POINTS_HD"]),
    ("borders.js", ["BORDER_GROUPS", "STATE_GROUPS"]),
    ("ocean.js", ["OCEAN_POINTS"]),
    ("mask.js", ["LAND_MASK_B64", "LAND_MASK_W"]),  # LAND_MASK_W is on the same line as LAND_MASK_H
]


def extract_block(content, var_name):
    # Find the var declaration and its preceding line-comment block (section header).
    # Each block ends at `];\n` for arrays, or at the next `var ` / end-of-file for scalars.
    pattern = re.compile(
        r"(?:(?:^//[^\n]*\n)+)?" +  # optional preceding comment lines
        r"^var " + re.escape(var_name) + r"\b.*?(?:;\n|\];\n)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(content)
    if not match:
        raise ValueError(f"Could not locate 'var {var_name}' block in source")
    return match.group(0)


def main():
    if not os.path.exists(SOURCE):
        print(f"ERROR: {SOURCE} not found. Run generate_globe_data_hd.py first.", file=sys.stderr)
        sys.exit(1)

    with open(SOURCE, "r", encoding="utf-8") as f:
        content = f.read()

    os.makedirs(DEST_DIR, exist_ok=True)

    for filename, vars_in_file in SPLITS:
        out_path = os.path.join(DEST_DIR, filename)
        blocks = [extract_block(content, v) for v in vars_in_file]
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("".join(blocks))
        size_kb = os.path.getsize(out_path) / 1024
        print(f"  wrote {filename:20s} ({size_kb:8.1f} KB)  <- {', '.join(vars_in_file)}")

    os.remove(SOURCE)
    print(f"\nRemoved source: {SOURCE}")


if __name__ == "__main__":
    main()
