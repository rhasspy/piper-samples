/* Mini Piper implementation in Javascript. */

import EspeakModule from "./espeakng.worker.js";

const AUDIO_OUTPUT_SYNCHRONOUS = 2;
const espeakCHARS_AUTO = 0;

const CLAUSE_INTONATION_FULL_STOP = 0x00000000;
const CLAUSE_INTONATION_COMMA = 0x00001000;
const CLAUSE_INTONATION_QUESTION = 0x00002000;
const CLAUSE_INTONATION_EXCLAMATION = 0x00003000;

const CLAUSE_TYPE_CLAUSE = 0x00040000;
const CLAUSE_TYPE_SENTENCE = 0x00080000;

const CLAUSE_PERIOD = 40 | CLAUSE_INTONATION_FULL_STOP | CLAUSE_TYPE_SENTENCE;
const CLAUSE_COMMA = 20 | CLAUSE_INTONATION_COMMA | CLAUSE_TYPE_CLAUSE;
const CLAUSE_QUESTION = 40 | CLAUSE_INTONATION_QUESTION | CLAUSE_TYPE_SENTENCE;
const CLAUSE_EXCLAMATION =
  45 | CLAUSE_INTONATION_EXCLAMATION | CLAUSE_TYPE_SENTENCE;
const CLAUSE_COLON = 30 | CLAUSE_INTONATION_FULL_STOP | CLAUSE_TYPE_CLAUSE;
const CLAUSE_SEMICOLON = 30 | CLAUSE_INTONATION_COMMA | CLAUSE_TYPE_CLAUSE;

const BOS = "^";
const EOS = "$";
const PAD = "_";

let espeakInstance = null;
let espeakInitialized = false;
let voiceModel = null;
let voiceConfig = null;

async function setVoice(voiceModelUrl, voiceConfigUrl = undefined) {
  voiceConfigUrl = voiceConfigUrl ?? `${voiceModelUrl}.json`;

  const response = await fetch(voiceConfigUrl);
  if (!response.ok) {
    throw new Error(`Error loading voice configuration: {voiceConfigUrl}`);
  }
  voiceConfig = await response.json();

  if (voiceConfig.phoneme_type == "espeak") {
    if (!espeakInstance) {
      espeakInstance = await EspeakModule();
      espeakInstance._espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, 0, 0);
    }
  }

  voiceModel = await ort.InferenceSession.create(voiceModelUrl);
}

async function textToWavAudio(
  text,
  speakerId = undefined,
  noiseScale = undefined,
  lengthScale = undefined,
  noiseWScale = undefined,
) {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }

  const sampleRate = voiceConfig.audio.sample_rate;
  const float32Audio = await textToFloat32Audio(
    text,
    speakerId,
    noiseScale,
    lengthScale,
    noiseWScale,
  );

  return float32ToWavBlob(float32Audio, sampleRate);
}

async function textToFloat32Audio(
  text,
  speakerId = undefined,
  lengthScale = undefined,
  noiseScale = undefined,
  noiseWScale = undefined,
) {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }

  lengthScale = lengthScale ?? voiceConfig.inference.length_scale ?? 1.0;
  noiseScale = noiseScale ?? voiceConfig.inference.noise_scale ?? 0.667;
  noiseWScale = noiseWScale ?? voiceConfig.inference.noise_w ?? 0.8;

  if (voiceConfig.num_speakers > 1) {
    speakerId = speakerId ?? 0; // first speaker
  }

  const textPhonemes = textToPhonemes(text);
  const phonemeIds = phonemesToIds(voiceConfig.phoneme_id_map, textPhonemes);

  // Run onnx model
  const phonemeIdsTensor = new ort.Tensor(
    "int64",
    new BigInt64Array(phonemeIds.map((x) => BigInt(x))),
    [1, phonemeIds.length],
  );
  const phonemeLengthsTensor = new ort.Tensor(
    "int64",
    BigInt64Array.from([BigInt(phonemeIds.length)]),
    [1],
  );
  const scalesTensor = new ort.Tensor(
    "float32",
    Float32Array.from([noiseScale, lengthScale, noiseWScale]),
    [3],
  );

  let feeds = {
    input: phonemeIdsTensor,
    input_lengths: phonemeLengthsTensor,
    scales: scalesTensor,
  };

  if (voiceConfig.num_speakers > 1) {
    // Multi-speaker
    feeds["sid"] = new ort.Tensor(
      "int64",
      BigInt64Array.from([BigInt(speakerId)]),
    );
  }

  const results = await voiceModel.run(feeds);
  const float32Audio = results.output.cpuData;

  return float32Audio;
}

