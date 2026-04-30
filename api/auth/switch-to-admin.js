const bcrypt = require('bcryptjs');
const { getAuth, parseJsonBody, signAuthToken, setAuthCookie } = require('../_lib/auth');
const { getAdminEmail, getAdminPasswordHash } = require('../_lib/admin-credentials');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (!process.env.AUTH_SECRET) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'AUTH_SECRET is not set.' }));
  }

  const auth = getAuth(req);
  if (!auth || auth.role !== 'customer') {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Customer session required' }));
  }

  const adminEmail = getAdminEmail();
  if (String(auth.email || '').trim().toLowerCase() !== adminEmail) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Not allowed' }));
  }

  const body = parseJsonBody(req);
  const password = String(body.password || '');
  if (!password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Password required' }));
  }

  const hash = getAdminPasswordHash();
  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Invalid password' }));
  }

  const token = signAuthToken({ email: adminEmail, role: 'admin' });
  setAuthCookie(res, token);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
