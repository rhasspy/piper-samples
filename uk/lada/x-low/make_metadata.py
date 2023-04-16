#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path


def main():
    audios = Path("accept")

    with open("metadata.jsonl", "r", encoding="utf-8") as metadata_in, open(
        "metadata.csv", "w", encoding="utf-8"
    ) as metadata_out:
        writer = csv.writer(metadata_out, delimiter="|")
        for line in metadata_in:
            utt = json.loads(line)
            audio = audios / (Path(utt["file"]).stem + ".wav")
            if not audio.exists():
                continue

            text = utt["orig_text"]
            writer.writerow((audio, text))


if __name__ == "__main__":
    main()
