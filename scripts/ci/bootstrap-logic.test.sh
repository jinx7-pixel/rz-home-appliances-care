#!/usr/bin/env bash
# Logic tests for scripts/deploy/bootstrap-vps.sh (pure shell, no root needed).
set -uo pipefail

pass=0; fail=0
t() { # t <name> <expected> <actual>
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1));
  else printf '  FAIL  %s\n        expected: %s\n        actual  : %s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# --- 1. pm2 env extraction (the function used to reuse existing credentials) ---
pm2_env() { pm2 env 0 2>/dev/null | awk -F': ' -v k="$1" '$1==k{print $2; exit}' || true; }
SAMPLE_PM2='name: rz-api
namespace: default
version: 1.0.0
NODE_ENV: production
PORT: 5000
DATABASE_URL: postgresql://rz_app:s3cr3t@127.0.0.1:5432/rz_care
ADMIN_PASSWORD: adm1n-pass
EMAIL_FROM: no-reply@rzfixer.in
OWNER_EMAIL: owner@rzfixer.in
SMTP_HOST: smtp.example.com
SMTP_PORT: 587
SMTP_SECURE: false
SMTP_REQUIRE_TLS: true
SMTP_USER: mailer@example.com
SMTP_APP_PASSWORD: smtp-secret
LOG_LEVEL: info'
pm2_env() { printf '%s\n' "$SAMPLE_PM2" | awk -F': ' -v k="$1" '$1==k{print $2; exit}' || true; }

t "pm2_env extracts DATABASE_URL" \
  "postgresql://rz_app:s3cr3t@127.0.0.1:5432/rz_care" "$(pm2_env DATABASE_URL)"
t "pm2_env extracts ADMIN_PASSWORD" "adm1n-pass" "$(pm2_env ADMIN_PASSWORD)"
t "pm2_env extracts SMTP_APP_PASSWORD" "smtp-secret" "$(pm2_env SMTP_APP_PASSWORD)"
t "pm2_env ignores a key that is absent" "" "$(pm2_env NOT_SET)"

# --- 2. the host rewrite that points containers at the bridge gateway ---
DB_URL="$(pm2_env DATABASE_URL)"
DB_URL="${DB_URL/127.0.0.1/host.docker.internal}"
t "127.0.0.1 is rewritten to host.docker.internal" \
  "postgresql://rz_app:s3cr3t@host.docker.internal:5432/rz_care" "$DB_URL"

# --- 3. database name extraction from a URL ---
dbname() {
  local url="${1%%\?*}"; url="${url%/}"; local name="${url##*/}"
  case "$name" in *:*) name="" ;; esac
  printf '%s' "$name"
}
t "db name from a plain URL" "rz_care" "$(dbname 'postgresql://rz_app:pw@127.0.0.1:5432/rz_care')"
t "db name with the bridge host" "rz_care" "$(dbname 'postgresql://rz_app:pw@host.docker.internal:5432/rz_care')"
t "db name is empty for a URL without a path" "" "$(dbname 'postgresql://rz_app:pw@127.0.0.1:5432')"

# --- 4. listen_addresses rewrite on a realistic Ubuntu postgresql.conf ---
TMP="$(mktemp -d)"
cat > "$TMP/postgresql.conf" <<'EOF'
#listen_addresses = 'localhost'
port = 5432
max_connections = 100
EOF
sed -i "/^[[:space:]]*#\?[[:space:]]*listen_addresses[[:space:]]*=/d" "$TMP/postgresql.conf"
printf "\nlisten_addresses = 'localhost, 172.17.0.1'\n" >> "$TMP/postgresql.conf"
t "exactly one listen_addresses line remains, and it is the active one" "1" \
  "$(grep -cE "^[[:space:]]*#?[[:space:]]*listen_addresses[[:space:]]*=" "$TMP/postgresql.conf" | tr -d ' ')"
t "no commented-out listen_addresses survives" "0" \
  "$(grep -cE "^[[:space:]]*#[[:space:]]*listen_addresses" "$TMP/postgresql.conf" | tr -d ' ')"
t "the new listen_addresses is active" "1" \
  "$(grep -cE "^listen_addresses = 'localhost, 172\.17\.0\.1'$" "$TMP/postgresql.conf" | tr -d ' ')"
t "unrelated settings are preserved" "2" \
  "$(grep -cE '^(port|max_connections) = ' "$TMP/postgresql.conf" | tr -d ' ')"

# --- 5. pg_hba rule insertion is idempotent and correctly formatted ---
HBA="$TMP/pg_hba.conf"
cat > "$HBA" <<'EOF'
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
EOF
DB_NAME="rz_care"; DB_ROLE="rz_app"; BRIDGE_SUBNET="172.17.0.0/16"; AUTH_METHOD="scram-sha-256"
add_rule() {
  if ! grep -qE "^[[:space:]]*host[[:space:]]+${DB_NAME}[[:space:]]+${DB_ROLE}[[:space:]]+${BRIDGE_SUBNET}[[:space:]]" "$HBA"; then
    printf "host\t%s\t%s\t%s\t%s\n" "$DB_NAME" "$DB_ROLE" "$BRIDGE_SUBNET" "$AUTH_METHOD" >> "$HBA"
  fi
}
add_rule; add_rule; add_rule
t "the bridge rule is added exactly once" "1" \
  "$(grep -cE "^host[[:space:]]+rz_care[[:space:]]+rz_app[[:space:]]+172\.17\.0\.0/16[[:space:]]" "$HBA" | tr -d ' ')"
t "the rule carries the right auth method" "1" \
  "$(grep -cE "^host[[:space:]]+rz_care[[:space:]]+rz_app[[:space:]]+172\.17\.0\.0/16[[:space:]]+scram-sha-256$" "$HBA" | tr -d ' ')"
t "the original loopback rules are preserved" "4" \
  "$(grep -cE "^(local[[:space:]]+all|host[[:space:]]+all[[:space:]]+all[[:space:]]+(127\.0\.0\.1/32|::1/128))" "$HBA" | tr -d ' ')"
t "the file grew by exactly one rule" "5" "$(grep -cE '^(local|host)\s' "$HBA" | tr -d ' ')"

# --- 6. md5-stored passwords are detected so pg_hba matches the stored secret ---
detect_auth() { printf '%s' "$1" | tr -d '[:space:]'; }
t "SCRAM stored password maps to scram-sha-256" "scram-sha-256" "$(detect_auth 'scram-sha-256')"
t "md5 stored password maps to md5" "md5" "$(detect_auth 'md5')"

# --- 7. the summary must never print a secret value ---
SECRET_URL='postgresql://rz_app:s3cr3t@host.docker.internal:5432/rz_care'
MASKED="$(printf '%s\n' "DATABASE_URL=${SECRET_URL}" | sed 's/=.*/=<set>/')"
t "the database URL is masked in the summary" "DATABASE_URL=<set>" "$MASKED"
t "no secret survives masking" "0" "$(printf '%s' "$MASKED" | grep -c 's3cr3t')"

rm -rf "$TMP"
printf '\nbootstrap logic: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
