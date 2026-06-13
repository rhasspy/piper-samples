import {
  setVoice,
  textToAudioSentences,
  getSampleRate,
} from "./piper.js";

let voiceUrl = "";
let loadedVoiceUrl = "";
let voiceConfigUrl = "";

// Silence inserted between sentences when scheduling live playback. Tune to taste.
const SENTENCE_GAP_SECONDS = 0.2;

// Web Audio playback state (created lazily on first user gesture, reused after).
let audioCtx = null;
// Bumped on Speak/Stop to abort an in-flight synthesis stream. A seek does NOT bump it, so
// clicking a sentence reschedules playback without killing ongoing synthesis.
let synthGeneration = 0;
// True once synthesis has produced every sentence, so the highlight chain knows it may end
// (revert to the editor) when the audio passes the last sentence rather than mid-stream.
let synthDone = false;
// Each sentence's decoded audio, kept index-aligned with the .sentence spans in the view.
// Retained so a seek can replay without re-synthesizing; never cleared by clearSchedule.
let sentenceBuffers = [];
// Audio-clock time the next scheduled source should start at. Per-run scheduling timing and
// sources live on the spans themselves.
let nextStartTime = 0;
// The highlight chain (see armHighlight): the sentence it is about to light, and the single
// pending setTimeout handle. `highlightTimer === null` means the chain is idle/parked, and is
// the sole guard against starting a second chain.
let highlightIndex = 0;
let highlightTimer = null;

// Read a numeric scale input, returning null when blank/invalid so piper falls back to the
// voice config default.
function parseScaleOrNull(input) {
  const value = parseFloat(input.value);
  return isNaN(value) ? null : value;
}

