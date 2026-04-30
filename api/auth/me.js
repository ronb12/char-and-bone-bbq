const { getAuth } = require('../_lib/auth');
const { getAdminEmail } = require('../_lib/admin-credentials');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = getAuth(req);
  if (!auth) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Not signed in' }));
  }

  const adminEmail = getAdminEmail();
  const emailLower = String(auth.email || '').trim().toLowerCase();
  const canSwitchToAdmin =
    auth.role === 'customer' && emailLower === adminEmail;
  const canSwitchToCustomer = auth.role === 'admin';

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      user: {
        email: auth.email,
        role: auth.role,
        phone: auth.phone || '',
        name: auth.name || '',
        canSwitchToAdmin: canSwitchToAdmin,
        canSwitchToCustomer: canSwitchToCustomer,
      },
    })
  );
};
