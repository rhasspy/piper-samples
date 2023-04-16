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

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"

checkpoint="$(find ./ -name '*.ckpt' -type f -printf '%T+ %p\n' | sort -r | head -n1 | cut -d' ' -f2-)";
echo "${checkpoint}"

if [[ "$1" == '--generator' ]]; then
    generator="${model_name}.pt";
    python3 -m piper_train.export_generator \
        "${checkpoint}" \
        "${generator}";
    echo "${generator}";
else
    onnx="${model_name}.onnx";
    python3 -m piper_train.export_onnx \
        "${checkpoint}" \
        "${onnx}.unoptimized";

    if [[ "$(command -v onnxsim)" ]]; then
        # https://github.com/daquexian/onnx-simplifier
        onnxsim "${onnx}.unoptimized" "${onnx}";
        rm -f "${onnx}.unoptimized";
    else
        # onnxsim not available
        mv "${onnx}.unoptimized" "${onnx}";
    fi

    cp "${this_dir}/config.json" "${onnx}.json"

    echo "${onnx}";
fi
