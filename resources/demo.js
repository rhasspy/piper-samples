import { setVoice, textToWavAudio } from "./piper.js";

let voiceUrl = "";
let loadedVoiceUrl = "";
let voiceConfigUrl = "";

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

    status.innerHTML = "Synthesizing audio...";
    const wavAudio = await textToWavAudio(
      text,
      speakerId,
      lengthScale,
      noiseScale,
      noiseWScale,
    );
    const audioURL = URL.createObjectURL(wavAudio);

    audioTTS.src = audioURL;
    audioTTS.play();

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
