#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

PORT="${DEPLOY_RUN_PORT:-3000}"

echo "Starting Next.js on port ${PORT}..."
PORT=${PORT} pnpm next start
