#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

_DIR = Path(__file__).parent


def main():
    datasets = [_DIR / "ISSAI_KazakhTTS", _DIR / "ISSAI_KazakhTTS2"]

    with open("metadata.csv", "w", encoding="utf-8") as metadata:
        writer = csv.writer(metadata, delimiter="|")

        for dataset_dir in datasets:
            dataset_name = dataset_dir.name

            for speaker_dir in dataset_dir.iterdir():
                if not speaker_dir.is_dir():
                    continue

                speaker = f"{dataset_name}_{speaker_dir.name}"
                transcripts = speaker_dir / "Transcripts"

                audios = speaker_dir / "Audios"
                if not audios.is_dir():
                    audios = speaker_dir / "Audio"

                for transcript in transcripts.glob("*.txt"):
                    audio = audios / f"{transcript.stem}.wav"
                    if not audio.exists():
                        print("Missing", audio, file=sys.stderr)

                    audio = audio.relative_to(_DIR)
                    text = transcript.read_text(encoding="utf-8").strip()
                    writer.writerow((audio, speaker, text))


if __name__ == "__main__":
    main()
