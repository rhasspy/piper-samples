#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
python3 -m larynx_train \
    --dataset-dir "${this_dir}" \
    --accelerator 'gpu' \
    --devices 1 \
    --batch-size 100 \
    --validation-split 0.0 \
    --num-test-examples 0 \
    --hidden-channels 96 \
    --inter-channels 96 \
    --filter-channels 384 \
    --max_epochs 10000 \
    --precision 32 "$@"
