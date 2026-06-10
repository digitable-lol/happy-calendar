#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-digitable-lol/happy-calendar}"
DEPLOY_DIR="${DEPLOY_DIR:-/www/wwwroot/happy-calendar.digitable.life}"
DEPLOY_USER="${DEPLOY_USER:-githubactionuser}"
DEPLOY_GROUP="${DEPLOY_GROUP:-www}"
DEPLOY_HOST="${DEPLOY_HOST:-80.66.72.71}"
SSH_KEY_PATH="${SSH_KEY_PATH:-/home/${DEPLOY_USER}/.ssh/id_ed25519}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root on the server."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  apt update
  apt install -y gh
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi

mkdir -p "$DEPLOY_DIR"
chown -R "${DEPLOY_USER}:${DEPLOY_GROUP}" "$DEPLOY_DIR"
chmod -R u+rwX,g+rwX "$DEPLOY_DIR"

mkdir -p "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"

if [ ! -f "$SSH_KEY_PATH" ]; then
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -N "" -f "$SSH_KEY_PATH" -C "github-actions-${REPO}"
fi

PUB_KEY="$(ssh-keygen -y -f "$SSH_KEY_PATH")"
touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
grep -qF "$PUB_KEY" "/home/${DEPLOY_USER}/.ssh/authorized_keys" || echo "$PUB_KEY" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys" "$SSH_KEY_PATH"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

gh repo view "$REPO" >/dev/null

gh secret set DIGITABLE_HOST --repo "$REPO" --body "$DEPLOY_HOST"
gh secret set DIGITABLE_USERNAME --repo "$REPO" --body "$DEPLOY_USER"
gh secret set DIGITABLE_SSH_KEY --repo "$REPO" < "$SSH_KEY_PATH"

echo "Secrets configured for $REPO:"
gh secret list --repo "$REPO"

echo "Deploy directory ready: $DEPLOY_DIR"
echo "Run workflow: gh workflow run 'Deploy Happy Calendar' --repo $REPO"
