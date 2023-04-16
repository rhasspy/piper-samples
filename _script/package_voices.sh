#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
voices_dir="$(realpath "${this_dir}/..")"

mkdir -p "${voices_dir}/_dist"

find "${voices_dir}" -name '*.onnx' | \
    while read -r model; do
        model_name="$(basename "${model}" .onnx)";
        model_dir="$(dirname "${model}")";
        if [[ -f "${model_dir}/MODEL_CARD" ]]; then
            dist="${voices_dir}/_dist/voice-${model_name}.tar.gz";
            if [[ -f "${dist}" ]]; then
                continue;
            fi

            echo "${model_dir}";
            cd "${model_dir}" && \
                tar -czvf "${dist}" \
                "${model_name}.onnx" \
                "${model_name}.onnx.json" \
                'MODEL_CARD';
        fi
    done
