---
language: ur
tags:
  - piper
  - tts
  - urdu
  - text-to-speech
  - accessibility
license: mit
---

# Urdu Male Voice — Piper TTS (medium)

Urdu text-to-speech voice for [Piper](https://github.com/OHF-Voice/piper1-gpl).

## Overview

- **Language:** Urdu (`ur_PK`)
- **Voice:** Male
- **Quality:** Medium
- **Phonemizer:** eSpeak (`ur`)
- **Sample rate:** 22050 Hz

## Listen

| Text | Audio |
|------|-------|
| قوس قزح، جسے قوس قزح یا رنگوں کی قوس قزح بھی کہا جاتا ہے، ایک قدرتی طبعی رجحان ہے جو بارش کے قطرے کے ذریعے سورج کی روشنی کے اضطراب اور پھیلاؤ کے نتیجے میں ہوتا ہے۔ | <audio controls src="https://huggingface.co/IhorShevchuk/piper-voice-ur-fasih/resolve/main/samples/sample.wav"></audio>|
| یہ ایک سادہ جملہ ہے۔ | <audio controls src="https://huggingface.co/IhorShevchuk/piper-voice-ur-fasih/resolve/main/samples/sample_1.wav"></audio>|
| کیا آپ ٹھیک ہیں؟ | <audio controls src="https://huggingface.co/IhorShevchuk/piper-voice-ur-fasih/resolve/main/samples/sample_2.wav"></audio>|
| میرے پاس 3 کتابیں ہیں۔ | <audio controls src="https://huggingface.co/IhorShevchuk/piper-voice-ur-fasih/resolve/main/samples/sample_3.wav"></audio>|
| میں نے ایک نیا لیپ ٹاپ خریدا۔| <audio controls src="https://huggingface.co/IhorShevchuk/piper-voice-ur-fasih/resolve/main/samples/sample_4.wav"></audio>|
| آج موسم بہت اچھا ہے اور ہم باہر جا سکتے ہیں۔| <audio controls src="https://huggingface.co/IhorShevchuk/piper-voice-ur-fasih/resolve/main/samples/sample_5.wav"></audio>|

## Optimized Inference Parameters

| Parameter     | Value | Description                         |
|---------------|-------|-------------------------------------|
| noise_scale   | 0.667 | Expressiveness / variation          |
| noise_w       | 0.8   | Phoneme duration variation          |
| length_scale  | 1.0   | Speaking speed                      |

## Usage

```bash
echo 'یہ ایک سادہ جملہ ہے۔' | piper \
  --model ur_PK-male-medium.onnx \
  --config ur_PK-male-medium.onnx.json \
  --output_file output.wav
````

## Training Details

* **Base model:** Hindi (`hi_IN`) medium (Rohan) checkpoint
* **Base checkpoint:** `epoch=3190-step=309852.ckpt` [https://huggingface.co/datasets/rhasspy/piper-checkpoints/tree/main/hi/hi_IN/rohan/medium](https://huggingface.co/datasets/rhasspy/piper-checkpoints/tree/main/hi/hi_IN/rohan/medium)
* **Dataset:** [UAT (Urdu)](https://huggingface.co/datasets/mahwizzzz/UAT)
* **Training checkpoint:** `epoch=3206-step=383452.ckpt`
* **Hardware:** Apple M4 Mac mini

## Notes

* Trained on Urdu dataset with eSpeak phonemization.
* Based on Hindi model initialization, adapted for Urdu speech.
* Quality may vary on mixed-language input (Urdu + English).

## Links

* [Piper](https://github.com/OHF-Voice/piper1-gpl) — Neural TTS engine

## License

MIT
