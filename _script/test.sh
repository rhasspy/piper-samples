#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

venv="${repo_dir}/src/python/.venv"
if [ -d "${venv}" ]; then
    source "${venv}/bin/activate"
fi

checkpoint="$(find ./ -name '*.ckpt' -type f -printf '%T+ %p\n' | sort -r | head -n1 | cut -d' ' -f2-)"
sample_rate="$(jq -r '.audio.sample_rate' < "${this_dir}/config.json")"
language="$(jq -r '.espeak.voice' < "${this_dir}/config.json")"
num_speakers="$(jq -r '.num_speakers' < "${this_dir}/config.json")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"

if [[ "${num_speakers}" == "1" ]]; then
    cat "${this_dir}/test_${language}.jsonl" | \
    python3 -m piper_train.infer \
        --sample-rate "${sample_rate}" \
        --checkpoint "${checkpoint}" \
        --output-dir "${this_dir}/output";
else
    for speaker_id in $(seq 0 "$((${num_speakers} - 1))"); do
        cat "${this_dir}/test_${language}.jsonl" | \
        jq --compact-output ". += { \"speaker_id\": ${speaker_id} }" | \
        python3 -m piper_train.infer \
            --sample-rate "${sample_rate}" \
            --checkpoint "${checkpoint}" \
            --output-dir "${this_dir}/output/${speaker_id}";
    done
fi
