#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# RZ Fixer - one-time VPS bootstrap for the Docker production stack.
#
# Usage:  bash scripts/deploy/bootstrap-vps.sh [--check]
#
# This prepares the VPS so that scripts/deploy/deploy.sh can run. It is
# idempotent and safe to re-run. It NEVER prints a secret value.
#
#   1. Installs Docker Engine + Docker Compose v2 (if missing) and enables it.
#   2. Makes the existing native PostgreSQL reachable from the Docker bridge,
#      without changing the database, the role or the password.
#   3. Creates /etc/rzfixer/production.env (mode 600), reusing the credentials
#      that the running PM2 process already has, so no secret transits chat.
#   4. Backs up the working-tree files that differ from the deployed commit.
#
# It does NOT touch the database, does not run migrations, does not switch
# Nginx traffic and does not stop PM2. The PM2 deployment keeps serving until
# the Docker deployment has been verified.
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/rz-home-appliances-care}"
ENV_DIR="${ENV_DIR:-/etc/rzfixer}"
ENV_FILE="${ENV_FILE:-${ENV_DIR}/production.env}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://rzfixer.in}"
PG_VERSION="${PG_VERSION:-16}"
PG_CONF_DIR="${PG_CONF_DIR:-/etc/postgresql/${PG_VERSION}/main}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/rzfixer}"
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

log()  { printf '[bootstrap] %s\n' "$*"; }
ok()   { printf '[bootstrap]   ok: %s\n' "$*"; }
warn() { printf '[bootstrap]   warn: %s\n' "$*" >&2; }
die()  { printf '[bootstrap] FATAL: %s\n' "$*" >&2; exit 1; }

# The database name is the last path segment of the URL. A URL without a path
# (for example "postgresql://user:pw@host:5432") has no database name, and its
# last slash belongs to the "://" scheme separator rather than to a path.
database_name_from_url() {
  local url="${1%%\?*}"
  url="${url%/}"
  local name="${url##*/}"
  case "$name" in
    *:*) name="" ;;
  esac
  printf '%s' "$name"
}

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/bootstrap-${STAMP}"

command -v apt-get >/dev/null || die "apt-get not found; this script targets Ubuntu"

# ---------------------------------------------------------------------------
# 1. Docker Engine + Compose v2
# ---------------------------------------------------------------------------
install_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
    ok "docker and docker compose v2 already present: $(docker --version)"
    return 0
  fi
  if [ "$CHECK_ONLY" -eq 1 ]; then
    warn "docker and/or docker compose v2 would be installed"
    return 0
  fi
  log "installing docker engine and compose v2"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
  ok "docker installed: $(docker --version)"
  ok "compose v2 installed: $(docker compose version)"
}

