#!/usr/bin/env python3
import csv
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

_DIR = Path(__file__).parent


def main():
    writer = csv.writer(sys.stdout, delimiter="|")

    wav_dir = _DIR / "wav"
    wav_dir.mkdir(parents=True, exist_ok=True)

    pcm_dir = _DIR / "all_rec"
    with open(
        _DIR / "rec_scripts" / "baseform_data" / "all_script", "r", encoding="cp1252"
    ) as script_file, ThreadPoolExecutor() as executor:
        for line_idx, line in enumerate(script_file):
            line = line.strip()
            assert line, line_idx

            line_num = line_idx + 1
            utt_id = f"all_script_ca_01_{line_num:04}"
            src_audio_path = pcm_dir / f"{utt_id}.pcm"

            if not src_audio_path.is_file():
                continue

            writer.writerow((utt_id, line))

            wav_path = wav_dir / f"{utt_id}.wav"
            if wav_path.is_file():
                continue

            convert_cmd = [
                "sox",
                "-t",
                "raw",
                "-e",
                "signed-integer",
                "-r",
                "44100",
                "-c",
                "2",
                "-b",
                "16",
                "--endian",
                "big",
                str(src_audio_path),
                "-t",
                "wav",
                "-c",
                "1",
                str(wav_path),
                "remix",  # remove weird channel
                "1",
                "trim",  # get rid of initial click
                "0.1",
            ]

            executor.submit(subprocess.check_call, convert_cmd)


if __name__ == "__main__":
    main()
