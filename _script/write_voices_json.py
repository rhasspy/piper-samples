#!/usr/bin/env python3
import argparse
import hashlib
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("piper_voices", help="Directory with Piper voices")
    args = parser.parse_args()

    piper_voices_dir = Path(args.piper_voices)

    # {
    #   "<dialect>-<dataset>-<quality>": {
    #     "name": "<dataset>",
    #     "language": "<dialect>",      // lang_COUNTRY
    #     "quality": "<quality>",       // x_low, low, medium, high
    #     "num_speakers": int,
    #     "files": {
    #       "relative/path/to/file": {
    #         "size_bytes": int,
    #         "md5_digest": str,        // hex
    #       }
    #     }
    #   },
    #   ...
    # }
    voices = {}

    for onnx_path in piper_voices_dir.rglob("*.onnx"):
        config_path = onnx_path.parent / f"{onnx_path.name}.json"
        with open(config_path, "r", encoding="utf-8") as config_file:
            config = json.load(config_file)

        voice_dir = onnx_path.parent
        quality = voice_dir.name
        dataset = voice_dir.parent.name
        dialect = voice_dir.parent.parent.name
        assert "_" in dialect, f"Dialect must be lang_COUNTRY ({dialect})"
        assert (
            "-" not in f"{dialect}{dataset}{quality}"
        ), f"Dashes not allowed in {dialect}{dataset}{quality}"
        voice_key = f"{dialect}-{dataset}-{quality}"

        config_path = voice_dir / f"{onnx_path.name}.json"
        assert config_path.exists(), f"Missing {config_path}"

        model_card_path = voice_dir / "MODEL_CARD"
        assert model_card_path.exists(), f"Missing {model_card_path}"

        voices[voice_key] = {
            "name": dataset,
            "language": dialect,
            "quality": quality,
            "num_speakers": config["num_speakers"],
            "speaker_id_map": config.get("speaker_id_map", {}),
            "files": {
                file_path.name: {
                    "size_bytes": file_path.stat().st_size,
                    "md5_digest": get_file_hash(file_path),
                }
                for file_path in (
                    onnx_path,
                    config_path,
                    model_card_path,
                )
            },
        }

    json.dump(voices, sys.stdout, indent=4, ensure_ascii=False)


def get_file_hash(path, bytes_per_chunk: int = 8192) -> str:
    """Hash a file in chunks using md5."""
    path_hash = hashlib.md5()
    with open(path, "rb") as path_file:
        chunk = path_file.read(bytes_per_chunk)
        while chunk:
            path_hash.update(chunk)
            chunk = path_file.read(bytes_per_chunk)

    return path_hash.hexdigest()


if __name__ == "__main__":
    main()
