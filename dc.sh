#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
env_file="$project_dir/../gig-income-tracker.env"

if [[ ! -f "$env_file" ]]; then
  printf 'Missing %s. Create it using the deployment instructions in README.md.\n' "$env_file" >&2
  exit 1
fi

exec docker compose --project-directory "$project_dir" \
  --env-file "$env_file" \
  -f "$project_dir/docker-compose.yml" \
  -f "$project_dir/compose.server.yml" "$@"
