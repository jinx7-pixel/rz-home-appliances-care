#!/usr/bin/env bash
#
# RZ Fixer - production deployment.
#
# Runs ON the VPS, invoked over SSH by .github/workflows/deploy.yml.
# Usage: deploy.sh <commit-sha> [--adopt-migration]
#
# Safety model
#   * Every step is idempotent and fails closed.
#   * The database is never reset, recreated or migrated destructively.
#   * The only permitted schema operation is `adopt`, which creates the
#     migration ledger and performs no DDL on application tables. It requires
#     the explicit --adopt-migration flag.
#   * Nginx is switched to Docker only after every container health check has
#     passed, and the previous configuration is restored automatically on any
#     failure.
#   * The previous PM2 deployment is never removed.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/rz-home-appliances-care}"
ENV_FILE="${ENV_FILE:-/etc/rzfixer/production.env}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/rz-care}"
NGINX_BACKUP_DIR="${NGINX_BACKUP_DIR:-/etc/nginx/sites-available}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/rzfixer}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://rzfixer.in}"
WWW_ORIGIN="${WWW_ORIGIN:-https://www.rzfixer.in}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
# The loopback port the frontend container publishes. It must match the port
# in the Compose file and in the rendered host Nginx configuration.
WEB_PORT="${WEB_PORT:-8080}"

