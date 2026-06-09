import {
  setVoice,
  textToAudioSentences,
  float32ToWavBlob,
  getSampleRate,
} from "./piper.js";

let voiceUrl = "";
let loadedVoiceUrl = "";
let voiceConfigUrl = "";

// Silence inserted between sentences, both for live playback scheduling and in the
// assembled WAV so replay matches the stream. Tune to taste.
const SENTENCE_GAP_SECONDS = 0.2;

// Web Audio playback state (created lazily on first user gesture, reused after).
let audioCtx = null;
// Bumped on each Speak click so an in-flight stream knows to abort.
let playbackGeneration = 0;
// Source nodes scheduled for the current playback, so we can stop them on re-click.
let activeSources = [];

function stopPlayback() {
  for (const src of activeSources) {
    try {
      src.stop();
    } catch {
      // Already stopped/ended.
    }
  }
  activeSources = [];
}

// Concatenate per-sentence Float32 chunks with SENTENCE_GAP_SECONDS of silence
// between them, matching what was played live.
function joinWithGaps(chunks, sampleRate) {
  const gapSamples = Math.round(SENTENCE_GAP_SECONDS * sampleRate);
  const total =
    chunks.reduce((n, c) => n + c.length, 0) +
    gapSamples * Math.max(0, chunks.length - 1);

  const out = new Float32Array(total);
  let offset = 0;
  chunks.forEach((chunk, i) => {
    out.set(chunk, offset);
    offset += chunk.length;
    if (i < chunks.length - 1) {
      offset += gapSamples; // leave zeros (silence)
    }
  });
  return out;
}

async function main() {
  const fileModel = document.getElementById("fileModel");
  const fileConfig = document.getElementById("fileConfig");
  const divConfig = document.getElementById("divConfig");
  const buttonSpeak = document.getElementById("buttonSpeak");
  const audioTTS = document.getElementById("audioTTS");
  const textInput = document.getElementById("textInput");
  const status = document.getElementById("status");
  const speakerSelect = document.getElementById("speaker");
  const inputLengthScale = document.getElementById("lengthScale");
  const inputNoiseScale = document.getElementById("noiseScale");
  const inputNoiseWScale = document.getElementById("noiseWScale");

  fileModel.addEventListener("change", async () => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // Reset config
    voiceConfigUrl = "";
    fileConfig.value = "";
    speakerSelect.value = "";

    voiceUrl = URL.createObjectURL(file);
    const voiceId = file.name.replace(/\.[^/.]+$/, "");
    const maybeVoiceConfigUrl = `configs/${voiceId}.onnx.json`;
    const response = await fetch(maybeVoiceConfigUrl);
    if (response.ok) {
      voiceConfigUrl = maybeVoiceConfigUrl;
      const voiceConfig = await response.json();
      updateUIForConfig(voiceConfig);
      divConfig.hidden = true;
    } else {
      divConfig.hidden = false;
      speakerSelect.hidden = true;
    }
  });

  fileConfig.addEventListener("change", async () => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const voiceConfig = JSON.parse(await file.text());
    updateUIForConfig(voiceConfig);
    voiceConfigUrl = URL.createObjectURL(file);
  });

  buttonSpeak.addEventListener("click", async () => {
    if (!voiceUrl) {
      alert("Voice model is not set");
      return;
    }

    if (!voiceConfigUrl) {
      alert("Voice config is not set");
      return;
    }

    const text = textInput.value;
    if (!text) {
      alert("No text");
      return;
    }

    if (voiceUrl != loadedVoiceUrl) {
      status.innerHTML = "Loading voice...";
      await setVoice(voiceUrl, voiceConfigUrl);
      loadedVoiceUrl = voiceUrl;
    }

    let speakerId = null;
    if (speakerSelect.selectedIndex > 0) {
      speakerId = parseInt(speakerSelect.value);
    }

    let lengthScale = parseFloat(inputLengthScale.value);
    if (isNaN(lengthScale)) {
      lengthScale = null;
    }

    let noiseScale = parseFloat(inputNoiseScale.value);
    if (isNaN(noiseScale)) {
      noiseScale = null;
    }

    let noiseWScale = parseFloat(inputNoiseWScale.value);
    if (isNaN(noiseWScale)) {
      noiseWScale = null;
    }

    // Stop any in-progress playback and mark this as the current generation.
    const generation = ++playbackGeneration;
    stopPlayback();

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    await audioCtx.resume(); // requires a user gesture, which this click is

    const sampleRate = getSampleRate();
    const chunks = [];
    let nextStartTime = 0;

    status.innerHTML = "Synthesizing audio...";
    try {
      for await (const audio of textToAudioSentences(
        text,
        speakerId,
        lengthScale,
        noiseScale,
        noiseWScale,
      )) {
        // A newer click superseded us while we were synthesizing.
        if (generation !== playbackGeneration) {
          return;
        }

        chunks.push(audio);

        // Schedule this sentence to play right after the previous one.
        const buffer = audioCtx.createBuffer(1, audio.length, sampleRate);
        buffer.copyToChannel(audio, 0);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);

        if (nextStartTime === 0) {
          nextStartTime = audioCtx.currentTime + 0.1; // small lead-in
          status.innerHTML = "Playing...";
        }
        // Never schedule in the past: a slow synth yields a gap, not an overlap.
        nextStartTime = Math.max(nextStartTime, audioCtx.currentTime);
        source.start(nextStartTime);
        nextStartTime += buffer.duration + SENTENCE_GAP_SECONDS;

        activeSources.push(source);
      }
    } catch (e) {
      status.innerHTML = "Error";
      throw e;
    }

    if (generation !== playbackGeneration) {
      return;
    }

    // Hybrid: assemble the full WAV so the <audio> element supports replay/seek/download.
    // Do not auto-play - it is already playing via Web Audio.
    if (chunks.length > 0) {
      const full = joinWithGaps(chunks, sampleRate);
      audioTTS.src = URL.createObjectURL(float32ToWavBlob(full, sampleRate));
    }

    status.innerHTML = "Ready";
  });

  textInput.disabled = false;
  buttonSpeak.disabled = false;
  fileModel.value = "";
  fileConfig.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});

function updateUIForConfig(voiceConfig) {
  const speakerSelect = document.getElementById("speaker");
  while (speakerSelect.options.length > 1) {
    speakerSelect.remove(speakerSelect.options.length - 1);
  }

  if (voiceConfig.num_speakers <= 1) {
    // Single speaker model
    let option = document.createElement("option");
    option.text = "default";
    option.value = "0";
    speakerSelect.add(option);
  } else {
    // Multi-speaker model
    const speakerIdMap = voiceConfig.speaker_id_map;
    let sortedSpeakers = Object.keys(speakerIdMap).sort(
      (a, b) => speakerIdMap[a] - speakerIdMap[b],
    );
    for (let i in sortedSpeakers) {
      let speaker = sortedSpeakers[i];
      let option = document.createElement("option");
      option.text = speaker + " (" + i.toString() + ")";
      option.value = i.toString();
      speakerSelect.add(option);
    }

    const selectSpeaker = document.getElementById("divSpeaker");
    divSpeaker.hidden = false;
  }

  if (speakerSelect.options.length > 1) {
    // Select first speaker
    speakerSelect.selectedIndex = 1;
  }
}
