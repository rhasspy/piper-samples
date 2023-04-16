#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

venv="${repo_dir}/src/python/.venv"
if [ -d "${venv}" ]; then
    source "${venv}/bin/activate"
fi

parent_dir="$(realpath "${this_dir}/..")"
model_name="$(basename "${parent_dir}")-$(basename "${this_dir}")"
checkpoint="$(find ./ -name '*.ckpt' -type f -printf '%T+ %p\n' | sort -r | head -n1 | cut -d' ' -f2-)"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
python3 -m piper_train.export_onnx \
    "${checkpoint}" \
    "${this_dir}/${model_name}.onnx"

cp "${this_dir}/config.json" "${model_name}.onnx.json"
