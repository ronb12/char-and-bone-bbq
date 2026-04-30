let kv = null;
try {
  kv = require('@vercel/kv').kv;
} catch (e) {
  kv = null;
}

function hasKv() {
  return !!(kv && process.env.KV_REST_API_URL);
}

function userKey(email) {
  return 'cbbq:user:' + String(email).trim().toLowerCase();
}

async function getCustomerUser(email) {
  if (!hasKv()) return null;
  const raw = await kv.get(userKey(email));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveCustomerUser(email, data) {
  if (!hasKv()) throw new Error('NO_KV');
  await kv.set(userKey(email), JSON.stringify(data));
}

module.exports = {
  hasKv,
  getCustomerUser,
  saveCustomerUser,
};
