#!/usr/bin/env python3
import argparse
import hashlib
import json
import sys
import re
import tarfile
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Dict, Union

_DIR = Path(__file__).parent


def get_file_hash(path: Union[str, Path], bytes_per_chunk: int = 8192) -> str:
    """Hash a file in chunks using md5."""
    path_hash = hashlib.md5()
    with open(path, "rb") as path_file:
        chunk = path_file.read(bytes_per_chunk)
        while chunk:
            path_hash.update(chunk)
            chunk = path_file.read(bytes_per_chunk)

    return path_hash.hexdigest()


def hash_voice(voice_path: Union[str, Path]) -> Dict[str, Dict[str, str]]:
    voice_path = Path(voice_path)
    voice_name = re.sub(
        r"\.tar\.gz$",
        "",
        re.sub(
            "^voice-",
            "",
            voice_path.name,
        ),
    )

    file_hashes = {}
    with tempfile.TemporaryDirectory() as temp_dir:
        with tarfile.open(mode="r", name=voice_path) as tar_gz:
            tar_gz.extractall(temp_dir)

        base_dir = Path(temp_dir)
        for file_path in base_dir.rglob("*"):
            hash_key = str(file_path.relative_to(base_dir))
            if hash_key in {"MODEL_CARD"}:
                continue

            file_hashes[hash_key] = get_file_hash(file_path)

    return {voice_name: file_hashes}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist_dir", default=_DIR.parent / "_dist")
    args = parser.parse_args()

    dist_dir = Path(args.dist_dir)
    voice_hashes = {}

    with ProcessPoolExecutor() as executor:
        for voice_hash in executor.map(hash_voice, dist_dir.glob("*.tar.gz")):
            voice_hashes.update(voice_hash)

    json.dump(
        {key: voice_hashes[key] for key in sorted(voice_hashes)},
        sys.stdout,
    )


if __name__ == "__main__":
    main()
