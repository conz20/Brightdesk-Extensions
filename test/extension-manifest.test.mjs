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


test('Windows drive paths are rejected as package file paths on every platform', t => {
  const driveAbsolute = fixture(t, manifest => {
    manifest.entrypoint.path = 'C:/Windows/System32/evil.js';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir: driveAbsolute }), /must remain inside the extension package/i);

  const driveRelative = fixture(t, manifest => {
    manifest.entrypoint.path = 'C:outside.js';
    return manifest;
  });
  assert.throws(() => verifyExtensionManifest({ rootDir: driveRelative }), /must remain inside the extension package/i);
});


test('runtime validator rejects malformed SemVer prerelease and build identifiers', t => {
  const invalidVersions = [
    '1.2.3-01',
    '1.2.3-0.01',
    '1.2.3-alpha..beta',
    '1.2.3+build..7'
  ];

  for (const version of invalidVersions) {
    const rootDir = fixture(t, manifest => {
      manifest.version = version;
      return manifest;
    });
    assert.throws(
      () => verifyExtensionManifest({ rootDir }),
      /manifest\.version must be a valid semantic version/i,
      `runtime validator accepted invalid SemVer: ${version}`
    );
  }

  const validVersion = '1.2.3-alpha.1+build.007';
  const validRoot = fixture(t, manifest => {
    manifest.version = validVersion;
    return manifest;
  });
  assert.equal(verifyExtensionManifest({ rootDir: validRoot }).version, validVersion);
});

test('manifest JSON Schema rejects malformed SemVer identifiers', () => {
  const schema = JSON.parse(fs.readFileSync(
    new URL('../schemas/extension-manifest.schema.json', import.meta.url),
    'utf8'
  ));
  const versionPattern = new RegExp(schema.properties.version.pattern);
  const invalidVersions = [
    '1.2.3-01',
    '1.2.3-0.01',
    '1.2.3-alpha..beta',
    '1.2.3+build..7'
  ];

  for (const version of invalidVersions) {
    assert.equal(versionPattern.test(version), false, `schema accepted invalid SemVer: ${version}`);
  }
  assert.equal(versionPattern.test('1.2.3-alpha.1+build.007'), true);
});

test('a symbolic-link package root is rejected', t => {
  const rootDir = fixture(t);
  const aliasPath = path.join(path.dirname(rootDir), path.basename(rootDir) + '-alias');
  fs.symlinkSync(rootDir, aliasPath, 'dir');
  t.after(() => fs.rmSync(aliasPath, { force: true }));
  assert.throws(
    () => verifyExtensionManifest({ rootDir: aliasPath }),
    /package root.*symbolic link/i
  );
});

test('a symbolic-link extension.json manifest is rejected', t => {
  const rootDir = fixture(t);
  const manifestPath = path.join(rootDir, 'extension.json');
  const actualManifestPath = path.join(rootDir, 'extension-manifest-copy.json');
  fs.renameSync(manifestPath, actualManifestPath);
  fs.symlinkSync(actualManifestPath, manifestPath, 'file');
  assert.throws(
    () => verifyExtensionManifest({ rootDir }),
    /extension\.json.*symbolic link/i
  );
});

test('runtime validator enforces the schema maximum lengths for text fields', t => {
  const cases = [
    {
      label: 'manifest.name',
      mutate: manifest => { manifest.name = 'N'.repeat(101); }
    },
    {
      label: 'manifest.description',
      mutate: manifest => { manifest.description = 'D'.repeat(241); }
    },
    {
      label: 'manifest.publisher.name',
      mutate: manifest => { manifest.publisher.name = 'P'.repeat(101); }
    },
    {
      label: 'permissions[0].reason',
      mutate: manifest => { manifest.permissions[0].reason = 'R'.repeat(241); }
    }
  ];

  for (const scenario of cases) {
    const rootDir = fixture(t, manifest => {
      scenario.mutate(manifest);
      return manifest;
    });
    assert.throws(
      () => verifyExtensionManifest({ rootDir }),
      /must be no more than/i,
      scenario.label + ' must match its JSON Schema maxLength'
    );
  }
});

