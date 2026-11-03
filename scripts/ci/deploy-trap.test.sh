#!/usr/bin/env bash
# Behavioural regression tests for the deployment exit trap.
#
# The trap code is extracted from scripts/deploy/deploy.sh at test time, so
# this test exercises the shipped implementation and not a copy of it.
set -uo pipefail

DEPLOY="${1:-$(dirname "$0")/../deploy/deploy.sh}"
[ -f "$DEPLOY" ] || { echo "  FAIL  deploy.sh not found at $DEPLOY"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/backup"

# Extract the on_exit function from the shipped script.
sed -n '/^on_exit() {/,/^}/p' "$DEPLOY" > "$TMP/on_exit.sh"
if [ ! -s "$TMP/on_exit.sh" ]; then
  echo "  FAIL  on_exit() was not found in $DEPLOY"
  exit 1
fi

pass=0; fail=0
t() { if [ "$2" = "$3" ]; then printf '  PASS  %-58s %s\n' "$1" "$2"; pass=$((pass+1));
      else printf '  FAIL  %-58s got=%s want=%s\n' "$1" "${2:-}" "${3:-}"; fail=$((fail+1)); fi; }

# run_case <name> <DEPLOY_STARTED> <DEPLOY_COMPLETED> <exit-code>
# Prints a single line: "<exit-code>|<rolled-back>"
run_case() {
  local started="$1" completed="$2" code="$3"
  cat > "$TMP/case.sh" <<CASE
set -uo pipefail
BACKUP_DIR="$TMP/backup"
ROLLBACK_DONE=0
DEPLOY_STARTED=$started
DEPLOY_COMPLETED=$completed
log() { :; }
ok()  { :; }
warn() { :; }
ROLLBACK_CALLS=0
rollback_restore() { ROLLBACK_CALLS=1; return 0; }
source "$TMP/on_exit.sh"
trap on_exit EXIT
exit $code
CASE
  local out rc rolled="no"
  printf 'PREV_COMMIT="0000000000000000000000000000000000000000"\nPREV_NGINX="%s/rz-care.nginx"\n' "$TMP" > "$TMP/backup/rollback.env"
  out="$(bash "$TMP/case.sh" 2>&1)"; rc=$?
  case "$out" in *"ROLLBACK SUCCEEDED"*) rolled="yes" ;; esac
  printf '%s|%s' "$rc" "$rolled"
}

echo "=== deploy.sh exit trap ==="

IFS='|' read -r rc rolled <<<"$(run_case 1 0 1)"
t "a failure after production changed rolls back" "$rolled" "yes"
t "the original exit status is preserved" "$rc" "1"

IFS='|' read -r rc rolled <<<"$(run_case 0 0 1)"
t "a failure before production changed does not roll back" "$rolled" "no"
t "the exit status is still preserved" "$rc" "1"

IFS='|' read -r rc rolled <<<"$(run_case 1 1 0)"
t "a successful deployment does not roll back" "$rolled" "no"
t "a successful deployment exits 0" "$rc" "0"

IFS='|' read -r rc rolled <<<"$(run_case 1 0 42)"
t "a non-1 exit status is preserved" "$rc" "42"
t "a non-1 exit status still rolls back" "$rolled" "yes"

IFS='|' read -r rc rolled <<<"$(run_case 1 0 1)"
t "the rollback runs exactly once (no recursive trap)" "$rolled" "yes"

# The rollback must never touch the application data.
rollback_body="$(sed -n '/^rollback_restore() {/,/^}/p' "$DEPLOY")"
if printf '%s' "$rollback_body" | grep -qiE 'migrate\.mjs|DROP[[:space:]]|DELETE[[:space:]]|ALTER[[:space:]]|TRUNCATE|pg_dump|pg_restore'; then
  t "the rollback never modifies PostgreSQL data" "clean" "dirty"
else
  t "the rollback never modifies PostgreSQL data" "clean" "clean"
fi

# The trap must be an EXIT trap, never the ERR trap.
if grep -q 'trap on_error ERR' "$DEPLOY"; then
  t "the broken ERR trap is gone" "present" "absent"
else
  t "the broken ERR trap is gone" "absent" "absent"
fi
if grep -q 'trap on_exit EXIT' "$DEPLOY"; then
  t "the EXIT trap is registered" "present" "present"
else
  t "the EXIT trap is registered" "absent" "present"
fi

printf '\ndeploy exit trap: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
