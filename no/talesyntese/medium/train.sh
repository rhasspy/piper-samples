#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
python3 -m larynx_train \
    --dataset-dir "${this_dir}" \
    --accelerator 'gpu' \
    --devices 1 \
    --batch-size 64 \
    --validation-split 0.05 \
    --num-test-examples 5 \
    --max-phoneme-ids 300 \
    --max_epochs 10000 \
    --precision 32 "$@"
