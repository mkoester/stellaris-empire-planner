#!/usr/bin/env bash
#
# Update the deployed planner to the latest pushed commits of both repos: pull,
# rebuild the game DB from the committed SQL dump, rebuild the image in the service
# user's podman storage, restart the Quadlet, and check the result.
#
# Run on the server, as a sudoer (it acts as the service user itself):
#   sudo ~stellaris-empire-planner/stellaris-empire-planner/scripts/update-deployment.sh
#
# Idempotent — re-running rebuilds and restarts again. Expects the layout from
# DEPLOY.md: the service user's home holds the planner clone, and the extraction
# clone sits next to it (cloned on first run).
#
# The final check compares the game version the live site reports with the one in
# the committed dump, so a stale image or DB fails instead of looking fine.
set -euo pipefail

SVC=stellaris-empire-planner
EXTRACTION_URL=https://github.com/mkoester/stellaris-data-extraction.git

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# Everything lives in main(), called on the last line: bash parses the whole function
# before running it, so the `git pull` below can safely rewrite this very file.
main() {
	[[ $EUID -eq 0 ]] || die "run with sudo (it switches to the $SVC user itself)"
	for tool in git podman sqlite3 curl; do
		command -v "$tool" >/dev/null || die "$tool not found (Fedora: sudo dnf install -y podman git sqlite curl)"
	done

	local home uid rt planner extraction
	home=$(getent passwd "$SVC" | cut -d: -f6) || die "no user $SVC — see DEPLOY.md step 2"
	uid=$(id -u "$SVC")
	rt=/run/user/$uid
	planner=$home/stellaris-empire-planner
	extraction=$home/stellaris-data-extraction
	[[ -d $planner/.git ]] || die "planner clone missing at $planner — see DEPLOY.md step 2"
	[[ -d $rt ]] || die "$rt missing — is linger enabled? (sudo loginctl enable-linger $SVC)"

	as_svc() { sudo -u "$SVC" HOME="$home" XDG_RUNTIME_DIR="$rt" "$@"; }

	step "Pulling the planner"
	as_svc git -C "$planner" pull --ff-only

	step "Pulling the extraction repo (for its committed SQL dump)"
	if [[ ! -d $extraction/.git ]]; then
		as_svc git clone "$EXTRACTION_URL" "$extraction"
	fi
	as_svc git -C "$extraction" pull --ff-only

	step "Rebuilding the game DB from the dump"
	as_svc "$extraction/build-sqlite.sh"
	local want
	want=$(sqlite3 "$extraction/sqlite/stellaris.sqlite" "SELECT value FROM meta WHERE key='game_version_raw'")
	[[ -n $want ]] || die "the rebuilt DB has no game_version_raw"
	echo "    game version in the dump: $want"

	step "Building the image as $SVC"
	as_svc "$planner/scripts/build-container.sh" --db "$extraction/sqlite/stellaris.sqlite"

	step "Restarting the service"
	as_svc systemctl --user restart "$SVC"

	step "Checking the live site"
	local code="" page
	for _ in $(seq 30); do
		code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
		[[ $code == 200 ]] && break
		sleep 2
	done
	[[ $code == 200 ]] || die "http://127.0.0.1:3000/ answered '$code' after 60s — see: sudo -u $SVC XDG_RUNTIME_DIR=$rt journalctl --user -u $SVC -n 50"
	page=$(curl -s http://127.0.0.1:3000/)
	grep -qF "$want" <<<"$page" || die "the site is up but does not report $want — the old image may still be running"
	echo "    200 OK, reporting $want"
	echo "    planner $(as_svc git -C "$planner" rev-parse --short HEAD), extraction $(as_svc git -C "$extraction" rev-parse --short HEAD)"
}

main "$@"
