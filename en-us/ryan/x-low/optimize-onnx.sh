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

language_dir="$(realpath "${this_dir}/../..")"
optimized_model_name="$(basename "${language_dir}")-$(basename "${parent_dir}")-$(basename "${this_dir}")"

onnxsim "${model_name}.onnx" "${optimized_model_name}.onnx"

cp "${this_dir}/config.json" "${optimized_model_name}.onnx.json"