# ---------------------------------------------------------------------------
# 2. PostgreSQL reachable from the Docker bridge
# ---------------------------------------------------------------------------
configure_postgres() {
  [ -f "${PG_CONF_DIR}/postgresql.conf" ] || die "${PG_CONF_DIR}/postgresql.conf not found"
  [ -f "${PG_CONF_DIR}/pg_hba.conf" ] || die "${PG_CONF_DIR}/pg_hba.conf not found"

  BRIDGE_GW=""
  BRIDGE_SUBNET=""
  if command -v docker >/dev/null; then
    BRIDGE_GW="$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null | head -1)"
    BRIDGE_SUBNET="$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null | head -1)"
  fi
  if [ -z "$BRIDGE_GW" ] || [ -z "$BRIDGE_SUBNET" ]; then
    if [ "$CHECK_ONLY" -eq 1 ]; then
      warn "docker is not installed yet, so the bridge address cannot be determined; it will be read after docker is installed"
      BRIDGE_GW="<bridge-gateway>"
      BRIDGE_SUBNET="<bridge-subnet>"
    else
      die "could not determine the docker bridge address"
    fi
  fi

  DB_NAME="$(database_name_from_url "${DATABASE_URL:-postgresql://rz_app@127.0.0.1:5432/rz_care}")"
  DB_NAME="${DB_NAME:-rz_care}"
  DB_ROLE="${DB_ROLE:-rz_app}"

  # Match the pg_hba method to how the role password is actually stored.
  AUTH_METHOD="scram-sha-256"
  if command -v psql >/dev/null && id postgres >/dev/null 2>&1; then
    stored="$(su - postgres -c "psql -tAc \"SELECT CASE WHEN rolpassword LIKE 'SCRAM%' THEN 'scram-sha-256' ELSE 'md5' END FROM pg_authid WHERE rolname='${DB_ROLE}'\"" 2>/dev/null | tr -d '[:space:]' || true)"
    [ -n "$stored" ] && AUTH_METHOD="$stored"
  fi
  ok "bridge gateway=${BRIDGE_GW} subnet=${BRIDGE_SUBNET} pg_hba method=${AUTH_METHOD} (existing database, role and password are unchanged)"

  if [ "$CHECK_ONLY" -eq 1 ]; then
    warn "would set listen_addresses to include ${BRIDGE_GW} and add a pg_hba rule for ${BRIDGE_SUBNET}"
    return 0
  fi

  install -d -m 700 "$BACKUP_DIR"
  cp -a "${PG_CONF_DIR}/postgresql.conf" "${BACKUP_DIR}/postgresql.conf.bak"
  cp -a "${PG_CONF_DIR}/pg_hba.conf" "${BACKUP_DIR}/pg_hba.conf.bak"

  # listen_addresses: replace any active or commented default with our value.
  sed -i "/^[[:space:]]*#\?[[:space:]]*listen_addresses[[:space:]]*=/d" "${PG_CONF_DIR}/postgresql.conf"
  printf "\nlisten_addresses = 'localhost, %s'\n" "$BRIDGE_GW" >> "${PG_CONF_DIR}/postgresql.conf"
  ok "listen_addresses now includes ${BRIDGE_GW} (previous file backed up)"

  if ! grep -qE "^[[:space:]]*host[[:space:]]+${DB_NAME}[[:space:]]+${DB_ROLE}[[:space:]]+${BRIDGE_SUBNET}[[:space:]]" "${PG_CONF_DIR}/pg_hba.conf"; then
    printf "host\t%s\t%s\t%s\t%s\n" "$DB_NAME" "$DB_ROLE" "$BRIDGE_SUBNET" "$AUTH_METHOD" >> "${PG_CONF_DIR}/pg_hba.conf"
    ok "pg_hba rule added for ${DB_ROLE}@${DB_NAME} from ${BRIDGE_SUBNET}"
  else
    ok "pg_hba rule already present for ${BRIDGE_SUBNET}"
  fi

  if ! grep -qE "^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+${BRIDGE_SUBNET}[[:space:]]" "${PG_CONF_DIR}/pg_hba.conf"; then
    printf "host\tall\tall\t%s\t%s\n" "$BRIDGE_SUBNET" "$AUTH_METHOD" >> "${PG_CONF_DIR}/pg_hba.conf"
    warn "added a broad 'host all all ${BRIDGE_SUBNET}' rule so that every container in the bridge subnet is reachable; tighten it if other roles are added later"
  fi

  log "reloading postgres"
  systemctl reload postgresql || systemctl restart postgresql
  ok "postgres reloaded; a short restart is expected only if listen_addresses was not yet live"
}

