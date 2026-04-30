const bcrypt = require('bcryptjs');
const { parseJsonBody, signAuthToken, setAuthCookie } = require('../_lib/auth');
const { hasKv, getCustomerUser, saveCustomerUser } = require('../_lib/kv-users');

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

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
          'Registration requires Vercel KV or Redis. Add a storage integration to this project.',
      })
    );
  }

  const body = parseJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const password2 = String(body.passwordConfirm || body.password2 || '');
  const phone = String(body.phone || '').trim();
  const name = String(body.name || '').trim();

  if (!validEmail(email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Valid email required' }));
  }
  if (password.length < 8) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Password must be at least 8 characters' }));
  }
  if (password2 && password !== password2) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Passwords do not match' }));
  }
  if (!phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Phone number required' }));
  }

  const existing = await getCustomerUser(email);
  if (existing) {
    res.statusCode = 409;
    return res.end(JSON.stringify({ error: 'An account with this email already exists' }));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await saveCustomerUser(email, {
    passwordHash,
    phone,
    name,
    createdAt: new Date().toISOString(),
  });

  const token = signAuthToken({ email, role: 'customer', phone, name });
  setAuthCookie(res, token);
  res.statusCode = 201;
  return res.end(JSON.stringify({ ok: true }));
};
