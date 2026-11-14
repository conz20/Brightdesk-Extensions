# Brightdesk Extensions

A controlled, permission-first extension contract for future Brightdesk integrations.

> **Status:** Initial manifest schema and static validator implemented. No extension runtime, loader, marketplace or package distribution is implemented. The example entrypoint is never executed.

## Implemented foundation

- `schemas/extension-manifest.schema.json` defines version 1 of the manifest contract.
- `scripts/verify-extension-manifest.mjs` checks required metadata, semantic version, HTTPS publisher URL, supported products, JavaScript-only entrypoints, explicit permission reasons, allowlisted permission IDs, local licence text and safe package-contained paths.
- The validator rejects symlinked package roots and `extension.json` files, as well as symlinked entrypoint and licence files. Manifest reads use `O_NOFOLLOW` where supported and compare the opened file with the inspected file before parsing. It also rejects path traversal, non-regular files, Windows drive paths, and native or binary entrypoints.
- `test/extension-manifest.test.mjs` contains 25 regression tests covering valid manifests, malformed SemVer, schema-parity text lengths and path rules (including empty and dot path segments), unsupported permissions, missing reasons, duplicate permissions, unsupported products, unsafe and missing paths, native-code rejection, unexpected properties, symlink boundaries, manifest-path replacement races, whitespace-wrapped manifest tokens and the 64 KiB manifest-size limit.
- `examples/basic-extension/` contains a static example manifest, source stub and MIT licence text. The source stub is not loaded or executed.
- `.github/workflows/quality.yml` runs on Node.js 24.22.2 with pinned actions.

## Commands

~~~sh
npm ci --no-audit --no-fund
npm run check:node
npm run check
npm test
~~~

To verify the sample package from this repository root:

~~~sh
cd examples/basic-extension
node ../../scripts/verify-extension-manifest.mjs
~~~

## Permission contract

A manifest must request each permission explicitly and provide a reason for that request. The current allowlist is deliberately narrow: workspace read/write, document read/write, clipboard read/write and local notifications. No network permission is available to extensions; customer network access remains restricted to official Brightdesk product updates and approved language resources. Unrecognised permissions are rejected. Empty permission arrays are valid and grant no access.

Permission names are declarations, not enforcement. No extension is loaded, executed or granted these capabilities by this repository. A future host runtime must implement user consent, capability enforcement, isolation, resource limits, lifecycle handling and revocation before any extension code can run.

## Security and release gates

- No broad filesystem, shell, process, native-module or unrestricted system access is accepted by this manifest contract.
- No untrusted native code is loaded in-process.
- Publisher URL and name are declarative metadata only; they do not establish identity or trust.
- Signature/provenance verification, package isolation, host compatibility enforcement and a runtime permission broker remain unimplemented.
- The example is test data, not an approved distributable extension.
- Do not publish or integrate extensions until manifest validation, licence review, signature verification, runtime isolation and end-to-end permission-denial tests are complete.

## Boundaries

Brightdesk products own their extension host integration and user experience. Brightdesk Extensions owns the shared manifest and compatibility contracts. AI-specific orchestration stays in Brightdesk-AI. The extension model must not introduce paid services, customer accounts or online dependencies into otherwise local product workflows.

The [Brightdesk developer ecosystem architecture](https://github.com/conz20/Brightdesk-suite/blob/main/docs/DEVELOPER_ECOSYSTEM_ARCHITECTURE.md) remains the source for repository ownership and dependency rules.
