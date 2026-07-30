# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## System Prerequisites

To set up a fresh machine for development, install a Node.js version manager and `pnpm`.

### Recommended: fnm (Arch/CachyOS package)

```sh
paru -S fnm
```

Add to your shell rc (`~/.zshrc` / `~/.bashrc`), then restart your shell:

```sh
eval "$(fnm env --use-on-cd)"
```

Install and activate the latest Node.js LTS release:

```sh
fnm install --lts
fnm default lts-latest
```

### Alternative: nvm

Arch also packages nvm (`paru -S nvm`), but it installs to `/usr/share/nvm/`, which isn't user-writable - set `export NVM_DIR="$HOME/.nvm"` *before* sourcing `/usr/share/nvm/init-nvm.sh` in your shell rc, otherwise `nvm install` fails trying to write into `/usr/share/nvm`.

Or install nvm directly from upstream:

```sh
# install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# restart your shell (or `source ~/.zshrc`) so the `nvm` command becomes available

# install and activate the latest Node.js LTS release
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'   # note the quotes - an unquoted lts/* can be glob-expanded by zsh
```

### pnpm (either path)

Enable Corepack (ships with Node, manages package manager versions) and install pnpm:

```sh
corepack enable
corepack prepare pnpm@latest --activate
```

Then install project dependencies:

```sh
pnpm install
```

## Container Build environment on a Fedora server

To build the deployable image on a headless Fedora box you don't need Node/pnpm —
`pnpm build` runs *inside* the image. The host just needs `podman` to build, `git`
to fetch the repos, and `sqlite` to generate the bundled DB from the committed dump
(the server has no Stellaris install to run the full extraction):

```sh
sudo dnf install -y podman git sqlite
```

Fetch both repos and build the SQLite DB from the committed SQL dump:

```sh
git clone https://github.com/mkoester/stellaris-empire-planner.git
git clone https://github.com/mkoester/stellaris-data-extraction.git
./stellaris-data-extraction/build-sqlite.sh    # -> stellaris-data-extraction/sqlite/stellaris.sqlite
```

Build the image, bundling that DB:

```sh
cd stellaris-empire-planner
./scripts/build-container.sh --db ../stellaris-data-extraction/sqlite/stellaris.sqlite
```

To refresh later: `git pull` in both repos, re-run `build-sqlite.sh`, then rebuild.
See [DEPLOY.md](DEPLOY.md) for running the image as a rootless Quadlet.

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.15.3 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:none" --install pnpm stellaris-empire-planner
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
