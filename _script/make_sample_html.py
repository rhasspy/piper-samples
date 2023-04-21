#!/usr/bin/env python3
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

from markdown import markdown

_DIR = Path(__file__).parent


def main():
    with tempfile.NamedTemporaryFile(mode="w+") as output_file, open(
        _DIR.parent / "index.html.template", "r"
    ) as input_file:
        for line in input_file:
            if line.strip() == "{{ OUTPUT }}":
                write_output(output_file)
            else:
                output_file.write(line)

        output_file.seek(0)
        shutil.copy(output_file.name, _DIR.parent / "index.html")


def write_output(f):
    last_language = None
    row_alt = False

    for model in sorted(_DIR.parent.rglob("*.onnx")):
        model_dir = model.parent
        model_name = model.stem
        samples_dir = _DIR.parent / "samples" / model_name
        if not samples_dir.is_dir():
            continue

        speaker_dirs = sorted(
            (d for d in samples_dir.iterdir() if d.name.startswith("speaker_")),
            key=lambda d: int(d.name.split("_")[-1]),
        )
        if not speaker_dirs:
            continue

        if not (model_dir / "MODEL_CARD").exists():
            print(model_name)
            continue

        with open(model_dir / "MODEL_CARD", "r", encoding="utf-8") as model_card:
            model_card_html = markdown(model_card.read())

        print(model_dir)
        quality = model_dir.name
        language = model_dir.parent.parent.name
        classes = ["alt"] if row_alt else []

        if language != last_language:
            last_language = language
            classes.append("switch")

        class_str = " ".join(classes)
        print(f'<tr id="{model_name}"', f'class="{class_str}">', file=f)

        print(f'<dialog id="dialog-{model_name}"><form>', file=f)
        print(model_card_html, file=f)
        print(
            '<div><button value="cancel" formmethod="dialog">Close</button></div>',
            file=f,
        )
        print("</form></dialog>", file=f)

        print("<td>", language, "</td>", file=f)
        print(
            "<td>",
            f'<a title="Download {model_name}" href="https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-{model_name}.tar.gz">{model_name}</a>',
            "</td>",
            file=f,
        )
        print(
            "<td>",
            f'<a href="javascript:q(\'#dialog-{model_name}\').showModal()">View</a>',
            "</td>",
            file=f,
        )
        print("<td>", quality, "</td>", file=f)

        print(
            "<td>",
            f'<audio id="audio-{model_name}" preload="none" controls src="samples/{model_name}/{speaker_dirs[0].name}/sample.mp3"></audio>',
            "<details><summary>sample text</summary><p>",
            (speaker_dirs[0] / "sample.txt").read_text(encoding="utf-8"),
            "</p></details>",
            "</td>",
            file=f,
        )

        if len(speaker_dirs) > 1:
            print(
                f'<td><select id="speaker-{model_name}" onchange="setAudio(\'{model_name}\')">',
                file=f,
            )
            for i, speaker_dir in enumerate(speaker_dirs):
                print(
                    f'<option value="{speaker_dir.name}">',
                    speaker_dir.name.split("_")[-1],
                    "</option>",
                    file=f,
                )
            print(f"</select> ({len(speaker_dirs)})</td>", file=f)
        else:
            print("<td></td>", file=f)

        print("</tr>", file=f)
        row_alt = not row_alt


if __name__ == "__main__":
    main()
