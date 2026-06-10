# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## System Prerequisites

To set up a fresh machine for development, install a Node.js version manager and `pnpm`.

### Recommended: fnm (Arch/CachyOS package)

```sh
sudo pacman -S fnm
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

Arch also packages nvm (`sudo pacman -S nvm`), but it installs to `/usr/share/nvm/`, which isn't user-writable - set `export NVM_DIR="$HOME/.nvm"` *before* sourcing `/usr/share/nvm/init-nvm.sh` in your shell rc, otherwise `nvm install` fails trying to write into `/usr/share/nvm`.

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
