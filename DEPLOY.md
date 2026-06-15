# Deploying as a rootless Quadlet

Follows
[quadlet-my-guidelines/new_quadlet_with_ai_assistance.md](https://github.com/mkoester/quadlet-my-guidelines/blob/main/new_quadlet_with_ai_assistance.md),
adapted for this app.

## What's different from the generic guide

This image is **self-contained and read-only**:

- The SQLite game DB is **baked into the image** at `/app/data/stellaris.sqlite`,
  so there are **no volumes, no `~/data` or `~/config` dirs, and no `chown`/`keep-id`
  permission setup**. Updating the game DB means rebuilding + reshipping the image.
- The container runs as the image's own `node` user (UID 1000).
- It's fronted by a reverse proxy, so it publishes on `127.0.0.1:3000` only.

Quadlet files (symlinked into place by the steps below):

| File | Purpose |
|------|---------|
| `empire-planner.container` | the Quadlet unit |
| `empire-planner.env` | committed, non-secret defaults |
| `empire-planner.override.env.template` | copy → `.override.env`, set `ORIGIN` |

## 1. Build and ship the image (run on your dev box)

The image isn't in a registry yet, so build locally and copy the tarball over:

```sh
./scripts/build-container.sh --save        # produces stellaris-empire-planner_latest.tar
scp stellaris-empire-planner_latest.tar root@vps:/tmp/
```

## 2. Load the image on the VPS

```sh
ssh root@vps
sudo -u empire-planner podman load -i /tmp/stellaris-empire-planner_latest.tar
```

(Run this again to update — `AutoUpdate=local` + `podman auto-update` will pick up
the newer local image, or just `systemctl --user restart empire-planner`.)

## 3. Create the service user and clone the repo

```sh
sudo useradd -m -d /var/lib/empire-planner -s /usr/sbin/nologin empire-planner
sudo loginctl enable-linger empire-planner

REPO_URL=https://github.com/mkoester/stellaris-empire-planner.git
REPO=~empire-planner/stellaris-empire-planner

sudo -u empire-planner git clone $REPO_URL $REPO
sudo -u empire-planner mkdir -p ~empire-planner/.config/containers/systemd
```

## 4. Configure the per-deployment override (set your public URL)

```sh
sudo -u empire-planner cp \
  $REPO/empire-planner.override.env.template \
  $REPO/empire-planner.override.env
sudo -u empire-planner nano $REPO/empire-planner.override.env   # set ORIGIN=https://...
```

## 5. Symlink the unit + env files into the Quadlet dir

```sh
QSD=~empire-planner/.config/containers/systemd
sudo -u empire-planner ln -s $REPO/empire-planner.container       $QSD/empire-planner.container
sudo -u empire-planner ln -s $REPO/empire-planner.env            $QSD/empire-planner.env
sudo -u empire-planner ln -s $REPO/empire-planner.override.env   $QSD/empire-planner.override.env
```

## 6. Start and verify

```sh
EP_RT=/run/user/$(id -u empire-planner)
sudo -u empire-planner XDG_RUNTIME_DIR=$EP_RT systemctl --user daemon-reload
sudo -u empire-planner XDG_RUNTIME_DIR=$EP_RT systemctl --user start empire-planner
sudo -u empire-planner XDG_RUNTIME_DIR=$EP_RT systemctl --user status empire-planner
```

It should report `active (running)` and the container `(healthy)`. Confirm:

```sh
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # -> 200
```

Then point your reverse proxy at `http://127.0.0.1:3000` for the host in `ORIGIN`.
