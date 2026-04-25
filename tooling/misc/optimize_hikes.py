"""
Optimize hikes page loading:
1. Split trail coordinates out of hikes_data.js into a separate lazy-loaded file
2. Compact LAND_MASK from comma-separated 0/1 values into a base64 bitfield
"""
import re
import json
import base64
import math
import os

HIKE_DATA_PATH = 'static/www/data/hikes_data.js'
HIKE_TRAILS_PATH = 'static/www/js/hikes_trails.js'
GLOBE_DATA_PATH = 'static/www/data/globe_land_data.js'


def split_hike_data():
    """Extract trail arrays from hike data into a separate file."""
    print("=== Splitting hike trail data ===")

    with open(HIKE_DATA_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)

    # Find all trail entries with data (not null)
    # Pattern: id: 'some-id' ... trail: [data]
    trails = {}

    # Find each hike entry and extract its id and trail
    entries = re.finditer(r"id:\s*'([^']+)'", content)
    for entry in entries:
        hike_id = entry.group(1)
        # Find the trail field after this id
        trail_search_start = entry.end()
        # Look for 'trail: ' followed by data (not null)
        trail_match = re.search(r'trail:\s*(\[.+?)(?=\n\s*\})', content[trail_search_start:trail_search_start+700000], re.DOTALL)
        if trail_match:
            trail_str = trail_match.group(1).strip()
            if trail_str != 'null':
                try:
                    trail_data = json.loads(trail_str)
                    trails[hike_id] = trail_data
                    # Replace trail data with null in the original
                    abs_start = trail_search_start + trail_match.start(1)
                    abs_end = trail_search_start + trail_match.end(1)
                    content = content[:abs_start] + 'null' + content[abs_end:]
                    # Adjust for replacement length change
                    # Need to re-search since content changed
                except json.JSONDecodeError:
                    print("  WARNING: Could not parse trail for %s" % hike_id)

    # Since replacements shift indices, do it differently - rebuild
    with open(HIKE_DATA_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace each trail array with null, working backwards to preserve indices
    replacements = []
    for hike_id in trails:
        id_pattern = "id: '%s'" % re.escape(hike_id)
        id_match = re.search(id_pattern, content)
        if not id_match:
            continue
        # Find trail: after this id
        after_id = content[id_match.end():]
        trail_match = re.search(r'trail:\s*(\[)', after_id)
        if not trail_match:
            continue
        # Find matching bracket
        abs_start = id_match.end() + trail_match.start(1)
        depth = 0
        i = abs_start
        while i < len(content):
            if content[i] == '[':
                depth += 1
            elif content[i] == ']':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        abs_end = i + 1
        replacements.append((abs_start, abs_end, hike_id))

    # Sort by position descending so we can replace without shifting
    replacements.sort(key=lambda x: x[0], reverse=True)
    for start, end, hike_id in replacements:
        content = content[:start] + 'null' + content[end:]

    with open(HIKE_DATA_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

    new_size = len(content)
    print("  Extracted %d trails" % len(trails))
    print("  Main data: %d KB -> %d KB (saved %d KB)" % (
        original_size // 1024, new_size // 1024, (original_size - new_size) // 1024))

    # Write trails file
    trails_js = 'var HIKE_TRAILS = ' + json.dumps(trails, separators=(',', ':')) + ';\n'
    with open(HIKE_TRAILS_PATH, 'w', encoding='utf-8') as f:
        f.write(trails_js)
    print("  Trails file: %d KB" % (len(trails_js) // 1024))

    return trails


def compact_land_mask():
    """Encode LAND_MASK as base64 bitfield."""
    print("\n=== Compacting LAND_MASK ===")

    with open(GLOBE_DATA_PATH, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    original_size = len(content)

    # Extract LAND_MASK array
    mask_match = re.search(r'var LAND_MASK = \[([\s\S]*?)\];', content)
    if not mask_match:
        print("  ERROR: LAND_MASK not found")
        return

    mask_str = mask_match.group(1)
    values = [int(v.strip()) for v in mask_str.split(',') if v.strip()]
    total = len(values)
    width = int(math.sqrt(total * 2))  # width = 2 * height for equirectangular
    height = total // width
    print("  Found %d values (%dx%d)" % (total, width, height))

    # Pack into bitfield
    num_bytes = (total + 7) // 8
    packed = bytearray(num_bytes)
    for i, v in enumerate(values):
        if v:
            packed[i // 8] |= (1 << (i % 8))

    b64 = base64.b64encode(bytes(packed)).decode('ascii')
    print("  Packed: %d bytes -> %d base64 chars" % (num_bytes, len(b64)))

    # Replace in file
    old_block_start = content.index('// Land mask')
    old_block_end = content.index('];\n', mask_match.start()) + 3

    new_block = '// Land mask — %dx%d, base64-packed bitfield (1 bit per cell)\n' % (width, height)
    new_block += 'var LAND_MASK_B64 = "%s";\n' % b64
    new_block += 'var LAND_MASK_W = %d, LAND_MASK_H = %d;\n' % (width, height)

    content = content[:old_block_start] + new_block + content[old_block_end:]

    with open(GLOBE_DATA_PATH, 'w', encoding='utf-8', errors='replace') as f:
        f.write(content)

    new_size = len(content)
    old_mask_size = old_block_end - old_block_start
    new_mask_size = len(new_block)
    print("  Mask data: %d KB -> %d KB (saved %d KB)" % (
        old_mask_size // 1024, new_mask_size // 1024, (old_mask_size - new_mask_size) // 1024))
    print("  Total file: %d KB -> %d KB" % (original_size // 1024, new_size // 1024))


if __name__ == '__main__':
    split_hike_data()
    compact_land_mask()
    print("\nDone!")
