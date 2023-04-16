#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

venv="${repo_dir}/src/python/.venv"
if [ -d "${venv}" ]; then
    source "${venv}/bin/activate"
fi

checkpoint="$(find ./ -name '*.ckpt' -type f -printf '%T+ %p\n' | sort -r | head -n1 | cut -d' ' -f2-)"
sample_rate="$(jq '.audio.sample_rate' < "${this_dir}/config.json")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
shuf "${this_dir}/dataset.jsonl" -n5  | \
python3 -m larynx_train.infer \
    --sample-rate "${sample_rate}" \
    --checkpoint "${checkpoint}" \
    --output-dir "${this_dir}/output"
