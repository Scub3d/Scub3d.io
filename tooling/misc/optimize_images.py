"""
Optimize images for web:
- Resize JPGs over 2000px wide to max 2000px
- Compress JPGs to quality 80
- Skip GIFs (need different handling)
- Report savings
"""
import os
from PIL import Image

IMG_DIR = 'static/www/img'
MAX_WIDTH = 2000
JPEG_QUALITY = 80
MIN_SIZE_KB = 500  # only optimize files over 500KB


def optimize_dir(directory):
    total_before = 0
    total_after = 0
    count = 0

    for root, dirs, files in os.walk(directory):
        for fname in files:
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue

            fpath = os.path.join(root, fname)
            size_before = os.path.getsize(fpath)

            if size_before < MIN_SIZE_KB * 1024:
                continue

            total_before += size_before

            try:
                img = Image.open(fpath)

                # Convert RGBA PNGs to RGB for JPEG saving
                if img.mode == 'RGBA':
                    # Keep as PNG but optimize
                    img.save(fpath, optimize=True)
                    size_after = os.path.getsize(fpath)
                    total_after += size_after
                    if size_after < size_before:
                        count += 1
                        print('  PNG %s: %d KB -> %d KB' % (
                            os.path.relpath(fpath, directory),
                            size_before // 1024, size_after // 1024))
                    else:
                        total_after = total_after - size_after + size_before
                    continue

                # Resize if too wide
                w, h = img.size
                if w > MAX_WIDTH:
                    ratio = MAX_WIDTH / w
                    new_h = int(h * ratio)
                    img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)

                # Save as optimized JPEG
                if img.mode != 'RGB':
                    img = img.convert('RGB')

                img.save(fpath, 'JPEG', quality=JPEG_QUALITY, optimize=True)
                size_after = os.path.getsize(fpath)
                total_after += size_after

                if size_after < size_before:
                    count += 1
                    saved_pct = (1 - size_after / size_before) * 100
                    print('  %s: %d KB -> %d KB (%.0f%% smaller)%s' % (
                        os.path.relpath(fpath, directory),
                        size_before // 1024, size_after // 1024, saved_pct,
                        ' [resized %dx%d]' % (MAX_WIDTH, new_h) if w > MAX_WIDTH else ''))
                else:
                    total_after = total_after - size_after + size_before

            except Exception as e:
                total_after += size_before
                print('  SKIP %s: %s' % (fname, e))

    return total_before, total_after, count


def main():
    for subdir in ['experience', 'hackathons', 'projects']:
        dirpath = os.path.join(IMG_DIR, subdir)
        if not os.path.exists(dirpath):
            continue
        print('\n=== %s ===' % subdir)
        before, after, count = optimize_dir(dirpath)
        if before > 0:
            print('  Total: %d MB -> %d MB (%d files optimized, saved %d MB)' % (
                before // 1024 // 1024, after // 1024 // 1024,
                count, (before - after) // 1024 // 1024))


if __name__ == '__main__':
    main()