TARGET_SHA="${1:-}"
ALLOW_ADOPT=0
[ "${2:-}" = "--adopt-migration" ] && ALLOW_ADOPT=1
# Switching the public traffic to the Docker stack is a separate, explicit
# gate. Without it the stack is deployed and verified on loopback while the
# public site keeps serving the previous deployment.
ALLOW_TRAFFIC_SWITCH=0
[ "${3:-}" = "--allow-traffic-switch" ] && ALLOW_TRAFFIC_SWITCH=1

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  OK\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mFAILED:\033[0m %s\n' "$*" >&2; exit 1; }

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"
ROLLBACK_DONE=0

on_error() {
  local code=$?
  warn "deploy.sh aborted at line ${BASH_LINENO} (exit ${code})"
  if [ "$ROLLBACK_DONE" -eq 0 ] && [ -f "${BACKUP_DIR}/rollback.env" ]; then
    warn "attempting automatic rollback"
    ( set +e; source "${BACKUP_DIR}/rollback.env"; rollback_restore )
    warn "rollback attempt finished"
  fi
  exit "$code"
}
trap on_error ERR

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
preflight() {
  log "Preflight"

  [ -n "$TARGET_SHA" ] || die "no target commit SHA supplied"
  [ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout"
  [ -f "$ENV_FILE" ] || die "$ENV_FILE is missing"
  [ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE is missing"
  command -v docker >/dev/null || die "docker is not installed"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 is not available"
  command -v node >/dev/null || die "node is not installed"

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$node_major" = "24" ] || die "node 24 is required, found $(node -v)"

  local free_mb
  free_mb="$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')"
  [ "${free_mb:-0}" -ge 2048 ] || die "insufficient disk space (${free_mb} MB free, need 2048 MB)"
  ok "disk space: ${free_mb} MB free"

  local avail_mb
  avail_mb="$(free -m | awk '/^Mem:/ {print $7}')"
  [ "${avail_mb:-0}" -ge 1024 ] || die "insufficient memory (${avail_mb} MB available)"
  ok "memory: ${avail_mb} MB available"

  git -C "$APP_DIR" rev-parse --verify "${TARGET_SHA}^{commit}" >/dev/null 2>&1 \
    || git -C "$APP_DIR" fetch --quiet origin "$TARGET_SHA" \
    || die "target commit $TARGET_SHA is not reachable"
  ok "target commit $TARGET_SHA is reachable"

  # The working tree must be clean, or every modified path must be byte
  # identical to the target commit. Unknown local edits are never discarded.
  local dirty
  dirty="$(git -C "$APP_DIR" status --porcelain=v1 -uall | awk '{print $2}')"
  if [ -n "$dirty" ]; then
    log "working tree has local modifications; reconciling against $TARGET_SHA"
    mkdir -p "${BACKUP_DIR}/vps-local-modifications"
    local f mismatch=0
    for f in $dirty; do
      if [ -e "${APP_DIR}/${f}" ]; then
        mkdir -p "${BACKUP_DIR}/vps-local-modifications/$(dirname "$f")"
        cp -a "${APP_DIR}/${f}" "${BACKUP_DIR}/vps-local-modifications/${f}"
      fi
      if ! git -C "$APP_DIR" cat-file -e "${TARGET_SHA}:${f}" 2>/dev/null; then
        warn "$f does not exist in $TARGET_SHA - local change would be lost"
        mismatch=1
      elif ! git -C "$APP_DIR" show "${TARGET_SHA}:${f}" | diff -q - "${APP_DIR}/${f}" >/dev/null 2>&1; then
        warn "$f differs from $TARGET_SHA - local change would be lost"
        mismatch=1
      else
        ok "$f matches $TARGET_SHA - safe to reconcile"
      fi
    done
    [ "$mismatch" -eq 0 ] || die "local modifications differ from the target commit; reconcile them first"
    ok "all local modifications are backed up and match the target commit"
  fi

  compose config --quiet >/dev/null 2>&1 || true   # validated after checkout

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_ROOT"
  ok "backup directory ready: $BACKUP_DIR"
}

# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------
checkout_step() {
  log "Checking out $TARGET_SHA"

  # Local modifications were backed up and proven identical to the target
  # commit during preflight, so this cannot discard unknown work.
  git -C "$APP_DIR" checkout --force --detach "$TARGET_SHA" || die "checkout of $TARGET_SHA failed"
  [ "$(git -C "$APP_DIR" rev-parse HEAD)" = "$(git -C "$APP_DIR" rev-parse "${TARGET_SHA}^{commit}")" ] \
    || die "checkout did not land on the target commit"
  ok "working tree is now at $(git -C "$APP_DIR" rev-parse --short HEAD)"

  [ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE is missing at the target commit"
  compose config --quiet || die "production compose file is invalid at the target commit"
  ok "production compose configuration is valid"
}

# ---------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------
backup() {
  log "Backing up current production state"

  mkdir -p "$BACKUP_DIR"

  # Nginx
  if [ -f "$NGINX_SITE" ]; then
    cp -a "$NGINX_SITE" "${BACKUP_DIR}/rz-care.nginx"
    ok "nginx configuration backed up"
  fi

  # The currently deployed commit and the live PM2 process.
  git -C "$APP_DIR" rev-parse HEAD > "${BACKUP_DIR}/deployed-commit.txt" 2>/dev/null || true
  pm2 jlist 2>/dev/null > "${BACKUP_DIR}/pm2-jlist.json" || true
  pm2 save --force >/dev/null 2>&1 || true
  ok "deployed commit recorded: $(cat "${BACKUP_DIR}/deployed-commit.txt" 2>/dev/null || echo unknown)"

  # Database backup: the safety net for every schema operation.
  if command -v pg_dump >/dev/null; then
    local dbname tmpdump
    dbname="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed -E 's#.*/([^/?]+)$#\1#')"
    # The dump is produced by the postgres operating-system user, which cannot
    # write into the root-owned backup directory. It is written to a scratch
    # directory owned by postgres and then moved into the protected backup
    # directory, which stays root-only.
    tmpdump="$(mktemp -d)"
    chown postgres:postgres "$tmpdump"
    if [ -n "$dbname" ] && su - postgres -c "pg_dump --format=custom --file='${tmpdump}/rz_care.dump' '${dbname}'" 2>/dev/null; then
      mv -f "${tmpdump}/rz_care.dump" "${BACKUP_DIR}/rz_care.dump"
      rm -rf "$tmpdump"
      if [ -s "${BACKUP_DIR}/rz_care.dump" ]; then
        chmod 600 "${BACKUP_DIR}/rz_care.dump"
        ok "database dump written (${dbname})"
        # Prove the dump is restorable before relying on it. Listing the
        # archive only reads the file, so it runs as the deploying user.
        if pg_restore --list "${BACKUP_DIR}/rz_care.dump" >/dev/null 2>&1; then
          ok "database dump verified readable by pg_restore"
        else
          die "database dump could not be listed by pg_restore - it is not a usable backup"
        fi
      else
        die "database dump is empty"
      fi
    else
      rm -rf "$tmpdump"
      die "pg_dump failed - refusing to continue without a verified backup"
    fi
  else
    die "pg_dump is not available - refusing to continue without a backup"
  fi

  # The static bundle currently served.
  if [ -d "${APP_DIR}/artifacts/rz-home-appliances-care/dist/public" ]; then
    cp -a "${APP_DIR}/artifacts/rz-home-appliances-care/dist/public" "${BACKUP_DIR}/dist-public"
    ok "frontend bundle backed up"
  fi

  cat > "${BACKUP_DIR}/rollback.env" <<ROLLBACK
PREV_COMMIT="$(cat "${BACKUP_DIR}/deployed-commit.txt" 2>/dev/null || echo '')"
PREV_NGINX="${BACKUP_DIR}/rz-care.nginx"
ROLLBACK
  ok "rollback descriptor written"
}

# ---------------------------------------------------------------------------
# Migration
# ---------------------------------------------------------------------------
migrate_step() {
  log "Database migration step"

  # The runner executes inside the API image, so the image must exist first.
  export DEPLOY_TAG="$TARGET_SHA"
  if ! docker image inspect "rzfixer-api:${TARGET_SHA}" >/dev/null 2>&1; then
    compose build --pull api || die "could not build the API image for the migration runner"
  fi

  # Always read-only first. `compose run` starts the namespace holder the
  # migration container shares, and never starts a database service.
  local check_out
  check_out="$(compose run --rm -T api node /app/lib/db/scripts/migrate.mjs check --database "${DB_NAME}" 2>&1)" || true
  printf '%s\n' "$check_out" | tail -5

  if printf '%s' "$check_out" | grep -qi "Explicit adoption required"; then
    warn "the production schema matches the expected fingerprint but has no migration ledger"
    if [ "$ALLOW_ADOPT" -ne 1 ]; then
      die "adoption is required but was not authorised (--adopt-migration). No schema was changed."
    fi
    log "running migration adopt (records the existing schema; no DDL on application tables)"
    compose run --rm -T api node /app/lib/db/scripts/migrate.mjs adopt --database "${DB_NAME}" \
      || die "migration adopt failed"
    ok "migration ledger created; application tables untouched"
  elif printf '%s' "$check_out" | grep -qi '"status":"verified"'; then
    ok "migration ledger already present and verified"
  else
    die "migration check did not report a verified or adoptable schema. Nothing was changed."
  fi
}

# ---------------------------------------------------------------------------
# Containers
# ---------------------------------------------------------------------------
start_containers() {
  log "Building and starting containers for $TARGET_SHA"

  export DEPLOY_TAG="$TARGET_SHA"
  compose build --pull api frontend || die "image build failed"
  ok "images built: rzfixer-api:${TARGET_SHA}, rzfixer-frontend:${TARGET_SHA}"

  # The API container health check requires the migration ledger, so the
  # migration step must already have run before the container can be healthy.
  compose up -d --no-build api || die "api container failed to start"
  log "waiting for the API container to become healthy"
  wait_healthy "rzfixer-api" || die "api container did not become healthy"
  ok "api container healthy"

  compose up -d --no-build frontend || die "frontend container failed to start"
  log "waiting for the frontend container to become healthy"
  wait_healthy "rzfixer-frontend" || die "frontend container did not become healthy"
  ok "frontend container healthy"

  # Verify the API answers on the container loopback before touching Nginx.
  curl -fsS --max-time 10 "http://127.0.0.1:${WEB_PORT:-8080}/api/healthz" >/dev/null \
    || die "frontend container is not serving the API"
  ok "API reachable through the frontend container"
}

wait_healthy() {
  local name="$1" deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local state
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || echo missing)"
    case "$state" in
      healthy) return 0 ;;
      unhealthy) warn "$name reported unhealthy"; return 1 ;;
      exited|dead) warn "$name exited"; return 1 ;;
    esac
    sleep 3
  done
  warn "$name did not become healthy within ${HEALTH_TIMEOUT}s"
  return 1
}