async function main() {
  const fileModel = document.getElementById("fileModel");
  const fileConfig = document.getElementById("fileConfig");
  const divConfig = document.getElementById("divConfig");
  const buttonSpeak = document.getElementById("buttonSpeak");
  const textInput = document.getElementById("textInput");
  const highlightView = document.getElementById("highlightView");
  const status = document.getElementById("status");
  const speakerSelect = document.getElementById("speaker");
  const inputLengthScale = document.getElementById("lengthScale");
  const inputNoiseScale = document.getElementById("noiseScale");
  const inputNoiseWScale = document.getElementById("noiseWScale");

  let speaking = false;

  fileModel.addEventListener("change", async (e) => {
    const file = e.target.files[0];
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

  fileConfig.addEventListener("change", async (e) => {
    const file = e.target.files[0];
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

  // The sentence spans, in document order — index === sentence index === sentenceBuffers
  // index. The DOM is the list; no separate array is kept.
  function sentences() {
    return [...highlightView.querySelectorAll(".sentence")];
  }

  // Reset the read-only view to empty, ready to receive per-sentence spans.
  function resetHighlightView() {
    highlightView.textContent = "";
  }

  // Tear down the current playback run: cancel the pending highlight timer and stop every
  // sounding source, and clear each span's per-run timing/highlight. Leaves sentenceBuffers
  // and the spans themselves intact, so a seek can re-schedule from them. Always nulls
  // highlightTimer — and the clearTimeout is what makes the chain's captured spans seek-safe
  // (a seek cancels a pending fire before it can light a now-stale span).
  function clearSchedule() {
    if (highlightTimer !== null) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    for (const span of sentences()) {
      if (span.source) {
        try {
          span.source.stop();
        } catch {
          // Already stopped/ended.
        }
        span.source = null;
      }
      span.startTime = undefined;
      span.endTime = undefined;
      span.classList.remove("active");
    }
  }

  // Schedule one sentence to play right after the previously scheduled one, recording its
  // timing and source on the span, then make sure the highlight chain is running.
  function scheduleOne(span, buffer) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    if (nextStartTime === 0) {
      nextStartTime = audioCtx.currentTime + 0.1; // small lead-in
    }
    // Never schedule in the past: a slow synth yields a gap, not an overlap.
    nextStartTime = Math.max(nextStartTime, audioCtx.currentTime);
    source.start(nextStartTime);
    span.source = source;
    span.startTime = nextStartTime;
    span.endTime = nextStartTime + buffer.duration;
    nextStartTime = span.endTime + SENTENCE_GAP_SECONDS;

    status.innerHTML = "Speaking...";
    ensureHighlight();
  }

  // Move the highlight to a span.
  function setActive(span) {
    const previous = highlightView.querySelector(".sentence.active");
    if (previous) {
      previous.classList.remove("active");
    }
    span.classList.add("active");
    span.scrollIntoView({ block: "nearest" });
  }

  // Arm the single timer for the next highlight transition, keyed to the audio clock. The
  // span's scheduled start is in the future, so each delay is re-derived from the live
  // audioCtx.currentTime — no drift accumulates and inter-sentence gaps are handled because
  // we fire on the next sentence's start, keeping the previous one lit until then.
  function armHighlight() {
    const spans = sentences();
    const next = spans[highlightIndex];
    if (next && next.startTime !== undefined) {
      highlightTimer = setTimeout(
        () => {
          setActive(next);
          highlightIndex++;
          armHighlight();
        },
        Math.max(0, (next.startTime - audioCtx.currentTime) * 1000),
      );
    } else if (synthDone) {
      // Everything is highlighted; revert to the editor after the last sentence ends.
      const last = spans[spans.length - 1];
      highlightTimer = setTimeout(
        finishPlayback,
        Math.max(0, (last.endTime - audioCtx.currentTime) * 1000),
      );
    } else {
      // Next sentence isn't synthesized yet; park. scheduleOne() re-arms when it arrives.
      highlightTimer = null;
    }
  }

  // Start the highlight chain if it is idle. This `highlightTimer === null` gate is the ONLY
  // place a chain is started (besides its own self-re-arm), preventing two concurrent chains.
  function ensureHighlight() {
    if (highlightTimer === null) {
      armHighlight();
    }
  }

  // Seek: (re)play starting from a given sentence, reusing the retained buffers. Does NOT
  // bump synthGeneration, so any in-flight synthesis keeps running and its tail appends to
  // this fresh schedule. Triggered by clicking a sentence.
  function playFrom(index) {
    clearSchedule();
    highlightIndex = index;
    nextStartTime = 0;
    const spans = sentences();
    for (let i = index; i < sentenceBuffers.length; i++) {
      scheduleOne(spans[i], sentenceBuffers[i]);
    }
  }

  // Final cleanup when playback ends naturally: drop the highlight, return to the editor,
  // and reset the UI to idle.
  function finishPlayback() {
    clearSchedule();
    showEditor();
    status.innerHTML = "Ready";
    buttonSpeak.innerHTML = "Speak";
    speaking = false;
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

    const lengthScale = parseScaleOrNull(inputLengthScale);
    const noiseScale = parseScaleOrNull(inputNoiseScale);
    const noiseWScale = parseScaleOrNull(inputNoiseWScale);

    // Fresh run: abort any in-flight synthesis (synthGeneration), tear down playback, and
    // reset the playhead, retained buffers, and view. clearSchedule does not touch
    // highlightIndex, so reset it here.
    const generation = ++synthGeneration;
    clearSchedule();
    synthDone = false;
    sentenceBuffers = [];
    highlightIndex = 0;
    nextStartTime = 0;

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    await audioCtx.resume(); // requires a user gesture, which this click is

    const sampleRate = getSampleRate();

    // Swap the editable textarea for the read-only highlight view, which fills in sentence
    // by sentence as synthesis progresses.
    resetHighlightView();
    showHighlightView();
    let viewCursor = 0; // Char offset already emitted into the view.

    status.innerHTML = "Synthesizing audio...";
    try {
      for await (const { audio, start, end } of textToAudioSentences(
        text,
        speakerId,
        lengthScale,
        noiseScale,
        noiseWScale,
      )) {
        // A newer Speak/Stop superseded us while we were synthesizing. (A seek does NOT
        // bump synthGeneration, so this keeps going across seeks.)
        if (generation !== synthGeneration) {
          return;
        }

        // Append any text between the previous sentence and this one as plain text, then
        // the sentence itself as a clickable span (click = seek here). Timing fields start
        // undefined so the highlight loop never matches an unscheduled span.
        if (start > viewCursor) {
          highlightView.appendChild(
            document.createTextNode(text.slice(viewCursor, start)),
          );
        }
        const index = sentenceBuffers.length;
        const span = document.createElement("span");
        span.className = "sentence";
        span.textContent = text.slice(start, end);
        span.startTime = undefined;
        span.endTime = undefined;
        span.addEventListener("click", () => playFrom(index));
        highlightView.appendChild(span);
        viewCursor = end;

        // Retain the decoded audio and schedule this one sentence onto the current timeline
        // (streaming appends exactly one; a seek to an earlier sentence is handled by playFrom).
        const buffer = audioCtx.createBuffer(1, audio.length, sampleRate);
        buffer.copyToChannel(audio, 0);
        sentenceBuffers.push(buffer);
        scheduleOne(span, buffer);
      }
    } catch (e) {
      status.innerHTML = "Error while synthesizing";
      clearSchedule();
      showEditor();
      throw e;
    }

    // All sentences produced. Mark done, THEN kick the highlight chain: if synthesis briefly
    // lagged playback the chain parked on the last sentence with synthDone still false, and
    // this is what arms the finish timer so the view reverts. (Empty text scheduled nothing.)
    synthDone = true;
    if (sentenceBuffers.length === 0) {
      finishPlayback();
    } else {
      ensureHighlight();
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
      // If the user clicks Stop while we're still speaking, stop immediately: abort synth
      // (synthGeneration) and tear down playback (clearSchedule).
      synthGeneration++;
      clearSchedule();
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
    const sortedSpeakers = Object.keys(speakerIdMap).sort(
      (a, b) => speakerIdMap[a] - speakerIdMap[b],
    );
    for (const speaker of sortedSpeakers) {
      const id = speakerIdMap[speaker];
      const option = document.createElement("option");
      option.text = `${speaker} (${id})`;
      option.value = String(id);
      speakerSelect.add(option);
    }

    document.getElementById("divSpeaker").hidden = false;
  }

  if (speakerSelect.options.length > 1) {
    // Select first speaker
    speakerSelect.selectedIndex = 1;
  }
}
