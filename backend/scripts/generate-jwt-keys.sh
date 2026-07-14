#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="$ROOT/storage"
PRIVATE_KEY="$KEY_DIR/jwtRS256.key"
PUBLIC_KEY="$KEY_DIR/jwtRS256.key.pub"

mkdir -p "$KEY_DIR"
ssh-keygen -t rsa -P "" -b 2048 -m PEM -f "$PRIVATE_KEY" -q
ssh-keygen -e -m PEM -f "$PRIVATE_KEY" > "$PUBLIC_KEY"

echo "Add these to backend/.env:"
echo "JWT_ACCESS_TOKEN_SECRET_PRIVATE=$(base64 < "$PRIVATE_KEY" | tr -d '\n')"
echo "JWT_ACCESS_TOKEN_SECRET_PUBLIC=$(base64 < "$PUBLIC_KEY" | tr -d '\n')"
