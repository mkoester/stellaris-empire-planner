# Releasing

`main` carries releases, `develop` the next one; every release is a `--no-ff` merge into `main`,
tagged `vX.Y.Z` (the OKF vault's procedure, `practices/git-and-workspaces.md`). `develop` already
carries the version being released (`package.json`). The artifact is the hosted site: the server
deploys `main`.

1. If the game data changed, release `stellaris-data-extraction` first: the deployment builds its
   DB from that repo's `main` (`sql/stellaris.sql`).
2. On `develop`, everything committed: in `CHANGELOG.md`, turn `Unreleased` into
   `## [X.Y.Z] - <date>` (own commit).
3. `git checkout main && git merge --no-ff develop -m "Release vX.Y.Z (merge develop)"`, then
   `git tag vX.Y.Z`.
4. `git checkout develop`, bump the patch in `package.json`, commit `chore: version bump (vX.Y.Z+1)`.
5. Publish (by hand): `git push origin main develop --tags`, then deploy on the server
   (`DEPLOY.md`, "Updating a running deployment"). The nav shows the plain `X.Y.Z`; a `-<hash>` or `-SNAPSHOT` there
   means the server's clone is not on a clean `main`.
