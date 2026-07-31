/* Helpers compartidos de la API del panel.
   Los archivos que empiezan con _ no los rutea Vercel. */
const crypto = require('crypto');

// Por defecto, el repositorio desde el que se hizo este deploy. Nunca un repo
// hardcodeado: un clon que se olvide de GITHUB_REPO escribiría dentro de aquel.
const OWNER  = process.env.GITHUB_OWNER  || process.env.VERCEL_GIT_REPO_OWNER || '';
const REPO   = process.env.GITHUB_REPO   || process.env.VERCEL_GIT_REPO_SLUG  || '';
const BRANCH = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';

const COOKIE_NAME = 'ctrlz_session';
const SESSION_MS = 12 * 60 * 60 * 1000;

// Únicos archivos que se pueden escribir por la API.
const ALLOWED_FILES = ['content.json'];
const IMAGE_DIR = 'img/';

function isConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD_HASH &&
    process.env.GITHUB_TOKEN &&
    process.env.SESSION_SECRET &&
    OWNER && REPO
  );
}

/* ---------- contraseña ---------- */

// Guardada como: scrypt$<saltBase64>$<keyBase64>  (ver scripts/hash-password.js)
function checkPassword(password) {
  const stored = process.env.ADMIN_PASSWORD_HASH || '';
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  if (typeof password !== 'string' || !password) return false;

  const salt = Buffer.from(parts[1], 'base64');
  const key  = Buffer.from(parts[2], 'base64');
  let derived;
  try {
    derived = crypto.scryptSync(password, salt, key.length);
  } catch (e) {
    return false;
  }
  return key.length === derived.length && crypto.timingSafeEqual(key, derived);
}

/* ---------- sesión ---------- */

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}

function verify(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const idx = token.lastIndexOf('.');
  const body = token.slice(0, idx);
  const mac  = token.slice(idx + 1);

  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function sessionCookie(value, maxAgeSeconds) {
  return [
    COOKIE_NAME + '=' + value,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=' + maxAgeSeconds
  ].join('; ');
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.indexOf(name + '=') === 0);
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function currentSession(req) {
  return verify(readCookie(req, COOKIE_NAME));
}

// Devuelve true cuando se puede seguir; si no, ya respondió.
function requireAuth(req, res) {
  if (!isConfigured()) {
    res.status(501).json({ error: 'not_configured' });
    return false;
  }
  if (!currentSession(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

/* ---------- github ---------- */

function contentsUrl(path) {
  return 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path;
}

function ghHeaders() {
  return {
    'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ctrlz-presskit-admin'
  };
}

async function ghRead(path) {
  const res = await fetch(contentsUrl(path) + '?ref=' + BRANCH, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('github_read_' + res.status);
  return res.json();
}

async function ghWrite(path, contentBase64, message) {
  // El sha se busca del lado del servidor: el navegador nunca lo maneja.
  const existing = await ghRead(path);
  const body = {
    message: message,
    content: contentBase64,
    branch: BRANCH
  };
  if (existing && existing.sha) body.sha = existing.sha;

  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error('github_write_' + res.status + ':' + detail.slice(0, 180));
  }
  return res.json();
}

function isAllowedFile(file) {
  return ALLOWED_FILES.indexOf(file) !== -1;
}

// img/<slot>-<digitos>.webp — sin traversal ni extensiones arbitrarias.
function isAllowedImagePath(path) {
  return /^img\/[a-z0-9-]+-\d+\.webp$/.test(path);
}

module.exports = {
  OWNER, REPO, BRANCH, COOKIE_NAME, SESSION_MS, IMAGE_DIR,
  isConfigured, checkPassword,
  sign, verify, sessionCookie, currentSession, requireAuth,
  ghRead, ghWrite, isAllowedFile, isAllowedImagePath
};
