"""Extract previews and encode generated movement atlases; never changes poses.

Usage: python scripts/build-physis-exercise-assets.py output/human-exercise-assets-state.json [--merge]
Requires Pillow. The private source manifest stays in ignored output/.
"""
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
state = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
destination = root / 'public/physis-art/exercises'
destination.mkdir(parents=True, exist_ok=True)
media_path = root / 'app/physis/exercise-media-data.json'
media = json.loads(media_path.read_text(encoding='utf-8')) if '--merge' in sys.argv[2:] else {}
for entry in state['specs']:
    if not entry.get('source'):
        continue
    exercise_id = entry['id']
    if not re.fullmatch(r'[a-z][a-z0-9-]*', exercise_id):
        raise ValueError('Invalid exercise id')
    image = Image.open(entry['source']).convert('RGB')
    width, height = image.size
    split = state['splits'].get(exercise_id, height // 2)
    if width % 3 or not 0 < split < height:
        raise ValueError('Invalid atlas geometry: ' + exercise_id)
    image.save(destination / f'{exercise_id}-human-v1.webp', 'WEBP', quality=80, method=6)
    poster = Image.new('RGB', (640, 360), image.getpixel((5, 5)))
    # A literal frame extraction, with padding rather than clipped heads or feet.
    for person, (top, bottom) in enumerate([(0, split), (split, height)]):
        frame = image.crop((width // 3 + 3, top + 3, 2 * width // 3 - 3, bottom - 3))
        preview = ImageOps.contain(frame, (320, 352), Image.Resampling.LANCZOS)
        poster.paste(preview, (person * 320 + (320 - preview.width) // 2, (360 - preview.height) // 2))
    poster.save(destination / f'{exercise_id}-poster-human-v1.webp', 'WEBP', quality=78, method=6)
    media[exercise_id] = {'src': f'/physis-art/exercises/{exercise_id}-human-v1.webp', 'poster': f'/physis-art/exercises/{exercise_id}-poster-human-v1.webp', 'split': split, 'width': width, 'height': height}
media_path.write_text(json.dumps(media, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Encoded {len(media)} atlases and {len(media)} previews.')
