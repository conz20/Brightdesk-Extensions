# Brightdesk Extensions

Brightdesk Extensions owns the shared manifest, permission and compatibility contracts for possible future extensions to Brightdesk desktop products. It is engineering infrastructure, not an eleventh customer product.

## Current status

The `main` branch currently contains this repository scope document only. The separate draft implementation pull request contains the first versioned manifest schema and static validator:

- [Draft implementation PR #1](https://github.com/conz20/Brightdesk-Extensions/pull/1)
- Manifest version 1 schema and JavaScript static validator.
- A narrow allowlist of declared workspace, document, clipboard and local-notification permissions.
- Validation of supported Brightdesk products, semantic versions, publisher metadata, package-contained files and local licence text.
- Regression tests for malformed manifests, unsupported permissions, unsafe paths, symbolic links and Windows drive paths.

The draft implementation has passed its current exact-head macOS ARM64 CI run. It has not been merged into `main`.

There is no extension runtime, loader, SDK, marketplace, package distribution or product integration. The example extension is a static test fixture; its entrypoint is not executed.

## Customer product scope

The approved Brightdesk customer suite contains exactly ten products:

Pages, Sheets, Decks, Notes, Database, Forms, Lists, Planner, To Do and Workspace.

Brightdesk-AI and shared engineering repositories are not additional customer products. AI models, prompts, agents and AI-specific orchestration remain in private Brightdesk-AI.

## Permission and security boundaries

A manifest permission is a declaration, not an implemented capability. A valid manifest does not authorise or execute extension code.

- Extensions must not introduce customer accounts, sign-ins, passwords, profiles, telemetry, advertising, analytics or cloud sync.
- Extension network access is not an available permission. Customer internet access remains limited to official Brightdesk product updates and Brightdesk-controlled language resources.
- Do not accept unrestricted filesystem, shell, process, native-module or system access.
- Do not load untrusted native code in-process.
- Publisher metadata does not establish publisher identity or trust.
- Do not distribute or integrate extensions until a host independently implements and tests user consent, capability enforcement, process isolation, resource limits, lifecycle handling, revocation and permission-denial behaviour.
- Signed provenance, licence review and host compatibility enforcement remain outstanding.

The current draft implementation must remain unmerged until a future host independently implements and passes its enforcement and isolation gates.

## Supported development platforms

Brightdesk customer software is desktop-only: Windows, macOS and Linux. This repository does not create Android, iPhone, iPad or other mobile editions.

## Development

Use Node.js 24.22.2 for the current implementation branch. Its documented checks are:

~~~sh
npm ci --no-audit --no-fund
npm run check:node
npm run check
npm test
~~~

These commands apply to the implementation branch, not to the current `main` branch until that implementation is reviewed and merged.

Work on feature branches, add regression tests for behaviour changes, and keep implementation claims tied to the exact commit and its verification results. Do not bypass review or merge gates.
