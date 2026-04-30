const bcrypt = require('bcryptjs');
const { parseJsonBody, signAuthToken, setAuthCookie } = require('../_lib/auth');
const { hasKv, getCustomerUser } = require('../_lib/kv-users');

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

  if (!hasKv()) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error:
          'Customer sign-in requires Vercel KV or Redis. Add a storage integration to this project.',
      })
    );
  }

  const body = parseJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Email and password required' }));
  }

  const user = await getCustomerUser(email);
  if (!user || !user.passwordHash) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Invalid email or password' }));
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Invalid email or password' }));
  }

  const token = signAuthToken({
    email,
    role: 'customer',
    phone: user.phone || '',
    name: user.name || '',
  });
  setAuthCookie(res, token);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
