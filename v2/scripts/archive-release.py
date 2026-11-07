"""Package a V2 candidate with Linux permissions, including an executable API."""

import argparse
from pathlib import Path
import tarfile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    archive = args.archive.resolve()
    if not source.is_dir() or archive.parent != source.parent:
        parser.error("Archive must be a sibling of the release directory.")
    if archive.name != source.name + ".tar.gz":
        parser.error("Archive name must match the release directory.")
    entries = sorted(source.rglob("*"))
    if any(entry.is_symlink() for entry in entries):
        parser.error("Release entries must not be symbolic links.")
    with tarfile.open(archive, "x:gz", format=tarfile.PAX_FORMAT) as bundle:
        for entry in entries:
            relative = entry.relative_to(source).as_posix()
            info = bundle.gettarinfo(str(entry), arcname=relative)
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            info.mode = 0o755 if entry.is_dir() or relative == "tiantai-v2" else 0o644
            if entry.is_file():
                with entry.open("rb") as content:
                    bundle.addfile(info, content)
            else:
                bundle.addfile(info)


if __name__ == "__main__":
    main()