# ---------------------------------------------------------------------------
# Nginx switch
# ---------------------------------------------------------------------------
switch_nginx() {
  log "Switching Nginx to the Docker stack"

  local template="${APP_DIR}/docker/nginx.host.conf"
  [ -f "$template" ] || die "host nginx template not found at $template"

  # The template carries a shell placeholder for the published port. Nginx
  # cannot parse shell syntax, so the placeholder is rendered before the file
  # is installed. Only the port placeholder is substituted: every other dollar
  # sign in the template is an Nginx variable and must survive untouched.
  sed "s|\${WEB_PORT:-8080}|${WEB_PORT}|g" "$template" > "$NGINX_SITE"
  if grep -q '\${' "$NGINX_SITE"; then
    cp -a "${BACKUP_DIR}/rz-care.nginx" "$NGINX_SITE"
    die "the rendered nginx configuration still contains a shell placeholder - previous configuration restored"
  fi
  nginx -t || { cp -a "${BACKUP_DIR}/rz-care.nginx" "$NGINX_SITE"; nginx -t || true; die "nginx configuration invalid - restored the previous configuration"; }
  systemctl reload nginx || { cp -a "${BACKUP_DIR}/rz-care.nginx" "$NGINX_SITE"; nginx -t && systemctl reload nginx || true; die "nginx reload failed - restored the previous configuration"; }
  ok "nginx now routes to the Docker stack"
}

