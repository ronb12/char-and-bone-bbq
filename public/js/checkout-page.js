(function () {
  var menuConfig = null;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderSummary(fulfillment) {
    var el = document.getElementById('checkout-summary');
    if (!el || !menuConfig) return;
    var t = CBBQ_Cart.withFulfillment(menuConfig, fulfillment);
    if (!t.lines.length) {
      el.innerHTML =
        '<p class="muted">Your cart is empty. <a href="/order">Browse the menu</a></p>';
      return;
    }
    var html = '';
    for (var i = 0; i < t.lines.length; i++) {
      var l = t.lines[i];
      html +=
        '<div class="cart-line" style="border:none;padding:0.4rem 0">' +
        '<div><strong>' +
        escapeHtml(l.name) +
        '</strong><div class="meta">' +
        l.qty +
        ' × ' +
        CBBQ_formatMoney(l.unitCents) +
        '</div></div><div class="line-total">' +
        CBBQ_formatMoney(l.lineCents) +
        '</div></div>';
    }
    html +=
      '<div class="cart-totals" style="border-top:1px solid #e8dfd2;margin-top:0.75rem">' +
      '<div><span>Subtotal</span><span>' +
      CBBQ_formatMoney(t.subtotalCents) +
      '</span></div>';
    if (t.deliveryFeeCents > 0) {
      html +=
        '<div><span>Delivery fee</span><span>' +
        CBBQ_formatMoney(t.deliveryFeeCents) +
        '</span></div>';
    }
    html +=
      '<div><span>Tax (' +
      Math.round(menuConfig.taxRate * 100) +
      '%)</span><span>' +
      CBBQ_formatMoney(t.taxCents) +
      '</span></div>' +
      '<div class="grand"><span>Total</span><span>' +
      CBBQ_formatMoney(t.totalCents) +
      '</span></div></div>';
    el.innerHTML = html;
  }

  function genOrderRef() {
    return 'CBBQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function saveOrderHistory(order) {
    try {
      var key = 'cbbq_orders_v1';
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(list)) list = [];
      list.unshift(order);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('checkout-form');
    var err = document.getElementById('checkout-error');
    var fulfillmentInputs = document.querySelectorAll('input[name="fulfillment"]');
    var addressWrap = document.getElementById('delivery-address-wrap');

    fetch('/menu.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        menuConfig = data;
        var ff =
          document.querySelector('input[name="fulfillment"]:checked') &&
          document.querySelector('input[name="fulfillment"]:checked').value;
        renderSummary(ff || 'pickup');

        fulfillmentInputs.forEach(function (inp) {
          inp.addEventListener('change', function () {
            var f = inp.value;
            addressWrap.style.display = f === 'delivery' ? 'grid' : 'none';
            renderSummary(f);
          });
        });

        if (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            err.style.display = 'none';
            err.textContent = '';

            var fulfillment =
              (document.querySelector('input[name="fulfillment"]:checked') || {}).value ||
              'pickup';
            var t = CBBQ_Cart.withFulfillment(menuConfig, fulfillment);
            if (!t.lines.length) {
              err.textContent = 'Your cart is empty.';
              err.style.display = 'block';
              return;
            }

            var name = document.getElementById('cust-name').value.trim();
            var email = document.getElementById('cust-email').value.trim();
            var phone = document.getElementById('cust-phone').value.trim();
            var when = document.getElementById('cust-when').value;
            var notes = document.getElementById('cust-notes').value.trim();
            var pay = (
              document.querySelector('input[name="payment"]:checked') || {}
            ).value;

            if (!name || !phone) {
              err.textContent = 'Name and phone are required.';
              err.style.display = 'block';
              return;
            }
            if (fulfillment === 'delivery') {
              var line1 = document.getElementById('addr-line1').value.trim();
              var city = document.getElementById('addr-city').value.trim();
              var zip = document.getElementById('addr-zip').value.trim();
              if (!line1 || !city || !zip) {
                err.textContent = 'Enter full delivery address.';
                err.style.display = 'block';
                return;
              }
            }

            var orderRef = genOrderRef();
            var order = {
              ref: orderRef,
              createdAt: new Date().toISOString(),
              customer: {
                name: name,
                email: email,
                phone: phone,
                requestedTime: when,
                notes: notes,
              },
              fulfillment: fulfillment,
              address:
                fulfillment === 'delivery'
                  ? {
                      line1: document.getElementById('addr-line1').value.trim(),
                      line2: document.getElementById('addr-line2').value.trim(),
                      city: document.getElementById('addr-city').value.trim(),
                      zip: document.getElementById('addr-zip').value.trim(),
                    }
                  : null,
              lines: t.lines,
              subtotalCents: t.subtotalCents,
              deliveryFeeCents: t.deliveryFeeCents,
              taxCents: t.taxCents,
              totalCents: t.totalCents,
              payment: pay,
              status: pay === 'online' ? 'pending_payment' : 'placed',
            };

            if (pay === 'online') {
              fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lines: CBBQ_Cart.getLines(),
                  email: email,
                  orderRef: orderRef,
                  fulfillment: fulfillment,
                }),
              })
                .then(function (r) {
                  return r.json().then(function (j) {
                    return { ok: r.ok, body: j };
                  });
                })
                .then(function (res) {
                  if (!res.ok) {
                    err.textContent = res.body.error || 'Payment could not start.';
                    err.style.display = 'block';
                    return;
                  }
                  if (res.body.url) {
                    sessionStorage.setItem(
                      'cbbq_pending_order',
                      JSON.stringify(order)
                    );
                    window.location.href = res.body.url;
                  } else {
                    err.textContent = 'No checkout URL returned.';
                    err.style.display = 'block';
                  }
                })
                .catch(function () {
                  err.textContent = 'Network error starting checkout.';
                  err.style.display = 'block';
                });
              return;
            }

            saveOrderHistory(order);
            if (window.CBBQ_syncOrder) CBBQ_syncOrder(order);
            sessionStorage.setItem('cbbq_last_order', JSON.stringify(order));
            CBBQ_Cart.clear();
            window.location.href = '/confirmation?ref=' + encodeURIComponent(orderRef);
          });
        }
      })
      .catch(function () {
        document.getElementById('checkout-summary').innerHTML =
          '<p class="alert alert-error">Menu failed to load.</p>';
      });
  });
})();
