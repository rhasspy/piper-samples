---
language:
- ku
license: cc-by-nc-4.0
tags:
- text-to-speech
- tts
- piper
- kurdish
- kurmanji
- vits
datasets:
- berfin_renas
metrics:
- wer
base_model: rhasspy/piper-voices
pipeline_tag: text-to-speech
---

# Model Card for ku-berfin_renas-medium

A multi-speaker Kurmanji Kurdish (Kurmancî) text-to-speech model trained
with the [Piper TTS](https://github.com/OHF-Voice/piper1) framework.
Supports two speakers — **Berfin** (speaker 0) and **Renas** (speaker 1) —
at medium quality and 22,050 Hz sample rate.

## Model Details

### Model Description

- **Developed by:** rojanu
- **Model type:** VITS (Variational Inference with adversarial learning for
  end-to-end Text-to-Speech)
- **Language(s):** Kurmanji Kurdish (`ku`)
- **License:** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — free for non-commercial use with attribution; commercial use restricted due to [Blizzard 2013 base model](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html)
- **Finetuned from model:** `en_US-lessac-medium` (Piper English vocoder
  warm-start)

### Model Sources

- **Repository:** [rojanu/piper-ku-berfin-renas-medium](https://huggingface.co/rojanu/piper-ku-berfin-renas-medium)
- **Framework:** [OHF-Voice/piper1](https://github.com/OHF-Voice/piper1)

## Speakers

| Speaker ID | Name   |
|------------|--------|
| 0          | Berfin |
| 1          | Renas  |

## Uses

### Direct Use

Offline, on-device Kurmanji Kurdish speech synthesis. Designed for:

- Screen readers (e.g. NVDA with the [piper-nvda addon](https://github.com/mzanm/piper-nvda))
- Assistive technology
- Voice interfaces for Kurdish-language applications

### Out-of-Scope Use

- Languages other than Kurmanji Kurdish
- High-fidelity / broadcast-quality synthesis (this is a medium-quality model)

## How to Get Started with the Model

### With Piper CLI

```bash
echo "Silav û rêz ji hemûyan re." | piper \
  --model ku-berfin_renas-medium.onnx \
  --speaker 0 \
  --output_file output.wav
```

### With NVDA

Install the [piper-nvda addon](https://github.com/mzanm/piper-nvda) and use
the direct download URL:

```
https://huggingface.co/rojanu/piper-ku-berfin-renas-medium/resolve/main/ku-berfin_renas-medium.tar.gz
```

## Training Details

### Training Data

A private dataset of two Kurmanji Kurdish speakers (**Berfin** and **Renas**),
approximately 2.72 hours total (1.32h Berfin, 1.40h Renas), recorded at
22,050 Hz.

| Speaker | Files | Duration  |
|---------|-------|-----------|
| Berfin  | 1,022 | 1.32 hours |
| Renas   | 1,024 | 1.40 hours |
| **Total** | **2,046** | **2.72 hours** |

### Training Procedure

#### Preprocessing

- Audio normalised to 22,050 Hz mono WAV
- Text phonemized via `espeak-ng` with voice `ku`
- Average utterance duration: ~4.79 seconds

#### Training Hyperparameters

- **Training regime:** fp32
- **Framework:** Piper / PyTorch Lightning
- **Base checkpoint:** `en_US-lessac-medium` (vocoder warm-start)
- **Batch size:** 32
- **Max epochs:** 929 (training stopped; best validation at ~epoch 72)
- **Hardware:** AMD ROCm GPU
- **Validation split:** 5%

## Evaluation

### Results

The model shows signs of overfitting due to the small dataset (~2.7h total).
Best validation loss was achieved at approximately epoch 72. Audio quality is
intelligible but benefits from additional training data.

**Known limitations:**
- Dataset too small for high-quality multi-speaker TTS (recommend ≥ 3h per speaker)
- Overfitting observed after epoch ~72

## Technical Specifications

### Model Architecture

- **Architecture:** VITS medium
- **Sample rate:** 22,050 Hz
- **Phoneme type:** espeak (`ku`)
- **Number of speakers:** 2
- **Model size:** ~77 MB (ONNX)

## Model Card Authors

rojanu
