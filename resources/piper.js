/* Mini Piper implementation in Javascript. */

import EspeakModule from "./espeakng.worker.js";

// Run onnxruntime inference in a Web Worker so it doesn't block the UI thread.
ort.env.wasm.proxy = true;

// Use multiple threads for inference. This only takes effect when the page is
// cross-origin isolated (COOP + COEP headers -> SharedArrayBuffer available);
// otherwise onnxruntime-web silently falls back to a single thread. See serve.py.
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

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

function getSampleRate() {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }
  return voiceConfig.audio.sample_rate;
}

// Resolve scale arguments, falling back to the voice config defaults.
function resolveScales(lengthScale, noiseScale, noiseWScale) {
  return {
    lengthScale: lengthScale ?? voiceConfig.inference.length_scale ?? 1.0,
    noiseScale: noiseScale ?? voiceConfig.inference.noise_scale ?? 0.667,
    noiseWScale: noiseWScale ?? voiceConfig.inference.noise_w ?? 0.8,
  };
}

// Run the ONNX model on a single utterance's phoneme ids, returning Float32 PCM.
async function synthesizeIds(
  phonemeIds,
  speakerId,
  lengthScale,
  noiseScale,
  noiseWScale,
) {
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
      BigInt64Array.from([BigInt(speakerId ?? 0)]),
    );
  }

  const results = await voiceModel.run(feeds);
  return results.output.cpuData;
}

// Currently unused by the demo (kept for the public API; the demo streams via
// textToAudioSentences instead).
async function textToWavAudio(
  text,
  speakerId = undefined,
  lengthScale = undefined,
  noiseScale = undefined,
  noiseWScale = undefined,
) {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }

  const float32Audio = await textToFloat32Audio(
    text,
    speakerId,
    lengthScale,
    noiseScale,
    noiseWScale,
  );

  return float32ToWavBlob(float32Audio, getSampleRate());
}

// Currently unused by the demo (kept for the public API; the demo streams via
// textToAudioSentences instead).
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

  const scales = resolveScales(lengthScale, noiseScale, noiseWScale);

  const textPhonemes = textToPhonemes(text).map((segment) => segment.phonemes);
  const phonemeIds = phonemesToIds(voiceConfig.phoneme_id_map, textPhonemes);

  return synthesizeIds(
    phonemeIds,
    speakerId,
    scales.lengthScale,
    scales.noiseScale,
    scales.noiseWScale,
  );
}

// Synthesize a sentence at a time, yielding Float32 PCM for each as soon as it is
// ready. Lets the caller start playing early instead of waiting for the whole text.
async function* textToAudioSentences(
  text,
  speakerId = undefined,
  lengthScale = undefined,
  noiseScale = undefined,
  noiseWScale = undefined,
) {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }

  const scales = resolveScales(lengthScale, noiseScale, noiseWScale);

  // textToPhonemes already segments into per-sentence { phonemes, start, end }.
  const sentences = textToPhonemes(text);

  for (const sentence of sentences) {
    const phonemeIds = phonemesToIds(voiceConfig.phoneme_id_map, [sentence.phonemes]);
    const audio = await synthesizeIds(
      phonemeIds,
      speakerId,
      scales.lengthScale,
      scales.noiseScale,
      scales.noiseWScale,
    );
    // start/end are character indices into `text`, so the caller can highlight the slice
    // this audio was synthesized from.
    yield { audio, start: sentence.start, end: sentence.end };
  }
}

function utf8ByteLength(codePoint) {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

// espeak reports clause boundaries as UTF-8 byte offsets, but the displayed text is
// indexed in JS string units. Those offsets only ever move forward, so we translate them
// with a single forward-walking cursor (no lookup table): each call advances through the
// string until it reaches the requested byte offset and returns the character index there.
function makeByteToCharCursor(text) {
  let byte = 0;
  let char = 0; // JS string index == character index (surrogate pairs count as 2).
  return (targetByte) => {
    while (byte < targetByte && char < text.length) {
      const codePoint = text.codePointAt(char);
      byte += utf8ByteLength(codePoint);
      // Advance one whole character: astral code points are a surrogate pair, so they
      // occupy two UTF-16 string indices; everything in the BMP occupies one.
      char += codePoint > 0xffff ? 2 : 1;
    }
    return char;
  };
}

// Segment text into per-sentence units. Returns an array of
// { phonemes, start, end } where start/end are character indices into the original
// `text`, identifying the slice each sentence was synthesized from.
function textToPhonemes(text) {
  if (!voiceConfig) {
    throw new Error("Voice is not set");
  }

  if (voiceConfig.phoneme_type == "text") {
    // Text phonemes: the whole text is a single sentence.
    return [{ phonemes: Array.from(text.normalize("NFD")), start: 0, end: text.length }];
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

  // Translates espeak's UTF-8 byte offsets to character indices into the original `text`
  // so they can slice/highlight it directly.
  const toChar = makeByteToCharCursor(text);

  // Sentence segments, each { phonemes, start, end } in character indices.
  const textPhonemes = [];

  // Phoneme list for current sentence
  let sentencePhonemes = [];

  // Character offsets: where the next clause begins, and where the current sentence
  // (accumulation of clauses) began.
  let cursorChar = 0;
  let sentenceStartChar = 0;

  while (true) {
    // A new sentence is starting if we haven't accumulated any clauses for it yet.
    if (sentencePhonemes.length === 0) {
      sentenceStartChar = cursorChar;
    }

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

    // Where espeak will resume. 0 means the input is exhausted (this clause runs to the
    // end of the text). Otherwise espeak reads one lookahead character past the clause
    // boundary, so its resume offset overshoots the true boundary by exactly one
    // character — subtract it back off (in character space) to land on the start of the
    // next clause.
    const nextTextPtr = espeakInstance.getValue(textPtrPtr, "*");
    const endChar =
      nextTextPtr === 0
        ? text.length
        : Math.max(cursorChar, toChar(nextTextPtr - textPtr) - 1);
    cursorChar = endChar;

    if ((terminator & CLAUSE_TYPE_SENTENCE) === CLAUSE_TYPE_SENTENCE) {
      // End of sentence
      textPhonemes.push({
        phonemes: sentencePhonemes,
        start: sentenceStartChar,
        end: endChar,
      });
      sentencePhonemes = [];
    }

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
    textPhonemes.push({
      phonemes: sentencePhonemes,
      start: sentenceStartChar,
      end: text.length,
    });
    sentencePhonemes = [];
  }

  // Prepare phonemes for Piper; start/end are already character indices into `text`.
  return textPhonemes.map((segment) => ({
    phonemes: Array.from(segment.phonemes.join("").normalize("NFD")),
    start: segment.start,
    end: segment.end,
  }));
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

export {
  setVoice,
  textToWavAudio,
  textToFloat32Audio,
  textToAudioSentences,
  float32ToWavBlob,
  getSampleRate,
};
