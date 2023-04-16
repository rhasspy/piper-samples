#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

venv="${repo_dir}/src/python/.venv"
if [ -d "${venv}" ]; then
    source "${venv}/bin/activate"
fi

# language-dataset-quality
dataset_dir="$(realpath "${this_dir}/..")"
language_dir="$(realpath "${dataset_dir}/..")"
model_name="$(basename "${language_dir}")-$(basename "${dataset_dir}")-$(basename "${this_dir}")"

# Read sample rate from config
sample_rate="$(jq '.audio.sample_rate' < "${this_dir}/config.json")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"

function infer {
    if [[ "$1" == '--onnx' ]]; then
        onnx="${model_name}.onnx";
        echo "${onnx}"
        python3 -m piper_train.infer_onnx \
            --sample-rate "${sample_rate}" \
            --model "${onnx}" \
            --output-dir "${this_dir}/output";
    elif [[ "$1" == '--generator' ]]; then
        generator="${model_name}.pt";
        echo "${generator}"
        python3 -m piper_train.infer_generator \
            --sample-rate "${sample_rate}" \
            --model "${generator}" \
            --output-dir "${this_dir}/output";
    else
        checkpoint="$(find ./ -name '*.ckpt' -type f -printf '%T+ %p\n' | sort -r | head -n1 | cut -d' ' -f2-)";
        echo "${checkpoint}"
        python3 -m piper_train.infer \
            --sample-rate "${sample_rate}" \
            --checkpoint "${checkpoint}" \
            --output-dir "${this_dir}/output";
    fi
}

zcat "${this_dir}/dataset.jsonl" | shuf -n5 | infer "$1"
