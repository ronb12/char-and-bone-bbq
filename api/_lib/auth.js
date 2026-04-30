const jwt = require('jsonwebtoken');

const COOKIE = 'cbbq_auth';
const MAX_AGE = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.AUTH_SECRET || '';
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch (e) {
      out[k] = part.slice(i + 1).trim();
    }
  });
  return out;
}

function getTokenFromRequest(req) {
  return parseCookies(req)[COOKIE] || '';
}

function signAuthToken(payload) {
  const secret = getSecret();
  if (!secret) throw new Error('AUTH_SECRET missing');
  return jwt.sign(
    {
      email: payload.email,
      role: payload.role,
      phone: payload.phone || '',
      name: payload.name || '',
    },
    secret,
    { expiresIn: '7d' }
  );
}

function verifyAuthToken(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

function getAuth(req) {
  return verifyAuthToken(getTokenFromRequest(req));
}

function setAuthCookie(res, token) {
  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    COOKIE +
      '=' +
      encodeURIComponent(token) +
      '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
      MAX_AGE +
      secure
  );
}

function clearAuthCookie(res) {
  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + secure
  );
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch (e) {
      return {};
    }
  }
  return {};
}

module.exports = {
  COOKIE,
  getAuth,
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
  parseJsonBody,
};
