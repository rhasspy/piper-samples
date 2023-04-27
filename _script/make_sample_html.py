#!/usr/bin/env python3
import shutil
import tempfile
from pathlib import Path

from markdown import markdown

_DIR = Path(__file__).parent
LANG_NAMES = {
    "af": "Afrikaans",
    "bn": ("বাংলা", "Bengali"),
    "ca": ("Català", "Catalan"),
    "da": ("Dansk", "Danish"),
    "de": ("Deutsch", "German"),
    "en-gb": "English (British)",
    "en-us": "English (U.S.)",
    "el-gr": ("Ελληνικά", "Greek"),
    "es": ("Español", "Spanish"),
    "fa": ("فارسی", "Persian"),
    "fi": ("Suomi", "Finnish"),
    "fr": ("Français", "French"),
    "gu": ("ગુજરાતી", "Gujarati"),
    "ha": "Hausa",
    "hu": ("Magyar Nyelv", "Hungarian"),
    "it": ("Italiano", "Italian"),
    "jv": ("Basa Jawa", "Javanese"),
    "kk": ("қазақша", "Kazakh"),
    "ko": ("한국어", "Korean"),
    "ne": ("नेपाली", "Nepali"),
    "no": ("Norsk", "Norwegian"),
    "nl": ("Nederlands", "Dutch"),
    "pl": ("Polski", "Polish"),
    "pt": ("Português", "Portuguese"),
    "pt-br": ("Português (Brasil)", "Portuguese (Brazilian)"),
    "ru": ("Русский", "Russian"),
    "sw": "Kiswahili",
    "te": ("తెలుగు", "Telugu"),
    "tn": "Setswana",
    "uk": ("украї́нська мо́ва", "Ukrainian"),
    "vi": ("Tiếng Việt", "Vietnamese"),
    "yo": ("Èdè Yorùbá", "Yoruba"),
    "zh-cn": ("简体中文", "Chinese"),
}


def main():
    with tempfile.NamedTemporaryFile(mode="w+") as output_file, open(
        _DIR.parent / "index.html.template",
        "r",
        encoding="utf-8",
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

    # Get list of model languages
    languages = []
    for model in sorted(_DIR.parent.rglob("*.onnx")):
        model_dir = model.parent
        language = model_dir.parent.parent.name
        if language in languages:
            continue

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
            continue

        languages.append(language)

    print('<select id="languages" onchange="jumpLanguage()">', file=f)
    print('<option value="">Jump to language</option>', file=f)
    for language in languages:
        language_name = LANG_NAMES[language]
        if isinstance(language_name, tuple):
            language_name = f"{language_name[0]} ({language_name[1]})"
        print(f'<option value="{language}">{language_name}</option>', file=f)
    print("</select>", file=f)
    print("<hr />", file=f)

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
        assert language in LANG_NAMES, f"No name for {language}"

        language_name = LANG_NAMES[language]
        if isinstance(language_name, tuple):
            language_name = f"{language_name[0]} ({language_name[1]})"

        if language != last_language:
            if last_language is not None:
                print("</table>", file=f)

            print(f'<h2 id="{language}">{language_name}</h2>', file=f)

            last_language = language
            row_alt = False

            # classes.append("switch")
            print("<table>", file=f)
            print("<thead>", file=f)
            print("<th>Voice</th>", file=f)
            print("<th>Model Card</th>", file=f)
            print('<th>Quality <a href="#quality">[?]</a></th>', file=f)
            print("<th>Sample</th>", file=f)
            print("<th>Speaker</th>", file=f)
            print("</thead>", file=f)

        classes = ["alt"] if row_alt else []
        class_str = " ".join(classes)
        print(f'<tr id="{model_name}"', f'class="{class_str}">', file=f)

        print(f'<dialog id="dialog-{model_name}"><form>', file=f)
        print(model_card_html, file=f)
        print(
            '<div><button value="cancel" formmethod="dialog">Close</button></div>',
            file=f,
        )
        print("</form></dialog>", file=f)

        # print("<td>", language_name, "</td>", file=f)
        print(
            "<td>",
            f'<a title="Download {model_name}" href="https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-{model_name}.tar.gz">{model_name}</a>',
            "</td>",
            file=f,
        )
        print(
            "<td>",
            f"<a href=\"javascript:q('#dialog-{model_name}').showModal()\">View</a>",
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

    print("</table>", file=f)


if __name__ == "__main__":
    main()
