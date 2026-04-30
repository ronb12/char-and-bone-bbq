/**
 * Orders API — KV storage when linked.
 * GET: customer (JWT) = own orders by email; admin (JWT) = all orders.
 * POST: public upsert by ref. PATCH: admin JWT only.
 */

let kv = null;
try {
  kv = require('@vercel/kv').kv;
} catch (e) {
  kv = null;
}

const { getAuth } = require('./_lib/auth');

const KEY = 'cbbq:orders:v1';

function hasKv() {
  return !!(kv && process.env.KV_REST_API_URL);
}

async function readOrders() {
  if (!hasKv()) return [];
  try {
    const raw = await kv.get(KEY);
    if (!raw) return [];
    if (typeof raw === 'string') return JSON.parse(raw);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

async function writeOrders(orders) {
  if (!hasKv()) return false;
  await kv.set(KEY, JSON.stringify(orders.slice(0, 2000)));
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    const auth = getAuth(req);

    if (auth && auth.role === 'customer') {
      const email = String(auth.email || '').trim().toLowerCase();
      const orders = await readOrders();
      const filtered = orders.filter(function (o) {
        const c = o.customer || {};
        const em = String(c.email || '').trim().toLowerCase();
        return em === email;
      });
      return res.status(200).end(
        JSON.stringify({
          orders: filtered,
          cloud: hasKv(),
        })
      );
    }

    if (auth && auth.role === 'admin') {
      const orders = await readOrders();
      return res.status(200).end(
        JSON.stringify({
          orders: orders,
          cloud: hasKv(),
        })
      );
    }

    return res.status(401).end(JSON.stringify({ error: 'Sign in to view orders' }));
  }

  if (req.method === 'POST') {
    let order = {};
    try {
      order = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch (e) {
      return res.status(400).end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    if (!order.ref || typeof order.ref !== 'string') {
      return res.status(400).end(JSON.stringify({ error: 'Order ref required' }));
    }

    const orders = await readOrders();
    const idx = orders.findIndex(function (o) {
      return o.ref === order.ref;
    });
    if (idx >= 0) orders[idx] = order;
    else orders.unshift(order);

    const stored = await writeOrders(orders);
    return res.status(200).end(JSON.stringify({ ok: true, stored: stored }));
  }

  if (req.method === 'PATCH') {
    const auth = getAuth(req);
    if (!auth || auth.role !== 'admin') {
      return res.status(403).end(JSON.stringify({ error: 'Admin access required' }));
    }

    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch (e) {
      return res.status(400).end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    const ref = body.ref;
    const status = body.status;
    if (!ref || !status) {
      return res.status(400).end(JSON.stringify({ error: 'ref and status required' }));
    }

    const allowed = [
      'placed',
      'pending_payment',
      'paid',
      'preparing',
      'ready',
      'completed',
      'cancelled',
    ];
    if (allowed.indexOf(status) < 0) {
      return res.status(400).end(JSON.stringify({ error: 'Invalid status' }));
    }

    const orders = await readOrders();
    const o = orders.find(function (x) {
      return x.ref === ref;
    });
    if (!o) {
      return res.status(404).end(JSON.stringify({ error: 'Order not found' }));
    }
    o.status = status;
    o.updatedAt = new Date().toISOString();
    await writeOrders(orders);
    return res.status(200).end(JSON.stringify({ ok: true, order: o }));
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method not allowed' }));
};
