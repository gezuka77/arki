# Security and privacy

Do not publish tokens, database files, household exports, logs, screenshots of real receipts, or passwords in issues or pull requests. Use GitHub's private vulnerability reporting for the repository if enabled; otherwise contact its maintainer privately.

First-run setup requires a generated installation token. The setup endpoint cannot initialize a second household after setup is complete. Account passwords are hashed with bcrypt; bearer sessions expire and are revoked by password/role/account-status changes. Administrators manage configuration and users; members share receipt and budget access. This is not a multi-tenant system.

The application is intended for a small trusted household behind HTTPS. JWTs are stored in browser local storage, so use trusted devices and keep dependencies updated. Protect the server, reverse proxy, `.env`, volume and backups. Treat exported CSV files as private spending data. No public-registration or email-recovery service is included.

Maps contact external providers as documented in [Maps and privacy](README.md#maps-and-privacy). Place timing diagnostics omit coordinates and search names. The application itself does not send analytics or telemetry.

For repository publication and secret-checking procedures, see [Publication checks](CONTRIBUTING.md#publication-checks).
