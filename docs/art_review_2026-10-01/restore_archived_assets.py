"""Verify the cleanup archive, or explicitly restore its original art files.

--check is read-only. --execute restores only missing files, and refuses to
overwrite files whose current contents differ from the archived originals.
"""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
IMAGE_ROOT = (ROOT / 'legacy_vue/public/assets/images').resolve()


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--execute', action='store_true')
    parser.add_argument('--record', default='cleanup_result.json',
                        help='Execution record filename in this review directory')
    args = parser.parse_args()
    record_path = (OUT / args.record).resolve()
    if record_path.parent != OUT.resolve():
        raise ValueError('Execution record must stay within the review directory')
    result = json.loads(record_path.read_text(encoding='utf-8'))
    archive = Path(result['archive_path'])
    if hashlib.sha256(archive.read_bytes()).hexdigest() != result['archive_sha256']:
        raise ValueError('Archive SHA-256 differs from the verified cleanup record')
    entries = []
    with zipfile.ZipFile(archive) as saved:
        for record in result['removed_files']:
            target = (ROOT / record['path']).resolve()
            if not target.is_relative_to(IMAGE_ROOT) or target == IMAGE_ROOT:
                raise ValueError('Unsafe archive target: ' + str(target))
            data = saved.read(record['path'])
            if hashlib.sha256(data).hexdigest() != record['sha256']:
                raise ValueError('Archived file SHA-256 mismatch: ' + record['path'])
            if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != record['sha256']:
                raise ValueError('Refusing to overwrite changed art: ' + record['path'])
            entries.append((target, data))
    restored = 0
    if args.execute:
        for target, data in entries:
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                with target.open('xb') as output:
                    output.write(data)
                restored += 1
        restore_result = ('restore_result.json' if args.record == 'cleanup_result.json'
                          else record_path.stem + '_restore_result.json')
        (OUT / restore_result).write_text(json.dumps({
            'status': 'restored', 'archive_path': str(archive), 'restored_count': restored,
            'note': 'Only art files restored. Supporting source files in the ZIP need separate review.',
        }, indent=2), encoding='utf-8')
    print(json.dumps({'mode': 'restore' if args.execute else 'read_only_check',
                      'verified_files': len(entries), 'restored_files': restored}))


if __name__ == '__main__':
    main()
