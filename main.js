/* Piper voice samples */

var voices = {};
const qualitySort = {
  "x_low": 0,
  "low": 1,
  "medium": 2,
  "high": 3,
};
var languageToSelect = null;
var voiceToSelect = null;
var qualityToSelect = null;

function q(selector) {return document.querySelector(selector)}

function setAudio(name) {
  var audio = q("#audio-" + name);
  var speaker = q("#speaker-" + name);

  audio.src = "samples/" + name + "/" + speaker.value + "/sample.mp3";
}

function setLanguage() {
  var language = q("#languages").value;
  if (language.length > 0) {
    var voiceSelect = q("#voice");
    while (voiceSelect.options.length > 1) {
      voiceSelect.remove(voiceSelect.options.length - 1);
    }

    let names = [];
    for (key in voices) {
      let voice = voices[key];
      if (voice.language.code == language) {
        names.push(voice.name);
      }
    }

    names = Array.from(new Set(names)).sort();
    for (i in names) {
      let name = names[i];
      let option = document.createElement("option");
      option.text = name;
      option.value = name;
      voiceSelect.add(option);
    }

    if (voiceToSelect) {
      voiceSelect.value = voiceToSelect;
      voiceToSelect = null;
      setVoice();
    } else if (voiceSelect.options.length > 1) {
      // Select first voice
      voiceSelect.selectedIndex = 1;
      setVoice();
    }
  }
}

function setVoice() {
  var language = q("#languages").value;
  var voiceName = q("#voice").value;
  if (voiceName.length > 0) {
    var qualitySelect = q("#quality");
    while (qualitySelect.options.length > 1) {
      qualitySelect.remove(qualitySelect.options.length - 1);
    }

    let qualities = [];
    for (key in voices) {
      let voice = voices[key];
      if ((voice.language.code == language) && (voice.name == voiceName)) {
        qualities.push(voice.quality);
      }
    }

    qualities = Array.from(new Set(qualities)).sort((a, b) => qualitySort[a] - qualitySort[b]);
    for (i in qualities) {
      let quality = qualities[i];
      let option = document.createElement("option");
      option.text = quality;
      option.value = quality;
      qualitySelect.add(option);
    }

    if (qualityToSelect) {
      qualitySelect.value = qualityToSelect;
      qualityToSelect = null;
      setQuality();
    } else if (qualitySelect.options.length > 1) {
      // Select highest quality
      qualitySelect.selectedIndex = qualitySelect.options.length - 1;
      setQuality();
    }
  }
}

function setQuality() {
  var language = q("#languages").value;
  var voiceName = q("#voice").value;
  var quality = q("#quality").value;
  if (quality.length > 0) {
    var speakerSelect = q("#speaker");
    while (speakerSelect.options.length > 1) {
      speakerSelect.remove(speakerSelect.options.length - 1);
    }

    var numSpeakers = 1;
    var speakerIdMap = {};
    for (key in voices) {
      let voice = voices[key];
      if ((voice.language.code == language)
          && (voice.name == voiceName)
          && (voice.quality == quality)) {
        numSpeakers = voice.num_speakers;
        speakerIdMap = voice.speaker_id_map;
        break;
      }
    }

    if (numSpeakers <= 1) {
      // Single speaker model
      let option = document.createElement("option");
      option.text = "default";
      option.value = "0";
      speakerSelect.add(option);
    } else {
      // Multi-speaker model
      let sortedSpeakers = Object.keys(speakerIdMap).sort((a, b) => speakerIdMap[a] - speakerIdMap[b]);
      for (i in sortedSpeakers) {
        let speaker = sortedSpeakers[i];
        let option = document.createElement("option");
        option.text = speaker + " (" + i.toString() + ")";
        option.value = i.toString();
        speakerSelect.add(option);
      }
    }

    if (speakerSelect.options.length > 1) {
      // Select first speaker
      speakerSelect.selectedIndex = 1;
      setSpeaker();
    }

    let voiceId = `${language}-${voiceName}-${quality}`;
    window.location.hash = voiceId;
  }
}

function setSpeaker() {
  var language = q("#languages").value;
  let languageFamily = language.split("_")[0];
  var voiceName = q("#voice").value;
  var quality = q("#quality").value;
  var speaker = q("#speaker").value;
  var audio = q("#audio");
  if (speaker.length > 0) {
    for (key in voices) {
      let voice = voices[key];
      if ((voice.language.code == language)
          && (voice.name == voiceName)
          && (voice.quality == quality)) {

        q("#key").innerHTML = key;

        q("#download").href = "https://huggingface.co/rhasspy/piper-voices/tree/main/"
          + languageFamily
          + "/"
          + language
          + "/"
          + voiceName
          + "/"
          + quality
          + "/";

        q("#info").hidden = false;

        let sampleDir = "samples/"
            + languageFamily
            + "/"
            + language
            + "/"
            + voiceName
            + "/"
            + quality;

        audio.src = sampleDir
          +"/speaker_"
          + speaker
          + ".mp3";

        fetch(sampleDir + "/sample.txt")
          .then(response => response.text())
          .then(text => {
            q("#text").innerHTML = text;
          });

        fetch(sampleDir + "/MODEL_CARD")
          .then(response => response.text())
          .then(text => {
            q("#modelCard").innerHTML = text;
          });
        break;
      }
    }
  }
}

window.onload = function(e) {
  let hash = window.location.hash;
  if (hash.length > 0) {
    let voiceIdRegexp = RegExp("^#([^-]+)-([^-]+)-([^-]+)$");
    let match = voiceIdRegexp.exec(hash);
    if (match) {
      languageToSelect = match[1];
      voiceToSelect = match[2];
      qualityToSelect = match[3];
    }
  }

  fetch("voices.json")
    .then(response => response.json())
    .then(response_obj => {
      voices = response_obj;
      let voiceLanguages = [];
      let languageNames = {};
      for (key in voices) {
        let voice = voices[key];
        voiceLanguages.push(voice.language.code);
        languageNames[voice.language.code] = voice.language.name_native
          + " (" + voice.language.name_english + ", "
          + voice.language.country_english + ")";
      }

      let sortedLanguages = Array.from(new Set(voiceLanguages)).sort();
      let languagesSelect = q("#languages");
      for (i in sortedLanguages) {
        let language = sortedLanguages[i];
        let option = document.createElement("option");
        option.text = languageNames[language];
        option.value = language;
        languagesSelect.add(option);
      }

      if (languageToSelect) {
        languagesSelect.value = languageToSelect;
        languageToSelect = null;
        setLanguage();
      }
    });
}