test('runtime validator enforces the schema path character rules for entrypoints and licence files', t => {
  const unsafeEntrypoint = fixture(t, manifest => {
    manifest.entrypoint.path = 'src folder/index.js';
    return manifest;
  });
  fs.mkdirSync(path.join(unsafeEntrypoint, 'src folder'));
  fs.writeFileSync(path.join(unsafeEntrypoint, 'src folder/index.js'), 'export {}\\n');
  assert.throws(
    () => verifyExtensionManifest({ rootDir: unsafeEntrypoint }),
    /schema-approved path/i
  );

  const unsafeLicencePath = fixture(t, manifest => {
    manifest.license.textFile = 'LICENSE copy.txt';
    return manifest;
  });
  fs.writeFileSync(path.join(unsafeLicencePath, 'LICENSE copy.txt'), 'MIT License\\n');
  assert.throws(
    () => verifyExtensionManifest({ rootDir: unsafeLicencePath }),
    /schema-approved path/i
  );

  const uppercaseExtension = fixture(t, manifest => {
    manifest.entrypoint.path = 'src/index.JS';
    return manifest;
  });
  fs.writeFileSync(path.join(uppercaseExtension, 'src/index.JS'), 'export {}\\n');
  assert.throws(
    () => verifyExtensionManifest({ rootDir: uppercaseExtension }),
    /schema-approved path/i
  );
});


test('manifest JSON Schema rejects empty and dot path segments', () => {
  const schema = JSON.parse(fs.readFileSync(
    new URL('../schemas/extension-manifest.schema.json', import.meta.url),
    'utf8'
  ));
  const entrypointPattern = new RegExp(schema.properties.entrypoint.properties.path.pattern);
  const licencePattern = new RegExp(schema.properties.license.properties.textFile.pattern);

  for (const value of ['src//index.js', 'src/./index.js', './src/index.js']) {
    assert.equal(entrypointPattern.test(value), false, `schema accepted unsafe entrypoint path: ${value}`);
  }
  for (const value of ['licenses//MIT.txt', 'licenses/./MIT.txt', './LICENSE.txt']) {
    assert.equal(licencePattern.test(value), false, `schema accepted unsafe licence path: ${value}`);
  }

  assert.equal(entrypointPattern.test('src/index.js'), true);
  assert.equal(licencePattern.test('licenses/MIT.txt'), true);
});


test('runtime validation rejects whitespace-wrapped manifest tokens instead of normalising them', t => {
  const cases = [
    { label: 'manifest.id', mutate: manifest => { manifest.id = ' sample-welcome-panel '; } },
    { label: 'manifest.version', mutate: manifest => { manifest.version = ' 1.0.0 '; } },
    { label: 'manifest.apiVersion', mutate: manifest => { manifest.apiVersion = ' 1.0 '; } },
    { label: 'manifest.supportedProducts', mutate: manifest => { manifest.supportedProducts = [' pages ']; } },
    { label: 'manifest.permissions[0].id', mutate: manifest => { manifest.permissions[0].id = ' workspace.read '; } },
    { label: 'manifest.entrypoint.path', mutate: manifest => { manifest.entrypoint.path = ' src/index.js '; } },
    { label: 'manifest.license.textFile', mutate: manifest => { manifest.license.textFile = ' LICENSE.txt '; } },
    { label: 'manifest.publisher.url', mutate: manifest => { manifest.publisher.url = ' https://example.org '; } }
  ];

  for (const scenario of cases) {
    const rootDir = fixture(t, manifest => {
      scenario.mutate(manifest);
      return manifest;
    });
    assert.throws(
      () => verifyExtensionManifest({ rootDir }),
      /Extension manifest:/,
      scenario.label + ' must reject surrounding whitespace'
    );
  }
});
