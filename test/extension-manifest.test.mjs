import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyExtensionManifest } from '../scripts/verify-extension-manifest.mjs';

function fixture(t, mutate = value => value) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brightdesk-extension-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src/index.js'), 'export function activate() {}\n');
  const manifest = mutate({
    manifestVersion: 1,
    id: 'sample-welcome-panel',
    name: 'Sample Welcome Panel',
    version: '1.0.0',
    description: 'A harmless example extension manifest.',
    publisher: { name: 'Brightdesk Example Author', url: 'https://example.org' },
    apiVersion: '1.0',
    supportedProducts: ['pages'],
    entrypoint: { type: 'javascript', path: 'src/index.js' },
    permissions: [{ id: 'workspace.read', reason: 'Read the current workspace title.' }],
    license: { spdxId: 'MIT', textFile: 'LICENSE.txt' }
  });
  fs.writeFileSync(path.join(rootDir, 'extension.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(rootDir, 'LICENSE.txt'), 'MIT License\n');
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

test('valid JavaScript extension manifest passes without running extension code', t => {
  const rootDir = fixture(t);
  const result = verifyExtensionManifest({ rootDir });
  assert.equal(result.id, 'sample-welcome-panel');
  assert.equal(result.entrypointType, 'javascript');
  assert.equal(result.permissionCount, 1);
  assert.equal(result.executable, false);
});

test('unknown or dangerous permissions are rejected', t => {
  const rootDir = fixture(t, manifest => {
    manifest.permissions = [{ id: 'filesystem.root', reason: 'Need every file.' }];
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir }), /permission is not allowlisted/i);
});

test('unrestricted network access is not an available extension permission', t => {
  const rootDir = fixture(t, manifest => {
    manifest.permissions = [{ id: 'network.fetch', reason: 'Fetch remote content.' }];
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir }), /permission is not allowlisted/i);
});

test('permission declarations require a non-empty reason', t => {
  const rootDir = fixture(t, manifest => {
    manifest.permissions[0].reason = '  ';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir }), /reason must be a non-empty string/i);
});

test('duplicate permissions are rejected', t => {
  const rootDir = fixture(t, manifest => {
    manifest.permissions.push({ id: 'workspace.read', reason: 'Second request.' });
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir }), /duplicate permission/i);
});

test('unsupported products are rejected', t => {
  const rootDir = fixture(t, manifest => {
    manifest.supportedProducts = ['outlook'];
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir }), /unsupported Brightdesk product/i);
});

test('entrypoint traversal and missing entrypoints are rejected', t => {
  const outside = fixture(t, manifest => {
    manifest.entrypoint.path = '../outside.js';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir: outside }), /must remain inside the extension package/i);

  const missing = fixture(t, manifest => {
    manifest.entrypoint.path = 'src/missing.js';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir: missing }), /entrypoint\.path is missing/i);
});

test('native and binary entrypoints are not accepted', t => {
  const rootDir = fixture(t, manifest => {
    manifest.entrypoint.path = 'src/addon.node';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir }), /must be a JavaScript file/i);
});

test('missing licence text and unexpected manifest properties are rejected', t => {
  const missing = fixture(t, manifest => {
    manifest.license.textFile = 'LICENSE-MISSING.txt';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir: missing }), /license\.textFile is missing/i);

  const extra = fixture(t, manifest => {
    manifest.unreviewedCode = true;
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir: extra }), /unsupported property/i);
});

test('symbolic links are rejected for entrypoints and licence files', t => {
  const rootDir = fixture(t);
  const alias = path.join(rootDir, 'src/alias.js');
  fs.symlinkSync(path.join(rootDir, 'src/index.js'), alias);
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'extension.json'), 'utf8'));
  manifest.entrypoint.path = 'src/alias.js';
  fs.writeFileSync(path.join(rootDir, 'extension.json'), JSON.stringify(manifest));
  assert.throws(() => verifyExtensionManifest({ rootDir }), /symbolic link/i);
});
