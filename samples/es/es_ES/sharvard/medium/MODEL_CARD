# Model card for sharvard (medium)

* Language: es_ES (Spanish, Spain)
* Speakers: 2
* Quality: medium
* Samplerate: 22,050Hz

## Dataset

* URL: https://datashare.ed.ac.uk/handle/10283/574
* License: http://creativecommons.org/licenses/by/3.0/
* Paper: https://www.tandfonline.com/doi/abs/10.3109/14992027.2014.907507

700 sentences, each read by a male (speaker 0, "M") and a female (speaker 1, "F") talker: 1,400 utterances, 0.94 hours.
The transcripts capitalize each sentence's scoring keywords; they were lowercased and given a final period for training.

## Training

Finetuned from the U.S. English hifi_tts_92 base model (medium quality; the voice of Cori Samuel, Hi-Fi TTS reader 92), with MRD and SDP.
That base is single-speaker, so the speaker conditioning was initialized to zero and the model started out as the base for both speakers.

Requires Piper 1.5 or higher.
