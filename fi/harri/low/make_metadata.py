#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

_DIR = Path(__file__).parent


def main():
    with open("transcript.txt", "r", encoding="utf-8") as transcripts, open(
        "metadata.csv", "w", encoding="utf-8"
    ) as metadata:
        reader = csv.reader(transcripts, delimiter="|")
        writer = csv.writer(metadata, delimiter="|")

        for row in reader:
            audio = Path(row[0].strip())
            if not audio.exists():
                print("Missing", audio, file=sys.stderr)
                continue

            text = row[2].strip()
            writer.writerow((audio, text))


if __name__ == "__main__":
    main()
