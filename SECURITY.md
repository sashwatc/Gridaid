# Security and privacy

GridAid is a local planning simulator. It collects no accounts, names, emails, medical information, live 911 records, private responder addresses or precise user location. It accepts no arbitrary uploads, external URLs or serialized model files. Public historical crash data is aggregated offline, with no person/vehicle/medical fields requested.

The backend executes strict input validation, 16 KiB request bounds, expensive-operation rate limits, two-process computation limits, solver limits, a killable 20-second job deadline, restricted CORS, CSP and other security headers, safe errors and content-versioned results/caches. Dependencies are frozen and scanned. See [threat model](docs/threat_model.md) and [executed validation](docs/validation.md).

Keep secrets in environment variables, never frontend code. `.env` is ignored. The default demo needs no keys. Runtime never deserializes models; only known offline training creates joblib artifacts and precomputed risk snapshots. Historical ML evaluation is not operational validation.

Only bind to `127.0.0.1` for the local demo. HTTPS/HSTS, coordinated limits across workers/replicas, hostile-network testing and independent penetration testing have not been verified. A public deployment must review these controls first. This repository does not claim a security certification or competition release approval.

For a suspected issue, share a minimal reproduction privately with the repository owner through the repository hosting provider's private vulnerability reporting facility if available. Do not include private data or credentials in public issues. No external report or contact was made during implementation.
