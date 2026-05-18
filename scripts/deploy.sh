#!/usr/bin/env bash
# Build and rsync the static site to the GCP instance.
# Usage: ./scripts/deploy.sh [--dry-run]
#
# Requires: ssh access to the instance (matching user's local ssh config or ~/.ssh/config entry).
# Assumes the remote path /var/www/z-linux.com is writable by the deploy user.
#
# Edit the two variables below if the host or remote path changes.

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-34.129.238.11}"
REMOTE_USER="${REMOTE_USER:-$(whoami)}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/z-linux.com}"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "[deploy] dry-run mode — no files will be transferred"
fi

echo "[deploy] building..."
npm run build

echo "[deploy] syncing dist/ -> ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
rsync -avz --delete ${DRY_RUN} \
  --exclude=".DS_Store" \
  dist/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

if [[ -z "${DRY_RUN}" ]]; then
  echo "[deploy] done · http://z-linux.com"
else
  echo "[deploy] dry-run complete"
fi
