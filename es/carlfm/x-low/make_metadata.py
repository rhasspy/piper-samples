#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

_DIR = Path(__file__).parent

def main():
    audios = Path("wav")

    with open("metadata.csv", "w", encoding="utf-8") as metadata_out:
        writer = csv.writer(metadata_out, delimiter="|")
        with open(_DIR / "transcript.txt", "r", encoding="utf-8") as metadata_in:
            reader = csv.reader(metadata_in, delimiter="|")
            for row in reader:
                audio = audios / Path(row[0]).name
                if not audio.exists():
                    print("Missing", audio, file=sys.stderr)
                    continue

                text = row[1]
                writer.writerow((audio, text))


if __name__ == "__main__":
    main()
