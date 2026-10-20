#!/usr/bin/env bash
#
# Build a self-contained OCI image for the Stellaris Empire Planner using podman.
#
# The extracted SQLite DB lives outside this repo, so we stage a copy into ./data/
# (gitignored) before building, where the Containerfile can COPY it in.
#
# Usage:
#   scripts/build-container.sh [--db PATH] [--tag NAME:TAG] [--save] [--no-cache]
#
#   --db PATH      Path to the stellaris SQLite DB to bundle.
#                  Defaults to $STELLARIS_DB, else the value in .env.
#   --tag NAME:TAG Image tag (default: stellaris-empire-planner:latest).
#   --save         Also export the image to <tag>.tar for scp-ing to the VPS.
#   --no-cache     Build without using the layer cache.
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_TAG="stellaris-empire-planner:latest"
DB_SRC=""
SAVE=0
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
	case "$1" in
		--db) DB_SRC="$2"; shift 2 ;;
		--tag) IMAGE_TAG="$2"; shift 2 ;;
		--save) SAVE=1; shift ;;
		--no-cache) EXTRA_ARGS+=(--no-cache); shift ;;
		-h|--help) sed -n '2,20p' "$0"; exit 0 ;;
		*) echo "Unknown argument: $1" >&2; exit 1 ;;
	esac
done

# Resolve the DB source: --db, then $STELLARIS_DB, then STELLARIS_DB= from .env.
if [[ -z "$DB_SRC" ]]; then
	DB_SRC="${STELLARIS_DB:-}"
fi
if [[ -z "$DB_SRC" && -f .env ]]; then
	DB_SRC="$(grep -E '^STELLARIS_DB=' .env | tail -1 | cut -d= -f2-)"
fi
if [[ -z "$DB_SRC" ]]; then
	echo "error: no DB path given. Use --db PATH, set STELLARIS_DB, or add it to .env." >&2
	exit 1
fi
if [[ ! -f "$DB_SRC" ]]; then
	echo "error: DB file not found: $DB_SRC" >&2
	exit 1
fi

echo "==> Staging DB: $DB_SRC -> data/stellaris.sqlite"
mkdir -p data
cp "$DB_SRC" data/stellaris.sqlite

# package.json's version, decorated with git state (vault: "Artifact versioning"): as-is on a
# clean main, -<hash> on any other commit, -SNAPSHOT with uncommitted changes.
decorated_version() {
	local base
	base=$(sed -nE 's/^\t"version": "([^"]+)",$/\1/p' package.json)
	if ! git rev-parse --git-dir >/dev/null 2>&1; then
		echo "$base"
	elif [[ -n $(git status --porcelain --untracked-files=no) ]]; then
		echo "$base-SNAPSHOT"
	elif [[ $(git branch --show-current) == main ]]; then
		echo "$base"
	else
		echo "$base-$(git rev-parse --short HEAD)"
	fi
}
APP_VERSION=$(decorated_version)

echo "==> Building image: $IMAGE_TAG (version $APP_VERSION)"
podman build "${EXTRA_ARGS[@]}" --build-arg "APP_VERSION=$APP_VERSION" -t "$IMAGE_TAG" -f Containerfile .

if [[ "$SAVE" -eq 1 ]]; then
	OUT="${IMAGE_TAG//[:\/]/_}.tar"
	echo "==> Saving image to $OUT"
	podman save -o "$OUT" "$IMAGE_TAG"
	echo "    Transfer with: scp $OUT user@vps: && ssh user@vps podman load -i $(basename "$OUT")"
fi

cat <<EOF

==> Done. Run locally with:
      podman run --rm -p 3000:3000 $IMAGE_TAG

    Behind a reverse proxy on the VPS, set the public origin so form posts work:
      podman run -d --name empire-planner -p 3000:3000 \\
        -e ORIGIN=https://planner.example.com $IMAGE_TAG

    Then open http://localhost:3000
EOF
