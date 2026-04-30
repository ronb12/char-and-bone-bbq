(function () {
  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function localOrdersFor(email) {
    var em = String(email || '')
      .trim()
      .toLowerCase();
    try {
      var list = JSON.parse(localStorage.getItem('cbbq_orders_v1') || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(function (o) {
        var c = o.customer || {};
        var e2 = String(c.email || '')
          .trim()
          .toLowerCase();
        return e2 === em;
      });
    } catch (e) {
      return [];
    }
  }

  function mergeByRef(cloud, local) {
    var map = {};
    for (var i = 0; i < local.length; i++) map[local[i].ref] = local[i];
    for (var j = 0; j < cloud.length; j++) map[cloud[j].ref] = cloud[j];
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (x, y) {
        return new Date(y.createdAt || 0) - new Date(x.createdAt || 0);
      });
  }

  function statusLabel(status) {
    var cls = 'badge-status badge-status--' + String(status || 'placed');
    return '<span class="' + escapeHtml(cls) + '">' + escapeHtml(status || '—') + '</span>';
  }

  function renderWithUser(user) {
    var root = document.getElementById('portal-root');
    var meta = document.getElementById('portal-meta');
    if (!root) return;

    root.innerHTML = '<p class="muted">Loading your orders…</p>';

    fetch('/api/orders', { credentials: 'include' })
      .then(function (r) {
        return r.json().catch(function () {
          return { orders: [] };
        });
      })
      .then(function (data) {
        var cloud = data.orders || [];
        var local = localOrdersFor(user.email);
        var orders = mergeByRef(cloud, local);

        if (meta) {
          meta.innerHTML =
            'Signed in as <strong>' +
            escapeHtml(user.email) +
            '</strong> · Cloud: ' +
            (data.cloud ? 'on' : 'off (orders may only show from this device)') +
            '';
        }

        if (!orders.length) {
          root.innerHTML =
            '<p class="muted">No orders yet. <a href="/order">Browse the menu</a> — use this email at checkout.</p>';
          return;
        }

        var html =
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Placed</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>';
        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : '';
          html += '<tr>';
          html += '<td><code>' + escapeHtml(o.ref) + '</code></td>';
          html += '<td>' + escapeHtml(when) + '</td>';
          html += '<td>' + CBBQ_formatMoney(o.totalCents || 0) + '</td>';
          html += '<td>' + statusLabel(o.status) + '</td>';
          html +=
            '<td><button type="button" class="btn btn-primary btn-sm portal-reorder" data-idx="' +
            i +
            '">Reorder</button></td>';
          html += '</tr>';
        }
        html += '</tbody></table></div>';
        root.innerHTML = html;

        root.querySelectorAll('.portal-reorder').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-idx'), 10);
            var o = orders[idx];
            if (!o || !o.lines) return;
            CBBQ_Cart.clear();
            for (var j = 0; j < o.lines.length; j++) {
              var l = o.lines[j];
              CBBQ_Cart.add(l.id, l.qty, { id: l.id, priceCents: l.unitCents });
            }
            window.location.href = '/order';
          });
        });
      })
      .catch(function () {
        root.innerHTML =
          '<p class="alert alert-error">Could not reach server. Showing local orders only.</p>';
        var local = localOrdersFor(user.email);
        if (local.length) {
          var orders = mergeByRef([], local);
          root.innerHTML +=
            '<p class="muted">Offline list (' + orders.length + '). Open the portal online for cloud sync.</p>';
        }
      });
  }

  function wireAdminSwitch() {
    var wrap = document.getElementById('portal-admin-switch');
    var pass = document.getElementById('portal-switch-admin-password');
    var btn = document.getElementById('portal-switch-admin-btn');
    var errEl = document.getElementById('portal-switch-admin-error');
    if (!wrap || !pass || !btn) return;
    btn.addEventListener('click', function () {
      if (errEl) {
        errEl.style.display = 'none';
        errEl.textContent = '';
      }
      var password = pass.value;
      if (!password) {
        if (errEl) {
          errEl.textContent = 'Enter your admin password';
          errEl.style.display = 'block';
        }
        return;
      }
      btn.disabled = true;
      fetch('/api/auth/switch-to-admin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, body: j };
          });
        })
        .then(function (res) {
          btn.disabled = false;
          if (res.ok) {
            window.location.href = '/admin/';
            return;
          }
          if (errEl) {
            errEl.textContent = (res.body && res.body.error) || 'Could not switch';
            errEl.style.display = 'block';
          }
        })
        .catch(function () {
          btn.disabled = false;
          if (errEl) {
            errEl.textContent = 'Network error';
            errEl.style.display = 'block';
          }
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var out = document.getElementById('portal-signout');
    if (out) {
      out.addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
          window.location.href = '/customer-portal';
        });
      });
    }

    fetch('/api/auth/me', { credentials: 'include' })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.body.user) {
          window.location.href = '/customer-portal';
          return;
        }
        var user = res.body.user;
        if (user.role === 'admin') {
          window.location.href = '/admin/';
          return;
        }
        if (user.role !== 'customer') {
          window.location.href = '/customer-portal';
          return;
        }
        if (user.canSwitchToAdmin) {
          var sw = document.getElementById('portal-admin-switch');
          if (sw) sw.style.display = 'block';
          wireAdminSwitch();
        }
        renderWithUser(user);
      })
      .catch(function () {
        window.location.href = '/customer-portal';
      });
  });
})();
