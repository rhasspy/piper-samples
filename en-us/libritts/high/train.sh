#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
python3 -m larynx_train \
    --dataset-dir "${this_dir}" \
    --accelerator 'gpu' \
    --devices 1 \
    --batch-size 32 \
    --validation-split 0.01 \
    --num-test-examples 0 \
    --max-phoneme-ids 400 \
    --max_epochs 10000 \
    --checkpoint-epochs 1 \
    --quality high \
    --precision 32 "$@"
