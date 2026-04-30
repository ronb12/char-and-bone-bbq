const { getAuth, signAuthToken, setAuthCookie } = require('../_lib/auth');
const { getCustomerUser } = require('../_lib/kv-users');

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
  if (!auth || auth.role !== 'admin') {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Admin session required' }));
  }

  const email = String(auth.email || '').trim().toLowerCase();
  let phone = '';
  let name = '';

  try {
    const u = await getCustomerUser(email);
    if (u) {
      phone = u.phone || '';
      name = u.name || '';
    }
  } catch (e) {}

  const token = signAuthToken({ email, role: 'customer', phone, name });
  setAuthCookie(res, token);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