# ---------------------------------------------------------------------------
# Public health checks
# ---------------------------------------------------------------------------
public_health_checks() {
  log "Public health checks"

  curl -fsS --max-time 20 "${PUBLIC_ORIGIN}/" -o /dev/null || die "public site is not serving"
  ok "public site responds"

  curl -fsS --max-time 20 "${PUBLIC_ORIGIN}/api/healthz" -o /dev/null || die "public API health check failed"
  ok "public API health check passes"

  local asset
  asset="$(curl -fsS --max-time 20 "${PUBLIC_ORIGIN}/" | grep -oE '/assets/[A-Za-z0-9._-]+\.js' | head -1)"
  if [ -n "$asset" ]; then
    curl -fsS --max-time 20 "${PUBLIC_ORIGIN}${asset}" -o /dev/null || die "frontend asset ${asset} did not load"
    ok "frontend asset loads: ${asset}"
  else
    warn "no frontend asset reference found in the served HTML"
  fi

  local loc
  loc="$(curl -sSI --max-time 20 "${WWW_ORIGIN}/" | grep -i '^location:' | tr -d '\r' | awk '{print $2}')"
  case "$loc" in
    "${PUBLIC_ORIGIN}/"*) ok "www redirect target correct: ${loc}" ;;
    *) die "www did not redirect to ${PUBLIC_ORIGIN}/ (got '${loc}')" ;;
  esac

  # The admin origin check must accept a same-origin request. A 403 here is the
  # X-Forwarded-Proto regression and must fail the deployment.
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "${PUBLIC_ORIGIN}/api/admin/auth/login" \
        -H "Origin: ${PUBLIC_ORIGIN}" -H 'Content-Type: application/json' --data '{}')"
  case "$code" in
    403) die "admin origin validation rejected a same-origin request (403) - X-Forwarded-Proto is wrong" ;;
    400|401|200) ok "admin origin validation accepts a same-origin request (HTTP ${code})" ;;
    *) die "admin origin validation returned unexpected HTTP ${code}" ;;
  esac

  # The public repair-request endpoint must accept a valid-shaped request
  # without creating a record: an invalid body is rejected after validation.
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "${PUBLIC_ORIGIN}/api/repair-requests" \
        -H 'Content-Type: application/json' --data '{"customerName":"x"}')"
  case "$code" in
    400) ok "repair-request validation is active (HTTP 400 for an invalid body)" ;;
    429) warn "repair-request rate limit is already exhausted" ;;
    *) die "repair-request endpoint returned unexpected HTTP ${code}" ;;
  esac

  ok "all public health checks passed"
}

