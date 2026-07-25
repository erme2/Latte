#!/usr/bin/env sh
set -eu

if [ ! -e node_modules/@erme2/latte/package.json ]; then
  echo "Installing Latte workspace dependencies in the container volume..."
  npm install
fi

npm run build --workspace @erme2/latte

exec npm run dev -- --host 0.0.0.0
