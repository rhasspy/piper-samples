#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

_DIR = Path(__file__).parent

def main():
    speaker = _DIR.name.split("_", maxsplit=1)[-1]
    audios = Path(f"adaptation_{speaker}_wav")

    with open("metadata.csv", "w", encoding="utf-8") as metadata:
        writer = csv.writer(metadata, delimiter="|")
        for split in ("train", "val"):
            transcripts = _DIR / f"upc_{speaker}_{split}.txt"
            with open(transcripts, "r", encoding="utf-8") as transcripts_file:
                reader = csv.reader(transcripts_file, delimiter="|")
                for row in reader:
                    audio = audios / row[0].split("/")[-1]
                    if not audio.exists():
                        print("Missing", audio, file=sys.stderr)
                        continue

                    text = row[1]
                    writer.writerow((audio, text))


if __name__ == "__main__":
    main()
