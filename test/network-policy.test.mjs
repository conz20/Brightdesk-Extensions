import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyExtensionManifest } from '../scripts/verify-extension-manifest.mjs';

function fixture(t, permission) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brightdesk-extension-network-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.js'), 'export function activate() {}\n');
  fs.writeFileSync(path.join(root, 'LICENSE.txt'), 'MIT License\n');
  fs.writeFileSync(path.join(root, 'extension.json'), JSON.stringify({
    manifestVersion: 1,
    id: 'sample-extension',
    name: 'Sample Extension',
    version: '1.0.0',
    description: 'Offline-safe sample',
    publisher: { name: 'Example Publisher', url: 'https://example.org' },
    apiVersion: '1.0',
    supportedProducts: ['pages'],
    entrypoint: { type: 'javascript', path: 'src/index.js' },
    permissions: [permission],
    license: { spdxId: 'MIT', textFile: 'LICENSE.txt' }
  }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('network.fetch is rejected even when the manifest provides a reason', t => {
  const root = fixture(t, { id: 'network.fetch', reason: 'Fetch remote content.' });
  assert.throws(() => verifyExtensionManifest({ rootDir: root }), /permission is not allowlisted/i);
});

test('extension schema does not offer a network permission', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../schemas/extension-manifest.schema.json', import.meta.url), 'utf8'));
  const permissionIds = schema.properties.permissions.items.properties.id.enum;
  assert.equal(permissionIds.includes('network.fetch'), false);
});