# ---------------------------------------------------------------------------
# 3. Production environment file
# ---------------------------------------------------------------------------
write_env_file() {
  if [ -f "$ENV_FILE" ]; then
    ok "environment file already exists at ${ENV_FILE} (left untouched)"
    return 0
  fi

  # Reuse the credentials the running PM2 process already has, so that no
  # secret is ever printed, copied through chat or written into the repo.
  pm2_env() {
    pm2 env 0 2>/dev/null | awk -F': ' -v k="$1" '$1==k{print $2; exit}' || true
  }

  DB_URL="$(pm2_env DATABASE_URL)"
  [ -n "$DB_URL" ] || die "could not read DATABASE_URL from the running pm2 process; create ${ENV_FILE} manually"
  # Containers must reach the host database through the bridge gateway, never
  # through their own loopback interface.
  DB_URL="${DB_URL/127.0.0.1/host.docker.internal}"
  DB_URL="${DB_URL/localhost/host.docker.internal}"

  ADMIN_PW="$(pm2_env ADMIN_PASSWORD)"
  EMAIL_FROM="$(pm2_env EMAIL_FROM)"
  OWNER_MAIL="$(pm2_env OWNER_EMAIL)"
  SMTP_HOST_V="$(pm2_env SMTP_HOST)"
  SMTP_PORT_V="$(pm2_env SMTP_PORT)"
  SMTP_SECURE_V="$(pm2_env SMTP_SECURE)"
  SMTP_REQUIRE_V="$(pm2_env SMTP_REQUIRE_TLS)"
  SMTP_USER_V="$(pm2_env SMTP_USER)"
  SMTP_PW="$(pm2_env SMTP_APP_PASSWORD)"
  NODE_ENV_V="$(pm2_env NODE_ENV)"

  ADMIN_PW="${ADMIN_PASSWORD:-$ADMIN_PW}"
  EMAIL_FROM="${EMAIL_FROM:-$EMAIL_FROM}"
  OWNER_MAIL="${OWNER_EMAIL:-$OWNER_MAIL}"
  SMTP_HOST_V="${SMTP_HOST:-$SMTP_HOST_V}"
  SMTP_PORT_V="${SMTP_PORT:-${SMTP_PORT_V:-587}}"
  SMTP_SECURE_V="${SMTP_SECURE:-${SMTP_SECURE_V:-false}}"
  SMTP_REQUIRE_V="${SMTP_REQUIRE_TLS:-${SMTP_REQUIRE_V:-true}}"
  SMTP_USER_V="${SMTP_USER:-$SMTP_USER_V}"
  SMTP_PW="${SMTP_APP_PASSWORD:-$SMTP_PW}"
  NODE_ENV_V="${NODE_ENV:-${NODE_ENV_V:-production}}"

  [ -n "$ADMIN_PW" ] || die "ADMIN_PASSWORD was not found in the pm2 environment; export it before running this script"
  [ -n "$SMTP_HOST_V" ] || warn "SMTP_HOST was not found in the pm2 environment; repair-request email delivery will not work"

  if [ "$CHECK_ONLY" -eq 1 ]; then
    warn "would create ${ENV_FILE} with mode 600"
    return 0
  fi

  install -d -m 750 "$ENV_DIR"
  umask 077
  {
    echo "# RZ Fixer production environment. Never committed, never printed."
    echo "NODE_ENV=${NODE_ENV_V}"
    echo "DATABASE_URL=${DB_URL}"
    echo "APP_BASE_URL=${PUBLIC_ORIGIN}"
    echo "APP_BASE_PATH=/"
    echo "ADMIN_PASSWORD=${ADMIN_PW}"
    echo "EMAIL_FROM=${EMAIL_FROM}"
    echo "OWNER_EMAIL=${OWNER_MAIL}"
    echo "SMTP_HOST=${SMTP_HOST_V}"
    echo "SMTP_PORT=${SMTP_PORT_V}"
    echo "SMTP_SECURE=${SMTP_SECURE_V}"
    echo "SMTP_REQUIRE_TLS=${SMTP_REQUIRE_V}"
    echo "SMTP_USER=${SMTP_USER_V}"
    echo "SMTP_APP_PASSWORD=${SMTP_PW}"
    echo "LOG_LEVEL=info"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "created ${ENV_FILE} (mode 600) with credentials reused from the running pm2 process"
}

# ---------------------------------------------------------------------------
# 4. Back up working-tree files that differ from the deployed commit
# ---------------------------------------------------------------------------
backup_dirty_tree() {
  [ -d "${APP_DIR}/.git" ] || die "${APP_DIR} is not a git checkout"
  command -v git >/dev/null || die "git is not installed"

  dirty="$(git -C "$APP_DIR" status --porcelain=v1 -uall | awk '{print $2}' || true)"
  if [ -z "$dirty" ]; then
    ok "working tree is clean"
    return 0
  fi
  if [ "$CHECK_ONLY" -eq 1 ]; then
    warn "working tree has local modifications that would be backed up:"
    printf '%s\n' "$dirty" | sed 's/^/         /' >&2
    return 0
  fi
  install -d -m 700 "${BACKUP_DIR}/vps-local-modifications"
  for f in $dirty; do
    if [ -e "${APP_DIR}/${f}" ]; then
      mkdir -p "${BACKUP_DIR}/vps-local-modifications/$(dirname "$f")"
      cp -a "${APP_DIR}/${f}" "${BACKUP_DIR}/vps-local-modifications/${f}"
    fi
    status="differs from the target commit"
    if [ -n "$DEPLOY_COMMIT" ] && git -C "$APP_DIR" cat-file -e "${DEPLOY_COMMIT}:${f}" 2>/dev/null; then
      if git -C "$APP_DIR" show "${DEPLOY_COMMIT}:${f}" | diff -q - "${APP_DIR}/${f}" >/dev/null 2>&1; then
        status="matches ${DEPLOY_COMMIT} (safe to reconcile)"
      fi
    fi
    warn "backed up ${f} - ${status}"
  done
  ok "local modifications backed up to ${BACKUP_DIR}/vps-local-modifications"
}

# ---------------------------------------------------------------------------
main() {
  log "RZ Fixer VPS bootstrap (APP_DIR=${APP_DIR})"
  [ "$CHECK_ONLY" -eq 1 ] && log "running in --check mode: nothing will be changed"

  install_docker
  configure_postgres
  write_env_file
  backup_dirty_tree

  log ""
  log "summary (no secret values are printed):"
  printf '  docker          : %s\n' "$(docker --version 2>/dev/null || echo 'missing')"
  printf '  compose         : %s\n' "$(docker compose version 2>/dev/null || echo 'missing')"
  printf '  postgres listen : %s\n' "$(grep -E "^[[:space:]]*listen_addresses" "${PG_CONF_DIR}/postgresql.conf" 2>/dev/null | tail -1 | sed 's/^[[:space:]]*//' || echo 'unknown')"
  printf '  env file        : %s\n' "$([ -f "$ENV_FILE" ] && echo "$ENV_FILE (mode $(stat -c '%a' "$ENV_FILE"))" || echo 'missing')"
  printf '  env keys        : %s\n' "$([ -f "$ENV_FILE" ] && sed 's/=.*/=<set>/' "$ENV_FILE" | tr '\n' ' ' || echo 'n/a')"
  printf '  backups         : %s\n' "$BACKUP_DIR"
  printf '  pm2 still live  : %s\n' "$(pm2 jlist 2>/dev/null | grep -c rz-api || echo 0)"
  log "bootstrap complete. The PM2 deployment is still serving traffic."
}

main "$@"
