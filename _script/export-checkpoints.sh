#!/usr/bin/env bash
set -eo pipefail

# Exports checkpoints to onnx voice files.
# Requires: ffmpeg jq
# Requires: https://github.com/daquexian/onnx-simplifier

if [ -z "$2" ]; then
    echo 'Usage: export-checkpoints.sh <piper-checkpoints> <piper-voices>'
    exit 1
fi

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../")"

# -----------------------------------------------------------------------------

piper_checkpoints="$1"
piper_voices="$2"

# -----------------------------------------------------------------------------

function has_dash {
    echo "$1" | grep '[-]'
}

# language/language_COUNTRY/dataset/quality/<checkpoint>.ckpt
find "${piper_checkpoints}" -name '*.ckpt' | sort | \
    while read -r checkpoint; do
        voice_dir="$(dirname "${checkpoint}")";
        echo "Processing ${voice_dir}"

        model_card="${voice_dir}/MODEL_CARD"
        if [ ! -s "${model_card}" ]; then
            # MODEL_CARD must exist
            echo "[ERROR] Missing ${model_card}" >&2;
            continue;
        fi

        quality="$(basename "${voice_dir}")"
        case $quality in
            'x_low' | 'low' | 'medium' | 'high')
            # Valid
            ;;

            *)
                echo "[ERROR] Invalid quality: ${quality}" >&2;
                continue;
                ;;
        esac

        dataset_dir="$(dirname "${voice_dir}")";
        dataset="$(basename "${dataset_dir}")"
        language_dir="$(dirname "${dataset_dir}")";
        language="$(basename "${language_dir}")"
        language_family_dir="$(dirname "${language_dir}")";
        language_family="$(basename "${language_family_dir}")"

        # Dashes are used to separate fields, so they cannot be present in the
        # parts.
        if [ "$(has_dash "${quality}${dataset}${language}")" ]; then
            echo "[ERROR] Dash found in voice: ${voice_dir}" >&2;
            continue;
        fi

        voice_name="${language}-${dataset}-${quality}"
        relative_dir="${language_family}/${language}/${dataset}/${quality}"
        output_dir="${piper_voices}/${relative_dir}"
        mkdir -p "${output_dir}"

        onnx="${output_dir}/${voice_name}.onnx"

        if [ ! -s "${output_dir}/MODEL_CARD" ]; then
            cp "${voice_dir}/MODEL_CARD" "${output_dir}/"
        fi

        if [ ! -s "${onnx}.json" ]; then
            cp "${voice_dir}/config.json" "${onnx}.json"
        fi

        if [ ! -s "${onnx}" ]; then
            # Export to onnx and optimize
            python3 -m piper.train.export_onnx \
                --checkpoint "${checkpoint}" \
                --output-file "${onnx}.unoptimized";

            # https://github.com/daquexian/onnx-simplifier
            onnxsim "${onnx}.unoptimized" "${onnx}";
            rm "${onnx}.unoptimized"
        fi
    done


# Generate samples
find "${piper_voices}" -name '*.onnx' | sort | \
    while read -r onnx; do
        voice_dir="$(dirname "${onnx}")";
        echo "Generating samples for ${voice_dir}"

        quality="$(basename "${voice_dir}")"
        dataset_dir="$(dirname "${voice_dir}")";
        dataset="$(basename "${dataset_dir}")"
        language_dir="$(dirname "${dataset_dir}")";
        language="$(basename "${language_dir}")"
        language_family_dir="$(dirname "${language_dir}")";
        language_family="$(basename "${language_family_dir}")"

        test_sentences="${repo_dir}/test_sentences/${language_family}.txt"
        if [ ! -s "${test_sentences}" ]; then
            echo "[ERROR] Missing ${test_sentences}" >&2;
            continue;
        fi

        samples_dir="${voice_dir}/samples"
        mkdir -p "${samples_dir}"

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
                # Compress to MP3 with ffmpeg
                head -n1 "${test_sentences}" | \
                    python3 -m piper --model "${onnx}" --speaker "${speaker_id}" --output_raw | \
                    ffmpeg -hide_banner -loglevel warning -y \
                        -sample_rate "${sample_rate}" -f s16le -ac 1 -i - \
                        -codec:a libmp3lame -qscale:a 2 "${sample_mp3}";
            fi;
        done
    done
