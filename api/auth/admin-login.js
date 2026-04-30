const bcrypt = require('bcryptjs');
const { parseJsonBody, signAuthToken, setAuthCookie } = require('../_lib/auth');
const { getAdminEmail, getAdminPasswordHash } = require('../_lib/admin-credentials');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (!process.env.AUTH_SECRET) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'AUTH_SECRET is not set in Vercel environment variables.' }));
  }

  const body = parseJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const adminEmail = getAdminEmail();
  const hash = getAdminPasswordHash();

  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Email and password required' }));
  }

  if (email !== adminEmail) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Invalid email or password' }));
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Invalid email or password' }));
  }

  const token = signAuthToken({ email, role: 'admin' });
  setAuthCookie(res, token);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
