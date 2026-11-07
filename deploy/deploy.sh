#!/usr/bin/env bash
# Runs on the VPS: gets the latest main, updates the database,
# rebuilds the app and restarts it.
#   ssh ubuntu@nelumbotype.online '~/typeracer/deploy/deploy.sh'
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.bun/bin:$PATH"

git pull --ff-only
bun install --frozen-lockfile
docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d --wait
bun run db:migrate
bun run build
sudo systemctl restart typeracer

echo "Deployed $(git rev-parse --short HEAD)"
