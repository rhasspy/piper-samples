#!/usr/bin/env python3
import csv
import sys
from pathlib import Path


def main():
    transcripts = Path("Transcripts")
    audios = Path("Audios")

    with open("metadata.csv", "w", encoding="utf-8") as metadata:
        writer = csv.writer(metadata, delimiter="|")
        for transcript in transcripts.glob("*.txt"):
            audio = audios / f"{transcript.stem}.wav"
            if not audio.exists():
                print("Missing %s", audio, file=sys.stderr)

            text = transcript.read_text(encoding="utf-8").strip()
            writer.writerow((audio, text))


if __name__ == "__main__":
    main()
