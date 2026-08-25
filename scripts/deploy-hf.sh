#!/bin/bash
# Hugging Face Spaces deploy (Linux/Mac/WSL)
# Usage: ./scripts/deploy-hf.sh YOUR_HF_USERNAME winlator-frost

set -e
USERNAME=${1:-}
SPACE=${2:-winlator-frost}
if [ -z "$USERNAME" ]; then echo "Usage: $0 <hf-username> [space-name]"; exit 1; fi

SPACE_ID="$USERNAME/$SPACE"
echo "=== Winlator@Frost → HF Spaces $SPACE_ID ==="

pip install -q huggingface_hub || pip3 install -q huggingface_hub
huggingface-cli whoami || huggingface-cli login

huggingface-cli repo create $SPACE_ID --repo-type space --space-sdk docker --yes || true

TMPDIR=$(mktemp -d)
git clone https://huggingface.co/spaces/$SPACE_ID $TMPDIR/hf
cp -r winlator-frost-website/* $TMPDIR/hf/ 2>/dev/null || cp -r . $TMPDIR/hf/
cp winlator-frost-website/.env.local $TMPDIR/hf/.env.local 2>/dev/null || true
cp winlator-frost-website/README_HF.md $TMPDIR/hf/README.md 2>/dev/null || true

cd $TMPDIR/hf
git add .
git commit -m "feat: deploy $(date +%F)"
git push

echo "Pushed to https://huggingface.co/spaces/$SPACE_ID"
echo "Add env vars in Space → Settings → Variables"
