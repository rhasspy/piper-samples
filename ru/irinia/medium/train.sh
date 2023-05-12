#!/usr/bin/env bash
set -eo pipefail

this_dir="$( cd "$( dirname "$0" )" && pwd )"
repo_dir="$(realpath "${this_dir}/../../../../")"

export PYTHONPATH="${repo_dir}/src/python:${PYTHONPATH}"
python3 -m piper_train \
    --dataset-dir "${this_dir}" \
    --accelerator 'gpu' \
    --devices 1 \
    --batch-size 32 \
    --validation-split 0 \
    --num-test-examples 0 \
    --max_epochs 10000 \
    --checkpoint-epochs 10 \
    --precision 32 "$@"
