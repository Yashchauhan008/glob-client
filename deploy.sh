#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

IMAGE="${IMAGE:-yashchauhan008/glob-client:latest}"

[ -f .env.prod ] || { echo "Missing .env.prod (cp .env.prod.example .env.prod and edit)"; exit 1; }
echo "Building $IMAGE with .env.prod:"
sed -E 's/^(VITE_GOOGLE_MAPS_API_KEY)=.*/\1=<hidden>/; s/^/  /' .env.prod

docker buildx build \
  --platform linux/amd64 \
  -t "$IMAGE" \
  --push .

echo "Pushed. On the VPS run ~/glob/client-up.sh (from the vps/ folder) to pull and restart."
