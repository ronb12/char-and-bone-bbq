const { getAuth } = require('../_lib/auth');

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

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      user: {
        email: auth.email,
        role: auth.role,
        phone: auth.phone || '',
        name: auth.name || '',
      },
    })
  );
};
