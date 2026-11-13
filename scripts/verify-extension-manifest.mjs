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
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const ENTRYPOINT_PATH_PATTERN = /^(?!\/)(?!.*\.\.)[A-Za-z0-9_/-]+\.(?:js|mjs)$/;
const LICENSE_TEXT_PATH_PATTERN = /^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]+$/;

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

function requireText(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(label + ' must be a non-empty string.');
  if (maxLength !== undefined && Array.from(value).length > maxLength) {
    fail(label + ' must be no more than ' + maxLength + ' characters.');
  }
  // Preserve the original value: trimming here can turn a manifest token
  // that the JSON Schema rejects into a different, valid runtime value.
  return value;
}

function requireHttps(value, label) {
  const raw = requireText(value, label);
  if (!raw.startsWith('https://')) fail(label + ' must use the lowercase https:// scheme.');
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
    requireText(permission.reason, label + '.reason', 240);
  }
  return seen.size;
}

export function verifyExtensionManifest({ rootDir = DEFAULT_ROOT } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  let rootStat;
  try { rootStat = fs.lstatSync(absoluteRoot); }
  catch (error) { fail('extension package root cannot be accessed: ' + error.message); }
  if (rootStat.isSymbolicLink()) fail('extension package root must not be a symbolic link.');
  if (!rootStat.isDirectory()) fail('extension package root must be a directory.');

  const manifestPath = path.join(absoluteRoot, 'extension.json');
  let manifestStat;
  try { manifestStat = fs.lstatSync(manifestPath); }
  catch (error) { fail('cannot read extension.json: ' + error.message); }
  if (manifestStat.isSymbolicLink()) fail('extension.json must not be a symbolic link.');
  if (!manifestStat.isFile()) fail('extension.json must be a regular file.');

  let manifest;
  let manifestHandle = null;
  try {
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
    manifestHandle = fs.openSync(manifestPath, flags);
    const openedStat = fs.fstatSync(manifestHandle);
    const currentStat = fs.lstatSync(manifestPath);
    if (!openedStat.isFile()
        || openedStat.dev !== manifestStat.dev
        || openedStat.ino !== manifestStat.ino
        || openedStat.size !== manifestStat.size
        || currentStat.isSymbolicLink()
        || !currentStat.isFile()
        || currentStat.dev !== openedStat.dev
        || currentStat.ino !== openedStat.ino
        || currentStat.size !== openedStat.size) {
      throw new Error('extension.json changed during verification.');
    }
    manifest = JSON.parse(fs.readFileSync(manifestHandle, 'utf8'));
  } catch (error) {
    fail('cannot read extension.json: ' + error.message);
  } finally {
    if (manifestHandle !== null) {
      try { fs.closeSync(manifestHandle); } catch {}
    }
  }

  requireObject(manifest, 'manifest');
  const keys = ['manifestVersion', 'id', 'name', 'version', 'description', 'publisher', 'apiVersion', 'supportedProducts', 'entrypoint', 'permissions', 'license'];
  requireKeys(manifest, keys, keys, 'manifest');
  if (manifest.manifestVersion !== 1) fail('manifestVersion must be 1.');

  const id = requireText(manifest.id, 'manifest.id');
  if (!SLUG.test(id)) fail('manifest.id must use lowercase letters, numbers and single hyphens.');
  requireText(manifest.name, 'manifest.name', 100);
  const version = requireText(manifest.version, 'manifest.version');
  if (!SEMVER.test(version)) fail('manifest.version must be a valid semantic version.');
  requireText(manifest.description, 'manifest.description', 240);

  requireObject(manifest.publisher, 'manifest.publisher');
  requireKeys(manifest.publisher, ['name', 'url'], ['name', 'url'], 'manifest.publisher');
  requireText(manifest.publisher.name, 'manifest.publisher.name', 100);
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
  const entrypointPath = requireText(manifest.entrypoint.path, 'manifest.entrypoint.path');
  const entrypointExtension = path.extname(entrypointPath).toLowerCase();
  if (!['.js', '.mjs'].includes(entrypointExtension)) {
    fail('manifest.entrypoint.path must be a JavaScript file (.js or .mjs).');
  }
  const entrypoint = resolvePackageFile(absoluteRoot, entrypointPath, 'manifest.entrypoint.path');
  if (!ENTRYPOINT_PATH_PATTERN.test(entrypointPath)) {
    fail('manifest.entrypoint.path must match a schema-approved path (.js or .mjs).');
  }

  const permissionCount = verifyPermissionList(manifest.permissions);

  requireObject(manifest.license, 'manifest.license');
  requireKeys(manifest.license, ['spdxId', 'textFile'], ['spdxId', 'textFile'], 'manifest.license');
  const spdxId = requireText(manifest.license.spdxId, 'manifest.license.spdxId');
  if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(spdxId)) fail('manifest.license.spdxId has an invalid format.');
  const licenseTextFile = requireText(manifest.license.textFile, 'manifest.license.textFile');
  const licenseFile = resolvePackageFile(absoluteRoot, licenseTextFile, 'manifest.license.textFile');
  if (!LICENSE_TEXT_PATH_PATTERN.test(licenseTextFile)) {
    fail('manifest.license.textFile must match a schema-approved path.');
  }
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
