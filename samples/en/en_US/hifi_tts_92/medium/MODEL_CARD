# Model card for hifi_tts_92 (medium)

* Language: en_US (English, United States)
* Speakers: 1
* Quality: medium
* Samplerate: 22,050Hz

## Dataset

* URL: https://www.openslr.org/109/
* License: CC BY 4.0 (Hi-Fi Multi-Speaker English TTS Dataset, NVIDIA Corporation)
* Paper: Bakhturina, Lavrukhin, Ginsburg and Zhang, "Hi-Fi Multi-Speaker English TTS Dataset", Interspeech 2021, https://arxiv.org/abs/2104.01497

The voice is Cori Samuel, reader 92 of Hi-Fi TTS. Hi-Fi TTS is built from LibriVox
public-domain audiobooks (https://librivox.org), and this model uses her recordings
from its clean subset: 27.3 hours, resampled from 44.1kHz, with adjacent segments
merged up to 12 seconds (35,146 -> 13,574 utterances). Thank you, Cori.

## Training

Trained from scratch (MRD and SDP). Base model for finetuning, replacing lessac.

Cori Samuel speaks British English, but this base was trained with U.S. English
(`en-us`) phonemes, so on its own it gives American phoneme symbols British vowels
(BATH words such as "after" and "ask" with a back "ah"). Finetuning removes this:
an en_US voice finetuned from it on 0.9 hours matched its speaker's American vowels.
For a British voice of the same reader, see en_GB-cori.

English diphthongs are merged into single ids (`--data.vowel_clusters '[["a","ɪ"],["a","ʊ"],["e","ɪ"],["o","ʊ"],["ɔ","ɪ"]]'`); finetunes must use the same clusters.

Requires Piper 1.5 or higher.
