(function () {
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('confirmation-root');
    if (!root) return;

    var params = new URLSearchParams(window.location.search);
    var paid = params.get('paid');
    var refParam = params.get('ref');

    var raw = sessionStorage.getItem('cbbq_last_order');
    var pendingRaw = sessionStorage.getItem('cbbq_pending_order');

    if (paid === '1' && pendingRaw) {
      try {
        var ord = JSON.parse(pendingRaw);
        ord.status = 'paid';
        ord.payment = 'online';
        sessionStorage.removeItem('cbbq_pending_order');
        sessionStorage.setItem('cbbq_last_order', JSON.stringify(ord));
        try {
          var key = 'cbbq_orders_v1';
          var list = JSON.parse(localStorage.getItem(key) || '[]');
          if (!Array.isArray(list)) list = [];
          list.unshift(ord);
          localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
        } catch (e) {}
        CBBQ_Cart.clear();
        raw = JSON.stringify(ord);
      } catch (e) {}
    }

    if (!raw) {
      root.innerHTML =
        '<div class="section"><h1>Order</h1><p class="muted">No order found. <a href="/order">Start an order</a>.</p></div>';
      return;
    }

    var order;
    try {
      order = JSON.parse(raw);
    } catch (e) {
      root.innerHTML = '<p class="alert alert-error">Invalid order data.</p>';
      return;
    }

    if (refParam && order.ref !== refParam) {
      /* allow deep link match */
    }

    var html = '<div class="section" style="max-width:560px">';
    html += '<div class="alert alert-success"><strong>Thank you!</strong> Your order is received.</div>';
    html += '<h1 style="margin-top:0">Order ' + escapeHtml(order.ref) + '</h1>';
    html += '<p class="muted">We’ll confirm by phone if needed. Questions? Call the pit line.</p>';

    html += '<div class="summary-card" style="margin-top:1.5rem;text-align:left">';
    html += '<h2 style="margin-top:0">Details</h2>';
    html +=
      '<p><strong>' +
      escapeHtml(order.customer.name) +
      '</strong><br>' +
      escapeHtml(order.customer.phone) +
      (order.customer.email
        ? '<br>' + escapeHtml(order.customer.email)
        : '') +
      '</p>';
    html +=
      '<p><strong>' +
      (order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup') +
      '</strong>';
    if (order.customer.requestedTime) {
      html +=
        '<br>Requested: ' + escapeHtml(order.customer.requestedTime.replace('T', ' '));
    }
    if (order.address) {
      html +=
        '<br>' +
        escapeHtml(order.address.line1) +
        (order.address.line2 ? ', ' + escapeHtml(order.address.line2) : '') +
        '<br>' +
        escapeHtml(order.address.city) +
        ' ' +
        escapeHtml(order.address.zip);
    }
    html += '</p>';
    if (order.customer.notes) {
      html +=
        '<p><strong>Notes</strong><br>' + escapeHtml(order.customer.notes) + '</p>';
    }

    html += '<h3>Items</h3>';
    for (var i = 0; i < order.lines.length; i++) {
      var l = order.lines[i];
      html +=
        '<div class="cart-line" style="border-color:#eee"><div><strong>' +
        escapeHtml(l.name) +
        '</strong><div class="meta">Qty ' +
        l.qty +
        '</div></div><div class="line-total">' +
        CBBQ_formatMoney(l.lineCents) +
        '</div></div>';
    }
    html +=
      '<div class="cart-totals" style="margin-top:1rem"><div class="grand"><span>Total</span><span>' +
      CBBQ_formatMoney(order.totalCents) +
      '</span></div></div>';
    html += '</div>';

    html +=
      '<p style="margin-top:2rem;display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center">' +
      '<a class="btn btn-primary" href="/order">Order again</a>' +
      '<a class="btn btn-secondary" href="/portal">Customer portal</a></p>';
    html += '</div>';

    root.innerHTML = html;

    if (window.CBBQ_syncOrder) CBBQ_syncOrder(order);
  });
})();
