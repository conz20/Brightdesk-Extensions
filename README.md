# Brightdesk Extensions

## Repository purpose

A controlled extension manifest and permission model for future Brightdesk integrations.

## Current status

Bootstrap scope recorded; manifest and permission foundations are under development on the existing draft pull request.

## Immediate engineering goals

Define a versioned manifest schema, capability allowlist, validation, compatibility rules, and negative tests for undeclared permissions.

## Scope and safety boundaries

No extension may bypass local-first operation, introduce accounts or telemetry, or add network access without an explicitly approved Brightdesk-controlled use.

## Supported development platforms

Brightdesk customer software is desktop-only: Windows, macOS, and Linux. This repository does not create Android, iPhone, iPad, or other mobile editions.

## Contribution and completion standard

Work is developed on a feature branch and reviewed through a pull request. Do not merge unverified changes or bypass required checks. Keep tests, documentation, and implementation aligned. Mark work complete only when the relevant current commit has passed its required verification.

## Brightdesk portfolio

This repository is part of the Brightdesk engineering portfolio. The customer suite contains exactly ten products: Pages, Sheets, Decks, Notes, Database, Forms, Lists, Planner, To Do, and Workspace. Brightdesk-AI and shared engineering repositories are not additional customer products.
