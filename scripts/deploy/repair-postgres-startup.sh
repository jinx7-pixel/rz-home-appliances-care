#!/usr/bin/env bash
# Repair the PostgreSQL/Docker boot race without changing database data or users.
# --configure-only installs startup ordering without restarting the database.
set -euo pipefail

render_address_guard() {
  cat <<'GUARD'
#!/bin/sh
# PostgreSQL otherwise starts successfully while skipping the missing address.
gateway=$1
attempt=0
while [ "$attempt" -lt 30 ]; do
  if ip -4 -o addr show | awk -v expected="$gateway" '
    { split($4, addr, "/"); if (addr[1] == expected) found=1 }
    END { exit !found }'; then
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 1
done
echo "PostgreSQL startup blocked: Docker address $gateway is unavailable" >&2
exit 1
GUARD
}

render_startup_unit() {
  cat <<EOF
[Unit]
# Wait for Docker to finish creating its host bridge before binding PostgreSQL.
Wants=docker.service
After=docker.service

[Service]
ExecStartPre=/usr/local/libexec/rzfixer-wait-docker-address $1
EOF
}

repair_main() {
  local configure_only=0
  if [ "${1:-}" = "--configure-only" ]; then configure_only=1; shift; fi
  [ "$#" -eq 0 ] || { echo "Unexpected arguments" >&2; return 1; }
  [ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; return 1; }
  local version="${PG_VERSION:-16}" gateway="${BRIDGE_GW:-172.17.0.1}"
  [[ "$version" =~ ^[0-9]+$ ]] || return 1
  [[ "$gateway" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  local unit="postgresql@${version}-main.service"
  local dropin="/etc/systemd/system/${unit}.d/30-rzfixer-docker.conf"
  local guard="/usr/local/libexec/rzfixer-wait-docker-address"
  local backup="/var/backups/rzfixer/postgres-startup-$(date -u +%Y%m%d-%H%M%S)-$$"
  systemctl is-active --quiet docker.service
  # Fail before writes if Docker has not assigned the address.
  render_address_guard | sh -s -- "$gateway"
  pg_conftool "$version" main show listen_addresses
  install -d -m 700 "$backup"
  cp -a "/etc/postgresql/${version}/main/postgresql.conf" "$backup/postgresql.conf"
  cp -a "/etc/postgresql/${version}/main/pg_hba.conf" "$backup/pg_hba.conf"
  systemctl cat "$unit" > "$backup/service-before.txt"
  [ ! -e "$dropin" ] || cp -a "$dropin" "$backup/dropin-before.conf"
  [ ! -e "$guard" ] || cp -a "$guard" "$backup/guard-before.sh"
  printf 'Configuration backup: %s\n' "$backup"
  install -d -m 755 "$(dirname "$dropin")" "$(dirname "$guard")"
  # Restore only the two files this repair owns if installation/restart fails.
  local completed=0
  trap 'code=$?; trap - EXIT; if [ "$completed" -eq 0 ]; then
    if [ -e "$backup/dropin-before.conf" ]; then cp -a "$backup/dropin-before.conf" "$dropin"; else rm -f -- "$dropin"; fi
    if [ -e "$backup/guard-before.sh" ]; then cp -a "$backup/guard-before.sh" "$guard"; else rm -f -- "$guard"; fi
    systemctl daemon-reload
    systemctl start "$unit" || true
    echo "Startup configuration restored after repair failure" >&2
  fi; exit "$code"' EXIT
  render_address_guard > "$guard"
  chmod 755 "$guard"
  render_startup_unit "$gateway" > "$dropin"
  chmod 644 "$dropin"
  systemctl daemon-reload
  systemd-analyze verify "$unit"
  systemctl show "$unit" -p After -p Wants -p DropInPaths
  if [ "$configure_only" -eq 1 ]; then
    completed=1
    trap - EXIT
    echo "PostgreSQL Docker startup ordering installed; no restart requested"
    return 0
  fi
  # SHOW listen_addresses can be correct while the actual socket is missing.
  if ! pg_isready -h "$gateway" -p 5432 -t 3; then
    echo "Restarting only $unit to restore the missing bridge listener"
    systemctl restart "$unit"
  fi
  pg_isready -h "$gateway" -p 5432 -t 5
  ss -ltnp 'sport = :5432'
  completed=1
  trap - EXIT
  # Test application DB access, not just the unconditional HTTP health endpoint.
  docker exec rzfixer-api-1 node /app/docker/api-healthcheck.mjs
  local status
  status=$(curl --fail --silent --show-error --max-time 20 https://rzfixer.in/api/site-status)
  printf 'Public site status: %s\n' "$status"
  printf '%s' "$status" | python3 -c 'import json,sys; data=json.load(sys.stdin); assert data.get("enabled") is True, "Public website is disabled; its admin setting was not changed"'
  local attempt
  for attempt in $(seq 1 30); do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' rzfixer-api-1)" = healthy ]; then
      docker ps --format '{{.Names}}\t{{.Status}}'
      echo "REPAIR VERIFIED: PostgreSQL listener, database readiness and public site status"
      return 0
    fi
    sleep 2
  done
  echo "Listener restored, but Docker health has not recovered; inspect API health logs" >&2
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  repair_main "$@"
fi
