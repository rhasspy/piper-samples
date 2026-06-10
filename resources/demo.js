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

// Live-highlight state. `spans` are the per-sentence elements in the read-only view;
// `segments[i]` is { startTime, endTime } on the audio clock for spans[i]. The rAF loop
// matches audioCtx.currentTime against the segments to highlight the playing sentence.
let highlightSpans = [];
let highlightSegments = [];
let highlightRAF = null;
let activeHighlight = -1;
// True once the synth loop has scheduled every sentence, so the rAF loop knows it can end
// when the audio clock passes the last segment (rather than stopping mid-stream).
let highlightSynthDone = false;

function clearHighlight() {
  if (activeHighlight >= 0 && highlightSpans[activeHighlight]) {
    highlightSpans[activeHighlight].classList.remove("active");
  }
  activeHighlight = -1;
}

function stopHighlightLoop() {
  if (highlightRAF !== null) {
    cancelAnimationFrame(highlightRAF);
    highlightRAF = null;
  }
}

function stopPlayback() {
  for (const src of activeSources) {
    try {
      src.stop();
    } catch {
      // Already stopped/ended.
    }
  }
  activeSources = [];
  stopHighlightLoop();
  clearHighlight();
  highlightSegments = [];
}

async function main() {
  const fileModel = document.getElementById("fileModel");
  const fileConfig = document.getElementById("fileConfig");
  const divConfig = document.getElementById("divConfig");
  const buttonSpeak = document.getElementById("buttonSpeak");
  const audioTTS = document.getElementById("audioTTS");
  const textInput = document.getElementById("textInput");
  const highlightView = document.getElementById("highlightView");
  const status = document.getElementById("status");
  const speakerSelect = document.getElementById("speaker");
  const inputLengthScale = document.getElementById("lengthScale");
  const inputNoiseScale = document.getElementById("noiseScale");
  const inputNoiseWScale = document.getElementById("noiseWScale");

  var speaking = false;

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

      if (voiceUrl != loadedVoiceUrl) {
        status.innerHTML = "Loading voice...";
        try {
          await setVoice(voiceUrl, voiceConfigUrl);
        }
        catch (e) {
          status.innerHTML = "Error loading voice";
          throw e;
        }
        loadedVoiceUrl = voiceUrl;
      }

      status.innerHTML = "Ready";
      buttonSpeak.disabled = false;
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
    status.innerHTML = "Ready";
    buttonSpeak.disabled = false;
  });

  function showHighlightView() {
    textInput.hidden = true;
    highlightView.hidden = false;
  }

  function showEditor() {
    highlightView.hidden = true;
    textInput.hidden = false;
  }

  // Reset the read-only view to empty, ready to receive per-sentence spans.
  function resetHighlightView() {
    highlightView.textContent = "";
    highlightSpans = [];
  }

  // Final cleanup when playback ends naturally: drop the highlight, return to the editor,
  // and reset the UI to idle.
  function finishPlayback() {
    clearHighlight();
    showEditor();
    status.innerHTML = "Ready";
    buttonSpeak.innerHTML = "Speak";
    speaking = false;
  }

  // Poll the audio clock each frame and light up whichever sentence span is currently
  // playing. BufferSource has no "start" event, so matching audioCtx.currentTime against
  // the segment table is the reliable trigger, and it self-corrects against scheduling
  // gaps. Runs until superseded or the audio passes the last scheduled segment.
  function startHighlightLoop(generation) {
    const tick = () => {
      if (generation !== playbackGeneration) {
        return; // Superseded; stopPlayback already cleaned up.
      }
      const t = audioCtx.currentTime;
      const i = highlightSegments.findIndex(
        (seg) => t >= seg.startTime && t < seg.endTime,
      );
      // Keep the current sentence lit through inter-sentence gaps (i === -1); only switch
      // when a new sentence actually starts.
      if (i >= 0 && i !== activeHighlight) {
        clearHighlight();
        highlightSpans[i].classList.add("active");
        highlightSpans[i].scrollIntoView({ block: "nearest" });
        activeHighlight = i;
      }

      const last = highlightSegments[highlightSegments.length - 1];
      if (highlightSynthDone && (!last || t >= last.endTime)) {
        highlightRAF = null;
        finishPlayback();
      } else {
        highlightRAF = requestAnimationFrame(tick);
      }
    };
    stopHighlightLoop();
    highlightRAF = requestAnimationFrame(tick);
  }

  async function speak() {
    if (!voiceUrl) {
      alert("Voice model is not set");
      return;
    }

    if (!loadedVoiceUrl) {
      alert("Voice config is not set");
      return;
    }

    const text = textInput.value;
    if (!text) {
      alert("No text");
      return;
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

    // Swap the editable textarea for the read-only highlight view, which fills in sentence
    // by sentence as synthesis progresses.
    highlightSynthDone = false;
    resetHighlightView();
    showHighlightView();
    let viewCursor = 0; // Char offset already emitted into the view.
    let loopStarted = false;

    status.innerHTML = "Synthesizing audio...";
    try {
      for await (const { audio, start, end } of textToAudioSentences(
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

        // Append any text between the previous sentence and this one as plain text, then
        // the sentence itself as a highlightable span. spans and segments stay in lock-step.
        if (start > viewCursor) {
          highlightView.appendChild(
            document.createTextNode(text.slice(viewCursor, start)),
          );
        }
        const span = document.createElement("span");
        span.className = "sentence";
        span.textContent = text.slice(start, end);
        highlightView.appendChild(span);
        highlightSpans.push(span);
        viewCursor = end;

        // Schedule this sentence to play right after the previous one.
        const buffer = audioCtx.createBuffer(1, audio.length, sampleRate);
        buffer.copyToChannel(audio, 0);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);

        if (nextStartTime === 0) {
          nextStartTime = audioCtx.currentTime + 0.1; // small lead-in
          status.innerHTML = "Speaking...";
        }
        // Never schedule in the past: a slow synth yields a gap, not an overlap.
        nextStartTime = Math.max(nextStartTime, audioCtx.currentTime);
        const startedAt = nextStartTime;
        source.start(startedAt);
        nextStartTime += buffer.duration + SENTENCE_GAP_SECONDS;

        activeSources.push(source);
        highlightSegments.push({
          startTime: startedAt,
          endTime: startedAt + buffer.duration,
        });

        if (!loopStarted) {
          loopStarted = true;
          startHighlightLoop(generation);
        }
      }
    } catch (e) {
      status.innerHTML = "Error while synthesizing";
      stopPlayback();
      showEditor();
      throw e;
    }

    // All sentences scheduled. Let the rAF loop end naturally once the audio plays out;
    // if nothing was produced, there is no loop to restore the editor, so do it here.
    highlightSynthDone = true;
    if (!loopStarted) {
      finishPlayback();
    }
  }


  buttonSpeak.addEventListener("click", async () => {
    if (!speaking) {
      speaking = true;
      buttonSpeak.innerHTML = "Stop";
      try {
        // Stays "speaking" through playback; finishPlayback() resets the UI when the
        // audio plays out. speak() resolves once synthesis is scheduled, not when audio ends.
        await speak();
      } catch {
        // speak() already restored the editor and set an error status.
        speaking = false;
        buttonSpeak.innerHTML = "Speak";
      }
    } else {
      // If the user clicks Stop while we're still speaking, stop immediately.
      playbackGeneration++;
      stopPlayback();
      showEditor();
      speaking = false;
      status.innerHTML = "Ready";
      buttonSpeak.innerHTML = "Speak";
    }
  });

  textInput.disabled = false;
  buttonSpeak.disabled = true;
  status.innerHTML = "Load voice to begin";
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
