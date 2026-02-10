#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH"
cd "$(dirname "$0")"

# Load env
set -a
source .env
set +a

# Start bot
exec npx tsx index.ts
