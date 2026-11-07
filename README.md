# Brightdesk Extensions

A controlled extension model for future Brightdesk integrations.

<badge>Bootstrap repository — implementation not yet present</badge>

## Purpose

Define how optional extensions can add capabilities without weakening product security, stability, local data ownership or the consistent Brightdesk experience.

## Current status

The verified repository currently contains only this README. No extension manifest, SDK, loader, permission model, sample extension or compatibility tests have been confirmed.

## Planned foundations

- Versioned extension manifest and metadata schema.
- Explicit permissions for file access, network access and product capabilities.
- Lifecycle contracts for discovery, enable, disable, update and removal.
- Compatibility declarations for Suite and product versions.
- Signed or otherwise verifiable package provenance before distribution.
- Extension isolation, resource limits and safe failure behaviour.
- Developer documentation and a minimal sample extension.

## Safety rules

Extensions are disabled unless the user enables them. Never grant broad file or network access by default. Do not load untrusted native code in-process. AI providers and agents are not extensions by default; AI-specific implementation remains in Brightdesk-AI.

## Initial acceptance gate

Write and validate the manifest schema before implementing a loader. Add tests for invalid manifests, denied permissions, version mismatch and extension failure. Only then build a sample extension and integrate it into a test environment.