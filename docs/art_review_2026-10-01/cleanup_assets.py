"""Apply the user-authorized A-F cleanup using the frozen inventory.

Archive all candidates outside the repository and verify every archived SHA-256
before removing an individual file. No recursive delete, move, or Git mutation.
Usage: python docs/art_review_2026-10-01/cleanup_assets.py --backup-only
       python docs/art_review_2026-10-01/cleanup_assets.py --execute
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
IMAGE_ROOT = (ROOT / 'legacy_vue/public/assets/images').resolve()
ARCHIVE_ROOT = ROOT.parent / 'art_archives' / ROOT.name
RESULT_PATH = OUT / 'cleanup_result.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def checked_path(record):
    target = (ROOT / record['path']).resolve()
    if not target.is_relative_to(IMAGE_ROOT) or target == IMAGE_ROOT:
        raise ValueError('Target outside image directory: ' + str(target))
    if target.suffix.lower() not in {'.png', '.webp', '.svg'}:
        raise ValueError('Unexpected extension: ' + str(target))
    if target.is_symlink():
        raise ValueError('Symlink target is not allowed: ' + str(target))
    return target


def write_result(result):
    RESULT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')


def verify_archive(archive, candidates):
    with zipfile.ZipFile(archive) as saved:
        metadata = json.loads(saved.read('cleanup_manifest.json'))
        if metadata['candidates'] != candidates:
            raise ValueError('Archive manifest does not match the approved snapshot')
        for record in candidates:
            if sha(saved.read(record['path'])) != record['sha256']:
                raise ValueError('Archive verification failed: ' + record['path'])


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--backup-only', action='store_true')
    mode.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    approval = json.loads((OUT / 'approval_manifest.json').read_text(encoding='utf-8'))
    candidates = approval['candidates']
    audit = json.loads((OUT / 'audit.json').read_text(encoding='utf-8'))
    lookup = {row['path']: row for row in audit['assets']}
    if len(candidates) != 83 or len({r['path'] for r in candidates}) != 83:
        raise ValueError('Expected the original 83 distinct A-F candidates')
    for record in candidates:
        row = lookup[record['path']]
        if record['batch'] not in 'ABCDEF' or row['master_runtime'] or row['shumei_runtime']:
            raise ValueError('Candidate is not unused in both versions: ' + record['path'])
        target = checked_path(record)
        if not target.is_file() or sha(target.read_bytes()) != record['sha256']:
            raise ValueError('Candidate missing or changed since review: ' + record['path'])
    head = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD']).decode().strip()
    if head != audit['summary']['head']:
        raise ValueError('HEAD changed since the reviewed inventory')
    authority = 'User delegated cleanup after reviewing the A-F inventory: 你自己看着整吧'
    if RESULT_PATH.exists():
        result = json.loads(RESULT_PATH.read_text(encoding='utf-8'))
        if result['status'] != 'backed_up':
            raise ValueError('An execution result already exists; do not rerun deletion')
        archive = Path(result['archive_path']).resolve()
        if not archive.is_relative_to(ARCHIVE_ROOT.resolve()):
            raise ValueError('Unexpected archive path')
        verify_archive(archive, candidates)
    else:
        ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
        archive = ARCHIVE_ROOT / '2026-10-01-shumei-cg-cleanup-14cca4d9.zip'
        if archive.exists():
            raise ValueError('Archive already exists; will not overwrite it')
        with zipfile.ZipFile(archive, mode='x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as saved:
            saved.writestr('cleanup_manifest.json', json.dumps(approval, ensure_ascii=False, indent=2))
            for record in candidates:
                saved.writestr(record['path'], checked_path(record).read_bytes())
            for name in [
                'legacy_vue/scripts/generate_assets.mjs',
                'legacy_vue/scripts/build_unified_image2_candidates.mjs',
                'legacy_vue/src/views/AchievementsView.vue',
                'docs/engineering/emotion_cg_assets.md',
            ]:
                saved.write(ROOT / name, 'supporting_files/' + name)
        verify_archive(archive, candidates)
        result = {
            'status': 'backed_up', 'authorization': authority, 'branch_head': head,
            'scope': 'current shumei checkout; master ref and its resources stay unchanged',
            'approved_batches': list('ABCDEF'), 'candidate_count': 83,
            'archive_path': str(archive.resolve()), 'archive_sha256': sha(archive.read_bytes()),
            'archive_verified': True, 'removed_files': [],
            'expected_removed_bytes': sum(r['bytes'] for r in candidates),
        }
        write_result(result)
    if args.execute:
        result['status'] = 'removing'
        write_result(result)
        try:
            for record in candidates:
                target = checked_path(record)
                if sha(target.read_bytes()) != record['sha256']:
                    raise ValueError('Candidate changed before removal: ' + record['path'])
                target.unlink()
                result['removed_files'].append(record)
                write_result(result)
            result['status'] = 'completed'
            result['removed_count'] = len(result['removed_files'])
            result['removed_bytes'] = sum(r['bytes'] for r in result['removed_files'])
        except Exception:
            result['status'] = 'partial'
            raise
        finally:
            write_result(result)
        approval.update({'status': 'executed', 'authorization': authority,
                         'approved_batches': list('ABCDEF'), 'archive_path': str(archive.resolve()),
                         'execution_record': 'cleanup_result.json'})
        approval['note'] = '用户授权自主处理后，A-F 已全部备份并从当前数媒工作区移除；KEEP/HOLD 保留。'
        (OUT / 'approval_manifest.json').write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: result[key] for key in ['status', 'candidate_count', 'archive_path', 'archive_verified']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
