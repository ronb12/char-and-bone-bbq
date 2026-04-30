const { clearAuthCookie } = require('../_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  clearAuthCookie(res);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
