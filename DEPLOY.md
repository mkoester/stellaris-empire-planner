# Deploying as a rootless Quadlet

Follows [quadlet-my-guidelines/new_quadlet_with_ai_assistance.md](https://github.com/mkoester/quadlet-my-guidelines/blob/main/new_quadlet_with_ai_assistance.md), adapted for this app.

## What's different from the generic guide

This image is **self-contained and read-only**:

- The SQLite game DB is **baked into the image** at `/app/data/stellaris.sqlite`, so there are **no volumes, no `~/data` or `~/config` dirs, and no `chown`/`keep-id` permission setup**. Updating the game DB means rebuilding + reshipping the image.
- The container runs as the image's own `node` user (UID 1000).
- It's fronted by a reverse proxy, so it publishes on `127.0.0.1:3000` only.

Quadlet files (symlinked into place by the steps below):

| File | Purpose |
|------|---------|
| `stellaris-empire-planner.container` | the Quadlet unit |
| `stellaris-empire-planner.env` | committed, non-secret defaults |
| `stellaris-empire-planner.override.env.template` | copy → `.override.env`, set `ORIGIN` |

## 1. Build and ship the image (run on your dev box)

The image isn't in a registry yet, so build locally and copy the tarball over:

```sh
./scripts/build-container.sh --save        # produces stellaris-empire-planner_latest.tar
scp stellaris-empire-planner_latest.tar root@vps:/tmp/
```

## 2. Create the service user and clone the repo

```sh
sudo useradd -m -d /var/lib/stellaris-empire-planner -s /usr/sbin/nologin stellaris-empire-planner
sudo loginctl enable-linger stellaris-empire-planner

REPO_URL=https://github.com/mkoester/stellaris-empire-planner.git
REPO=~stellaris-empire-planner/stellaris-empire-planner

sudo -u stellaris-empire-planner git clone $REPO_URL $REPO
sudo -u stellaris-empire-planner mkdir -p ~stellaris-empire-planner/.config/containers/systemd
```

## 3. Load the image on the VPS (needs the user from step 2)

```sh
sudo -u stellaris-empire-planner podman load -i /tmp/stellaris-empire-planner_latest.tar
```

(Run this again to update — `AutoUpdate=local` + `podman auto-update` will pick up the newer local image, or just `systemctl --user restart stellaris-empire-planner`.)

## 4. Configure the per-deployment override (set your public URL)

```sh
sudo -u stellaris-empire-planner cp \
  $REPO/stellaris-empire-planner.override.env.template \
  $REPO/stellaris-empire-planner.override.env
sudo -u stellaris-empire-planner nano $REPO/stellaris-empire-planner.override.env   # set ORIGIN=https://...
```

## 5. Symlink the unit + env files into the Quadlet dir

```sh
QSD=~stellaris-empire-planner/.config/containers/systemd
sudo -u stellaris-empire-planner ln -s $REPO/stellaris-empire-planner.container       $QSD/stellaris-empire-planner.container
sudo -u stellaris-empire-planner ln -s $REPO/stellaris-empire-planner.env            $QSD/stellaris-empire-planner.env
sudo -u stellaris-empire-planner ln -s $REPO/stellaris-empire-planner.override.env   $QSD/stellaris-empire-planner.override.env
```

## 6. Start and verify

```sh
EP_RT=/run/user/$(id -u stellaris-empire-planner)
sudo -u stellaris-empire-planner XDG_RUNTIME_DIR=$EP_RT systemctl --user daemon-reload
sudo -u stellaris-empire-planner XDG_RUNTIME_DIR=$EP_RT systemctl --user start stellaris-empire-planner
sudo -u stellaris-empire-planner XDG_RUNTIME_DIR=$EP_RT systemctl --user status stellaris-empire-planner
```

It should report `active (running)` and the container `(healthy)`. Confirm:

```sh
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # -> 200
```

Then point your reverse proxy at `http://127.0.0.1:3000` for the host in `ORIGIN`.

## Updating a running deployment

The server's clones stay on `main`, so this deploys the latest **release** (`RELEASE.md`; work in progress lives on `develop`). After pushing a release of **both** repos (a game patch regenerates the extraction repo's `sql/stellaris.sql`), run on the server:

```sh
sudo -u stellaris-empire-planner git -C ~stellaris-empire-planner/stellaris-empire-planner pull --ff-only
sudo ~stellaris-empire-planner/stellaris-empire-planner/scripts/update-deployment.sh
```

The first line only matters when the script itself changed. The script pulls both repos (cloning the extraction repo next to the planner on first run), rebuilds the DB from the committed dump, builds the image in the service user's podman storage, restarts the service, and fails unless `http://127.0.0.1:3000/` answers 200 **and** reports the dump's game version. It needs `podman git sqlite curl` on the host.
