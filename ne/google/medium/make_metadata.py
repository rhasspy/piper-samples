#!/usr/bin/env python3
import csv
from pathlib import Path

_DIR = Path(__file__).parent

with open("metadata.csv", "w", encoding="utf-8") as output_file:
    writer = csv.writer(output_file, delimiter="|")

    for tsv_path in _DIR.rglob("line_index.tsv"):
        with open(tsv_path, "r", encoding="utf-8") as input_file:
            reader = csv.reader(input_file, delimiter="\t")

            for row in reader:
                utt_id, text = row[0], row[-1]
                speaker = utt_id.split("_", maxsplit=2)[1]
                wav_dir = (tsv_path.parent / "wavs").relative_to(_DIR)
                wav_path = str(wav_dir / utt_id)

                writer.writerow((wav_path, speaker, text))
