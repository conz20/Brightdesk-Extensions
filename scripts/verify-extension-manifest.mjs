#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = process.cwd();
const PRODUCTS = new Set(['suite', 'pages', 'sheets', 'decks', 'notes', 'database', 'forms', 'lists', 'planner', 'todo', 'workspace']);
const PERMISSIONS = new Set([
  'workspace.read',
  'workspace.write',
  'documents.read',
  'documents.write',
  'clipboard.read',
  'clipboard.write',
  'notifications.create'
]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  throw new Error('Extension manifest: ' + message);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object.');
}

function requireKeys(value, allowed, required, label) {
  for (const key of required) if (!Object.hasOwn(value, key)) fail(label + '.' + key + ' is required.');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(label + ' contains an unsupported property: ' + key + '.');
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(label + ' must be a non-empty string.');
  return value.trim();
}

function requireHttps(value, label) {
  const raw = requireText(value, label);
  let url;
  try { url = new URL(raw); } catch { fail(label + ' must be a valid HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail(label + ' must be a valid HTTPS URL without embedded credentials.');
}

function resolvePackageFile(rootDir, relativePath, label) {
  const raw = requireText(relativePath, label);
  if (raw.includes('\\') || /^[A-Za-z]:/.test(raw) || path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw) || raw.split('/').includes('..')) {
    fail(label + ' must remain inside the extension package.');
  }
  const segments = raw.split('/');
  let current = path.resolve(rootDir);
  for (const segment of segments) {
    if (!segment || segment === '.') fail(label + ' contains an empty or dot path segment.');
    current = path.join(current, segment);
    let stat;
    try { stat = fs.lstatSync(current); } catch { fail(label + ' is missing: ' + raw); }
    if (stat.isSymbolicLink()) fail(label + ' resolves through a symbolic link: ' + raw);
  }
  const packageRoot = fs.realpathSync(rootDir);
  const resolved = fs.realpathSync(current);
  const relative = path.relative(packageRoot, resolved);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    fail(label + ' resolves outside the extension package.');
  }
  if (!fs.statSync(resolved).isFile()) fail(label + ' must point to a regular file.');
  return resolved;
}

function verifyPermissionList(permissions) {
  if (!Array.isArray(permissions)) fail('permissions must be an array.');
  const seen = new Set();
  for (const [index, permission] of permissions.entries()) {
    const label = 'permissions[' + index + ']';
    requireObject(permission, label);
    requireKeys(permission, ['id', 'reason'], ['id', 'reason'], label);
    const id = requireText(permission.id, label + '.id');
    if (!PERMISSIONS.has(id)) fail(label + '.id permission is not allowlisted: ' + id + '.');
    if (seen.has(id)) fail('duplicate permission: ' + id + '.');
    seen.add(id);
    requireText(permission.reason, label + '.reason');
  }
  return seen.size;
}

export function verifyExtensionManifest({ rootDir = DEFAULT_ROOT } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const manifestPath = path.join(absoluteRoot, 'extension.json');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (error) { fail('cannot read extension.json: ' + error.message); }

  requireObject(manifest, 'manifest');
  const keys = ['manifestVersion', 'id', 'name', 'version', 'description', 'publisher', 'apiVersion', 'supportedProducts', 'entrypoint', 'permissions', 'license'];
  requireKeys(manifest, keys, keys, 'manifest');
  if (manifest.manifestVersion !== 1) fail('manifestVersion must be 1.');

  const id = requireText(manifest.id, 'manifest.id');
  if (!SLUG.test(id)) fail('manifest.id must use lowercase letters, numbers and single hyphens.');
  requireText(manifest.name, 'manifest.name');
  const version = requireText(manifest.version, 'manifest.version');
  if (!SEMVER.test(version)) fail('manifest.version must be a valid semantic version.');
  requireText(manifest.description, 'manifest.description');

  requireObject(manifest.publisher, 'manifest.publisher');
  requireKeys(manifest.publisher, ['name', 'url'], ['name', 'url'], 'manifest.publisher');
  requireText(manifest.publisher.name, 'manifest.publisher.name');
  requireHttps(manifest.publisher.url, 'manifest.publisher.url');

  const apiVersion = requireText(manifest.apiVersion, 'manifest.apiVersion');
  if (!/^\d+\.\d+$/.test(apiVersion)) fail('manifest.apiVersion must use major.minor notation.');

  if (!Array.isArray(manifest.supportedProducts) || manifest.supportedProducts.length === 0) {
    fail('manifest.supportedProducts must contain at least one supported Brightdesk product.');
  }
  const productSet = new Set();
  for (const product of manifest.supportedProducts) {
    const value = requireText(product, 'manifest.supportedProducts item');
    if (!PRODUCTS.has(value)) fail('unsupported Brightdesk product: ' + value + '.');
    if (productSet.has(value)) fail('duplicate supported product: ' + value + '.');
    productSet.add(value);
  }

  requireObject(manifest.entrypoint, 'manifest.entrypoint');
  requireKeys(manifest.entrypoint, ['type', 'path'], ['type', 'path'], 'manifest.entrypoint');
  if (manifest.entrypoint.type !== 'javascript') fail('entrypoint.type must be javascript; native and binary entrypoints are not accepted.');
  const entrypointExtension = path.extname(String(manifest.entrypoint.path || '')).toLowerCase();
  if (!['.js', '.mjs'].includes(entrypointExtension)) {
    fail('manifest.entrypoint.path must be a JavaScript file (.js or .mjs).');
  }
  const entrypoint = resolvePackageFile(absoluteRoot, manifest.entrypoint.path, 'manifest.entrypoint.path');

  const permissionCount = verifyPermissionList(manifest.permissions);

  requireObject(manifest.license, 'manifest.license');
  requireKeys(manifest.license, ['spdxId', 'textFile'], ['spdxId', 'textFile'], 'manifest.license');
  const spdxId = requireText(manifest.license.spdxId, 'manifest.license.spdxId');
  if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(spdxId)) fail('manifest.license.spdxId has an invalid format.');
  const licenseFile = resolvePackageFile(absoluteRoot, manifest.license.textFile, 'manifest.license.textFile');
  if (fs.statSync(licenseFile).size === 0) fail('manifest.license.textFile must not be empty.');

  return { id, version, entrypointType: manifest.entrypoint.type, permissionCount, executable: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyExtensionManifest();
    console.log('Extension manifest verified: ' + result.id + ' ' + result.version + ', ' + result.permissionCount + ' permission(s). No extension code was executed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
