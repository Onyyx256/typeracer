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
bun run db:seed
bun run build
# A git pull alone leaves the old unit in /etc/systemd/system running.
if ! cmp -s deploy/typeracer.service /etc/systemd/system/typeracer.service; then
  sudo cp deploy/typeracer.service /etc/systemd/system/typeracer.service
  sudo systemctl daemon-reload
fi
sudo systemctl restart typeracer

echo "Deployed $(git rev-parse --short HEAD)"
