#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

_DIR = Path(__file__).parent

def main():
    with open("metadata.csv", "w", encoding="utf-8") as metadata_out:
        writer = csv.writer(metadata_out, delimiter="|")
        for book_dir in _DIR.iterdir():
            if not book_dir.is_dir():
                continue

            book_name = book_dir.name
            book_metadata = book_dir / "metadata.csv"
            book_audios = book_dir / "wavs"

            with open(book_metadata, "r", encoding="utf-8") as metadata_in:
                reader = csv.reader(metadata_in, delimiter="|")
                for row in reader:
                    audio_name = row[0]
                    text = row[-1]

                    audio = book_audios / f"{audio_name}.wav"
                    if not audio.exists():
                        print("Missing", audio, file=sys.stderr)

                    writer.writerow((audio.relative_to(_DIR), text))


if __name__ == "__main__":
    main()
