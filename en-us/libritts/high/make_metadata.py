#!/usr/bin/env python3
import csv
import re
import sys
from pathlib import Path

_DIR = Path(__file__).parent


def main():
    audios = _DIR / "train-clean-360"

    with open("metadata.csv", "w", encoding="utf-8") as metadata_out:
        writer = csv.writer(metadata_out, delimiter="|")
        for speaker_dir in audios.iterdir():
            if not speaker_dir.is_dir():
                continue

            speaker_id = speaker_dir.name
            for chapter_dir in speaker_dir.iterdir():
                if not chapter_dir.is_dir():
                    continue

                chapter_id = chapter_dir.name
                transcript_path = chapter_dir / f"{speaker_id}_{chapter_id}.trans.tsv"
                with open(transcript_path, "r", encoding="utf-8") as transcript_file:
                    transcript_reader = csv.reader(transcript_file, delimiter="\t")
                    for row in transcript_reader:
                        utt_id, text = row[0].strip(), row[-1].strip()
                        audio = chapter_dir / f"{utt_id}.wav"
                        if not audio.exists():
                            print("Missing", audio, file=sys.stderr)
                            continue

                        writer.writerow((audio.relative_to(_DIR), speaker_id, text))


if __name__ == "__main__":
    main()
