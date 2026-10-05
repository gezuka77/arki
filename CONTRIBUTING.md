# Contributing

Use a separate development installation with fictional example data. Do not include real household data or credentials in changes, issues or pull requests.

## Local development

Use Node.js 22 or later:

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
node scripts/check-public.mjs
```

Generate local installation secrets with `node scripts/configure.mjs`, then run these in separate terminals:

```sh
node --env-file=.env backend/server.js
npm run dev --prefix frontend -- --host 127.0.0.1
```

Vite proxies `/api` to port 3000. Tests create isolated temporary databases and credentials; they do not use a running household installation.

## Pull requests

Describe the user-visible change and the validation you performed. Run the tests and build commands above for application changes; for documentation-only changes, check links and review the rendered content and images.

Preserve integer-cent totals, archived category history, the final active administrator, keyboard accessibility and DD/MM/YYYY date handling.

## Documentation audiences

- Keep the [README](README.md) focused on what the app does, screenshots and getting started.
- Put hosting, backups, migration and troubleshooting instructions in the [administration guide](docs/administration.md).
- Keep the [screenshot gallery](docs/screenshots.md) focused on the interface and feature captions.
- Put developer workflows and maintenance instructions in this contribution guide.
- Keep security reporting and security-model details in [SECURITY.md](SECURITY.md).

## Updating screenshots

- Use a separate installation with an empty temporary database and newly generated credentials. Never capture a real household or copy its database.
- Populate only fictional users, receipts, places and pets. Do not capture setup tokens, passwords, real identities or a personal device's location.
- Capture the rendered app at desktop and mobile sizes. Visually inspect every image before committing it.
- Store images in `docs/images/`. Update descriptive alternative text and captions to match the images.
- Keep the screenshot gallery's viewport notes accurate. The current images use a 1440 px desktop width and a 390 × 920 px mobile viewport.

## Publication checks

Before publishing, run `node scripts/check-public.mjs`, inspect `git diff --cached` and verify the tracked file list contains only source, documentation and generic assets. The script is a useful guard, not a guarantee that all possible secrets or personal information have been detected.

## Keeping a private installation in sync

This repository is the canonical application source. Keep installation-specific deployment configuration in the private checkout. Keep credentials, databases and personal screenshots outside Git, in ignored local files or separate private storage. From this repository, run:

```sh
node scripts/sync-installation.mjs /path/to/private-installation
```

Commit any tracked changes in the target checkout before running the sync. The script copies only tracked backend, frontend, Dockerfile and Docker ignore files, and removes obsolete tracked application files. It preserves the target's Compose configuration, environment, CI and data. Review, test, commit and deploy the resulting private changes. Never copy the private checkout back into the public repository; make shared changes here first and synchronize them to the installation. This makes updates deliberate and reviewable rather than automatically deploying every public commit.

## License

By contributing, you agree that your contribution is available under the project's MIT license.