# ---------------------------------------------------------------------------
# Loopback health checks
#
# Used when the public traffic switch is not authorised. The stack is verified
# on the loopback port exactly as the public edge would reach it, so the
# X-Forwarded-Proto handling and the client address handling are exercised
# against the real container stack before any public traffic is switched.
# ---------------------------------------------------------------------------
loopback_health_checks() {
  local base="http://127.0.0.1:${WEB_PORT}"
  log "Loopback health checks (public traffic is NOT switched)"

  curl -fsS --max-time 20 "${base}/" -o /dev/null || die "the frontend container is not serving on ${base}"
  ok "frontend container serves the site"

  curl -fsS --max-time 20 "${base}/api/healthz" -o /dev/null || die "the API container is not healthy on ${base}"
  ok "API container health check passes through the frontend"

  local asset
  asset="$(curl -fsS --max-time 20 "${base}/" | grep -oE '/assets/[A-Za-z0-9._-]+\.js' | head -1)"
  if [ -n "$asset" ]; then
    curl -fsS --max-time 20 "${base}${asset}" -o /dev/null || die "frontend asset ${asset} did not load"
    ok "frontend asset loads: ${asset}"
  else
    warn "no frontend asset reference found in the served HTML"
  fi

  # The admin origin check must accept a same-origin request that arrives the
  # way the public edge delivers it. A 403 here is the X-Forwarded-Proto
  # regression and must fail the deployment.
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "${base}/api/admin/auth/login" \
        -H "Origin: ${PUBLIC_ORIGIN}" -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-For: 203.0.113.9' \
        -H 'Content-Type: application/json' --data '{}')"
  case "$code" in
    403) die "admin origin validation rejected a same-origin request (403) - X-Forwarded-Proto is wrong" ;;
    400|401|200) ok "admin origin validation accepts a same-origin request (HTTP ${code})" ;;
    *) die "admin origin validation returned unexpected HTTP ${code}" ;;
  esac

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "${base}/api/admin/auth/login" \
        -H "Origin: https://evil.example" -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-For: 203.0.113.9' \
        -H 'Content-Type: application/json' --data '{}')"
  case "$code" in
    403) ok "admin origin validation rejects a cross-origin request (403)" ;;
    *) die "admin origin validation accepted a cross-origin request (HTTP ${code})" ;;
  esac

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "${base}/api/repair-requests" \
        -H 'Content-Type: application/json' --data '{"customerName":"x"}')"
  case "$code" in
    400) ok "repair-request validation is active (HTTP 400 for an invalid body)" ;;
    429) warn "repair-request rate limit is already exhausted" ;;
    *) die "repair-request endpoint returned unexpected HTTP ${code}" ;;
  esac

  ok "all loopback health checks passed"
}

# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------
rollback_restore() {
  log "ROLLBACK: restoring the previous production state"

  export DEPLOY_TAG="${DEPLOY_TAG:-previous}"

  # 1. Stop the new application version.
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans >/dev/null 2>&1 || true
  ok "docker stack stopped"

  # 2. Restore the previous Nginx configuration.
  if [ -f "${BACKUP_DIR}/rz-care.nginx" ]; then
    cp -a "${BACKUP_DIR}/rz-care.nginx" "$NGINX_SITE"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx && ok "nginx configuration restored"
  fi

  # 3. Restore the previous static bundle.
  if [ -d "${BACKUP_DIR}/dist-public" ]; then
    rm -rf "${APP_DIR}/artifacts/rz-home-appliances-care/dist/public"
    cp -a "${BACKUP_DIR}/dist-public" "${APP_DIR}/artifacts/rz-home-appliances-care/dist/public"
    ok "frontend bundle restored"
  fi

  # 4. Restore the previously deployed commit and restart the old runtime.
  if [ -n "${PREV_COMMIT:-}" ] && git -C "$APP_DIR" cat-file -e "${PREV_COMMIT}^{commit}" 2>/dev/null; then
    git -C "$APP_DIR" checkout --force --detach "$PREV_COMMIT" >/dev/null 2>&1 || true
    ok "repository restored to ${PREV_COMMIT}"
  fi
  pm2 restart rz-api --update-env >/dev/null 2>&1 || true
  pm2 save --force >/dev/null 2>&1 || true
  ok "PM2 application restarted"

  # 5. Verify the public site is back.
  if curl -fsS --max-time 20 "${PUBLIC_ORIGIN}/" -o /dev/null; then
    ok "public site is serving again"
  else
    warn "public site did NOT recover - manual intervention required"
  fi

  ROLLBACK_DONE=1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "RZ Fixer production deployment"
  log "target commit : ${TARGET_SHA}"
  log "app dir       : ${APP_DIR}"
  log "env file      : ${ENV_FILE}"
  log "public origin : ${PUBLIC_ORIGIN}"
  log "adopt allowed : $([ "$ALLOW_ADOPT" -eq 1 ] && echo yes || echo no)"
  log "traffic switch: $([ "$ALLOW_TRAFFIC_SWITCH" -eq 1 ] && echo authorised || echo 'not authorised - the public site keeps serving the previous deployment')"

  cd "$APP_DIR"
  DB_NAME="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed -E 's#.*/([^/?]+)$#\1#')"
  [ -n "$DB_NAME" ] || die "cannot determine the database name from DATABASE_URL"

  preflight
  backup
  checkout_step
  migrate_step
  start_containers
  if [ "$ALLOW_TRAFFIC_SWITCH" -eq 1 ]; then
    switch_nginx
    public_health_checks
  else
    log "TRAFFIC SWITCH NOT AUTHORISED: the public site keeps serving the previous deployment"
    ok "the Docker stack is live on 127.0.0.1:${WEB_PORT} and verified"
    loopback_health_checks
  fi

  log "DEPLOYMENT SUCCESSFUL"
  log "  commit       : ${TARGET_SHA}"
  log "  images       : rzfixer-api:${TARGET_SHA}, rzfixer-frontend:${TARGET_SHA}"
  log "  services     : $(compose config --services | tr '\n' ' ')"
  log "  traffic      : $([ "$ALLOW_TRAFFIC_SWITCH" -eq 1 ] && echo 'switched to the Docker stack' || echo 'NOT switched - the public site still serves the previous deployment')"
  log "  backup       : ${BACKUP_DIR}"
  log "  rollback     : bash ${APP_DIR}/scripts/deploy/deploy.sh --rollback ${BACKUP_DIR}"
  {
    echo "## RZ Fixer production deployment"
    echo
    echo "- Commit: \`${TARGET_SHA}\`"
    echo "- Images: \`rzfixer-api:${TARGET_SHA}\`, \`rzfixer-frontend:${TARGET_SHA}\`"
    echo "- Services: $(compose config --services | tr '\n' ' ')"
    echo "- Public: ${PUBLIC_ORIGIN}"
    echo "- Traffic: $([ "$ALLOW_TRAFFIC_SWITCH" -eq 1 ] && echo 'switched to the Docker stack' || echo 'NOT switched - the public site still serves the previous deployment')"
    echo "- Backup: \`${BACKUP_DIR}\`"
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

if [ "${1:-}" = "--rollback" ]; then
  BACKUP_DIR="${2:?backup directory required}"
  [ -f "${BACKUP_DIR}/rollback.env" ] || die "no rollback descriptor in ${BACKUP_DIR}"
  # shellcheck disable=SC1090
  source "${BACKUP_DIR}/rollback.env"
  BACKUP_DIR="${2}"
  rollback_restore
  exit 0
fi

main "$@"
