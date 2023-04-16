#!/usr/bin/env python3
import csv
import re
import sys
from pathlib import Path

_DIR = Path(__file__).parent


def main():
    audios = _DIR / "waves"

    with open("metadata.csv", "w", encoding="utf-8") as metadata_out:
        writer = csv.writer(metadata_out, delimiter="|")
        with open("transcrips.txt", "r", encoding="utf-8") as transcripts:
            for i, line in enumerate(transcripts):
                if (i % 2) != 0:
                    continue

                audio_name, text = line.split(maxsplit=1)
                audio = audios / f"{audio_name}.wav"
                if not audio.exists():
                    print("Missing", audio, file=sys.stderr)

                text = re.sub(r"#[0-9]+", "", text).strip()
                writer.writerow((audio.relative_to(_DIR), text))


if __name__ == "__main__":
    main()
