#!/usr/bin/env sh
set -eu

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required. Install it before generating Latte local certificates." >&2
  exit 1
fi

mkdir -p nginx/certs

mkcert -install
mkcert \
  -cert-file nginx/certs/localhost.pem \
  -key-file nginx/certs/localhost-key.pem \
  latte.localhost localhost 127.0.0.1 ::1
