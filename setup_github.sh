#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="holu"
REPO_DESC="HOLU production repository"
WORKDIR="/opt/data/holu-private"
ENV_FILE="/opt/data/.env"

mkdir -p "$WORKDIR"
cd "$WORKDIR"

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

if grep -q '^GITHUB_TOKEN=' "$ENV_FILE"; then
  echo "GITHUB_TOKEN ya existe en $ENV_FILE"
else
  printf 'Pega tu GITHUB_TOKEN y presiona Enter: '
  stty -echo
  read -r GITHUB_TOKEN
  stty echo
  printf '\n'
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Token vacío. Cancelado."
    exit 1
  fi
  grep -v '^GITHUB_TOKEN=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
  printf 'GITHUB_TOKEN=%s\n' "$GITHUB_TOKEN" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Token guardado en $ENV_FILE"
fi

GITHUB_TOKEN=$(grep '^GITHUB_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2-)
if [ -z "$GITHUB_TOKEN" ]; then
  echo "No pude leer GITHUB_TOKEN desde $ENV_FILE"
  exit 1
fi

GH_USER=$(python3 - <<PY
import json, urllib.request
req = urllib.request.Request(
    'https://api.github.com/user',
    headers={
        'Authorization': 'token $GITHUB_TOKEN',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    },
)
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.load(r)
print(data['login'])
PY
)

echo "GitHub user: $GH_USER"

if git -C "$WORKDIR" remote get-url origin >/dev/null 2>&1; then
  git -C "$WORKDIR" remote set-url origin "https://github.com/$GH_USER/$REPO_NAME.git"
else
  git -C "$WORKDIR" remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
fi

git -C "$WORKDIR" branch -M main

echo "Creando repo privado: https://github.com/$GH_USER/$REPO_NAME"
python3 - <<PY
import json, urllib.request, urllib.error
payload = json.dumps({
    'name': '$REPO_NAME',
    'private': True,
    'auto_init': False,
    'description': '$REPO_DESC',
}).encode()
req = urllib.request.Request(
    'https://api.github.com/user/repos',
    data=payload,
    method='POST',
    headers={
        'Authorization': 'token $GITHUB_TOKEN',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
        print('OK_REPO_URL=' + data['html_url'])
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', 'ignore')
    if e.code == 422 and 'already exists' in body:
        print('OK_REPO_EXISTS=https://github.com/$GH_USER/$REPO_NAME')
    else:
        print('ERROR_HTTP=' + str(e.code))
        print(body)
        raise
PY

git -C "$WORKDIR" add admin.jsx mesa.jsx setup_github.sh
if git -C "$WORKDIR" diff --cached --quiet; then
  echo "No hay cambios para commitear"
else
  git -C "$WORKDIR" commit -m "Initial HOLU production workspace"
fi

echo "Para subir, ejecuta: git -C $WORKDIR push -u origin main"
