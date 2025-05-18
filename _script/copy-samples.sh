#!/usr/bin/env bash
set -eo pipefail

if [ -z "$1" ]; then
    echo 'Usage: copy-samples.sh <piper-voices>'
    exit 1
fi

this_dir="$( cd "$( dirname "$0" )" && pwd )"
output_samples_dir="$(realpath "${this_dir}/../samples")"
repo_dir="$(realpath "${this_dir}/../../")"

venv="${repo_dir}/src/python/.venv"
if [ -d "${venv}" ]; then
    source "${venv}/bin/activate"
fi

# -----------------------------------------------------------------------------

piper_voices="$1"

# -----------------------------------------------------------------------------

# Copy samples
find "${piper_voices}" -name 'speaker_*.mp3' | \
    while read -r sample_mp3; do
        voice_samples_dir="$(dirname "${sample_mp3}")";
        voice_dir="$(dirname "${voice_samples_dir}")"

        quality="$(basename "${voice_dir}")"
        dataset_dir="$(dirname "${voice_dir}")";
        dataset="$(basename "${dataset_dir}")"
        language_dir="$(dirname "${dataset_dir}")";
        language="$(basename "${language_dir}")"
        language_family_dir="$(dirname "${language_dir}")";
        language_family="$(basename "${language_family_dir}")"

        output_dir="${output_samples_dir}/${language_family}/${language}/${dataset}/${quality}"
        mkdir -p "${output_dir}"
        cp "${sample_mp3}" "${output_dir}/"

        head -n1 "${repo_dir}/etc/test_sentences/${language_family}.txt" > "${output_dir}/sample.txt"
        cp "${voice_dir}/MODEL_CARD" "${output_dir}/"
    done

echo 'Copied samples'

# Copy configs for demo page
configs_dir="${this_dir}/../configs"
mkdir -p "${configs_dir}"
find "${piper_voices}" -name '*.onnx.json' -print0 | xargs -0 -I{} cp {} "${configs_dir}/"
echo 'Copied configs'

# Copy voices.json
cp "${piper_voices}/voices.json" "${this_dir}/../"
echo 'Copied voices.json'
