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
checkpoint="$(find "${this_dir}" -name '*.ckpt' -type f | head -n1)"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
python3 -m larynx_train.export_onnx \
    "${checkpoint}" \
    "${this_dir}/${model_name}.onnx"

cp "${this_dir}/config.json" "${model_name}.onnx.json"