function textToPhonemes(text) {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }

  if (voiceConfig.phoneme_type == "text") {
    // Text phonemes
    return [Array.from(text.normalize("NFD"))];
  }

  if (!espeakInstance) {
    throw new Error("espeak-ng is not initialized");
  }

  const voice = voiceConfig.espeak.voice;

  // Set voice
  const voicePtr = espeakInstance._malloc(
    espeakInstance.lengthBytesUTF8(voice) + 1,
  );
  espeakInstance.stringToUTF8(
    voice,
    voicePtr,
    espeakInstance.lengthBytesUTF8(voice) + 1,
  );
  espeakInstance._espeak_SetVoiceByName(voicePtr);
  espeakInstance._free(voicePtr);

  // Prepare text
  const textPtr = espeakInstance._malloc(
    espeakInstance.lengthBytesUTF8(text) + 1,
  );
  espeakInstance.stringToUTF8(
    text,
    textPtr,
    espeakInstance.lengthBytesUTF8(text) + 1,
  );

  const textPtrPtr = espeakInstance._malloc(4);
  espeakInstance.setValue(textPtrPtr, textPtr, "*");

  // End of clause and sentences
  const terminatorPtr = espeakInstance._malloc(4);

  // Phoneme lists for each sentence
  const textPhonemes = [];

  // Phoneme list for current sentence
  let sentencePhonemes = [];

  while (true) {
    const phonemesPtr = espeakInstance._espeak_TextToPhonemesWithTerminator(
      textPtrPtr,
      espeakCHARS_AUTO,
      /* IPA */ 0x02,
      terminatorPtr,
    );
    const clausePhonemes = espeakInstance.UTF8ToString(phonemesPtr);
    sentencePhonemes.push(clausePhonemes);

    const terminator = espeakInstance.getValue(terminatorPtr, "i32");
    const punctuation = terminator & 0x000fffff;

    // Add punctuation phonemes
    if (punctuation === CLAUSE_PERIOD) {
      sentencePhonemes.push(".");
    } else if (punctuation === CLAUSE_QUESTION) {
      sentencePhonemes.push("?");
    } else if (punctuation === CLAUSE_EXCLAMATION) {
      sentencePhonemes.push("!");
    } else if (punctuation === CLAUSE_COMMA) {
      sentencePhonemes.push(", ");
    } else if (punctuation === CLAUSE_COLON) {
      sentencePhonemes.push(": ");
    } else if (punctuation === CLAUSE_SEMICOLON) {
      sentencePhonemes.push("; ");
    }

    if ((terminator & CLAUSE_TYPE_SENTENCE) === CLAUSE_TYPE_SENTENCE) {
      // End of sentence
      textPhonemes.push(sentencePhonemes);
      sentencePhonemes = [];
    }

    const nextTextPtr = espeakInstance.getValue(textPtrPtr, "*");
    if (nextTextPtr === 0) {
      break; // All text processed
    }

    // Advance text pointer
    espeakInstance.setValue(textPtrPtr, nextTextPtr, "*");
  }

  // Clean up
  espeakInstance._free(textPtr);
  espeakInstance._free(textPtrPtr);
  espeakInstance._free(terminatorPtr);

  // Add lingering phonemes
  if (sentencePhonemes.length > 0) {
    textPhonemes.push(sentencePhonemes);
    sentencePhonemes = [];
  }

  // Prepare phonemes for Piper
  for (let i = 0; i < textPhonemes.length; i++) {
    textPhonemes[i] = Array.from(textPhonemes[i].join("").normalize("NFD"));
  }

  return textPhonemes;
}

function phonemesToIds(idMap, textPhonemes) {
  let phonemeIds = [];

  for (let sentencePhonemes of textPhonemes) {
    phonemeIds.push(idMap[BOS]);
    phonemeIds.push(idMap[PAD]);

    for (let phoneme of sentencePhonemes) {
      if (!(phoneme in idMap)) {
        continue;
      }

      phonemeIds.push(idMap[phoneme]);
      phonemeIds.push(idMap[PAD]);
    }

    phonemeIds.push(idMap[EOS]);
  }

  return phonemeIds;
}

function float32ToWavBlob(floatArray, sampleRate) {
  const int16 = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i++) {
    int16[i] = Math.max(-1, Math.min(1, floatArray[i])) * 32767;
  }

  const buffer = new ArrayBuffer(44 + int16.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + int16.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, int16.length * 2, true);

  for (let i = 0; i < int16.length; i++) {
    view.setInt16(44 + i * 2, int16[i], true);
  }

  return new Blob([view], { type: "audio/wav" });
}

export { setVoice, textToWavAudio, textToFloat32Audio };
