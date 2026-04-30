const Stripe = require('stripe');

const menu = require('../public/menu.json');

const byId = Object.fromEntries(menu.items.map((i) => [i.id, i]));

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: 'Online pay is not configured. Choose pay at pickup or add STRIPE_SECRET_KEY in Vercel.',
      })
    );
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Cart is empty' }));
  }

  const stripeLineItems = [];
  let subtotal = 0;

  for (const line of lines) {
    const item = byId[line.id];
    const qty = Math.min(99, Math.max(1, parseInt(line.qty, 10) || 0));
    if (!item || !qty) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Unknown item or quantity' }));
    }
    subtotal += item.priceCents * qty;
    stripeLineItems.push({
      quantity: qty,
      price_data: {
        currency: 'usd',
        unit_amount: item.priceCents,
        product_data: {
          name: item.name,
          description: item.description?.slice(0, 500) || undefined,
        },
      },
    });
  }

  const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const deliveryFee =
    fulfillment === 'delivery' ? menu.deliveryFeeCents || 0 : 0;
  const taxBase = subtotal + deliveryFee;
  const tax = Math.round(taxBase * (menu.taxRate || 0));

  if (deliveryFee > 0) {
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: deliveryFee,
        product_data: { name: 'Delivery fee' },
      },
    });
  }

  if (tax > 0) {
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: tax,
        product_data: { name: 'Estimated tax' },
      },
    });
  }

  const origin =
    (req.headers['x-forwarded-proto'] || 'https') +
    '://' +
    (req.headers['x-forwarded-host'] || req.headers.host || 'localhost');

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: stripeLineItems,
      success_url: `${origin}/confirmation?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      customer_email: body.email || undefined,
      metadata: {
        order_ref: String(body.orderRef || ''),
        fulfillment,
      },
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({ url: session.url }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message || 'Stripe error' }));
  }
};
