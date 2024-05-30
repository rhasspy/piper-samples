#!/usr/bin/env bash
set -eo pipefail

# Generates audio samples for voices.
# Requires: ffmpeg jq

if [ -z "$1" ]; then
    echo 'Usage: generate-samples.sh <piper-voices>'
    exit 1
fi

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../")"

venv="${repo_dir}/src/python/.venv"
if [ -d "${venv}" ]; then
    source "${venv}/bin/activate"
fi

# -----------------------------------------------------------------------------

piper_voices="$1"
piper_binary="${repo_dir}/install/piper"

find "${piper_voices}" -name '*.onnx' | sort | \
    while read -r onnx; do
        voice_dir="$(dirname "${onnx}")";
        quality="$(basename "${voice_dir}")"
        dataset_dir="$(dirname "${voice_dir}")";
        dataset="$(basename "${dataset_dir}")"
        language_dir="$(dirname "${dataset_dir}")";
        language="$(basename "${language_dir}")"
        language_family_dir="$(dirname "${language_dir}")";
        language_family="$(basename "${language_family_dir}")"

        test_sentences="${repo_dir}/etc/test_sentences/${language_family}.txt"
        if [ ! -s "${test_sentences}" ]; then
            echo "[ERROR] Missing ${test_sentences}" >&2;
            continue;
        fi

        samples_dir="${voice_dir}/samples"
        mkdir -p "${samples_dir}"

        noise_scale="$(jq --raw-output '.inference.noise_scale' "${onnx}.json")"
        if [ -z "${noise_scale}" ]; then
            noise_scale="0.667"
        fi

        length_scale="$(jq --raw-output '.inference.length_scale' "${onnx}.json")"
        if [ -z "${length_scale}" ]; then
            length_scale="1.0"
        fi

        noise_w="$(jq --raw-output '.inference.noise_w' "${onnx}.json")"
        if [ -z "${noise_w}" ]; then
            noise_w="0.8"
        fi

        num_speakers="$(jq --raw-output '.num_speakers' "${onnx}.json")"
        sample_rate="$(jq --raw-output '.audio.sample_rate' "${onnx}.json")"
        last_speaker_id="$((num_speakers-1))"

        # Generate a sample from the first test sentence for each speaker
        for speaker_id in `seq 0 ${last_speaker_id}`; do
            sample_mp3="${samples_dir}/speaker_${speaker_id}.mp3"
            if [ -s "${sample_mp3}" ]; then
                sample_mp3_size="$(stat --printf='%s' "${sample_mp3}")"
            else
                sample_mp3_size='0'
            fi

            if [ "${sample_mp3_size}" -lt 1000 ]; then
                echo "Generating sample for ${dataset} (quality=${quality}, speaker=${speaker_id})"

                # Compress to MP3 with ffmpeg
                head -n1 "${test_sentences}" | \
                    "${piper_binary}" --model "${onnx}" --speaker "${speaker_id}" --output_raw \
                      --noise_scale "${noise_scale}" --noise_w "${noise_w}" --length_scale "${length_scale}" | \
                    ffmpeg -hide_banner -loglevel warning -y \
                        -sample_rate "${sample_rate}" -f s16le -ac 1 -i - \
                        -codec:a libmp3lame -qscale:a 2 "${sample_mp3}";
            fi;
        done
    done
