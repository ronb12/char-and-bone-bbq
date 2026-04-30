(function () {
  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function fetchOpts(extra) {
    var o = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if (extra) {
      for (var k in extra) o[k] = extra[k];
    }
    return o;
  }

  function statusBadge(status) {
    var cls = 'badge-status badge-status--' + String(status || 'placed');
    return '<span class="' + escapeHtml(cls) + '">' + escapeHtml(status || '—') + '</span>';
  }

  function loadOrders() {
    var root = document.getElementById('admin-dashboard-root');
    if (!root) return;

    root.innerHTML = '<p class="muted">Loading…</p>';

    fetch('/api/orders', fetchOpts())
      .then(function (r) {
        return r
          .json()
          .then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          })
          .catch(function () {
            return { ok: r.ok, status: r.status, body: {} };
          });
      })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            root.innerHTML =
              '<p class="alert alert-error">Access denied. <a href="/admin/login">Sign in again</a> as admin.</p>';
            return;
          }
          root.innerHTML =
            '<p class="alert alert-error">' +
            escapeHtml((res.body && res.body.error) || 'Could not load orders') +
            '</p>';
          return;
        }

        var data = res.body;
        var orders = data.orders || [];
        if (!orders.length) {
          root.innerHTML =
            '<p class="muted">No orders in cloud yet. Link <strong>Vercel KV / Redis</strong> and place a test order, or orders stay in customers’ browsers only.</p>';
          return;
        }

        var html =
          '<div class="table-wrap"><table class="data-table"><thead><tr>' +
          '<th>Ref</th><th>When</th><th>Customer</th><th>Fulfillment</th><th>Total</th><th>Status</th><th></th>' +
          '</tr></thead><tbody>';

        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : '';
          var cust = (o.customer && o.customer.name) || '—';
          var phone = (o.customer && o.customer.phone) || '';
          html += '<tr data-ref="' + escapeHtml(o.ref) + '">';
          html += '<td><code>' + escapeHtml(o.ref) + '</code></td>';
          html += '<td>' + escapeHtml(when) + '</td>';
          html +=
            '<td>' +
            escapeHtml(cust) +
            '<div class="muted small">' +
            escapeHtml(phone) +
            '</div></td>';
          html += '<td>' + escapeHtml(o.fulfillment || '') + '</td>';
          html += '<td>' + CBBQ_formatMoney(o.totalCents || 0) + '</td>';
          html += '<td>' + statusSelect(o.ref, o.status) + '</td>';
          html +=
            '<td><button type="button" class="btn btn-ghost btn-sm admin-detail-btn" data-ref="' +
            escapeHtml(o.ref) +
            '">Details</button></td>';
          html += '</tr>';
        }

        html += '</tbody></table></div>';
        html +=
          '<p class="muted small">Cloud store: ' +
          (data.cloud ? 'connected' : 'not connected') +
          ' · Orders API: <code>/api/orders</code></p>';

        root.innerHTML = html;

        root.querySelectorAll('select[data-order-status]').forEach(function (sel) {
          sel.addEventListener('change', function () {
            var ref = sel.getAttribute('data-ref');
            var status = sel.value;
            sel.disabled = true;
            fetch(
              '/api/orders',
              fetchOpts({
                method: 'PATCH',
                body: JSON.stringify({ ref: ref, status: status }),
              })
            )
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, body: j };
                });
              })
              .then(function (r2) {
                sel.disabled = false;
                if (!r2.ok) alert((r2.body && r2.body.error) || 'Update failed');
              })
              .catch(function () {
                sel.disabled = false;
                alert('Network error');
              });
          });
        });

        root.querySelectorAll('.admin-detail-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var ref = btn.getAttribute('data-ref');
            var o = orders.find(function (x) {
              return x.ref === ref;
            });
            if (!o) return;
            var panel = document.getElementById('admin-detail-panel');
            if (!panel) return;
            panel.style.display = 'block';
            panel.innerHTML =
              '<h3>Order ' +
              escapeHtml(o.ref) +
              '</h3><pre class="admin-json">' +
              escapeHtml(JSON.stringify(o, null, 2)) +
              '</pre><button type="button" class="btn btn-secondary" id="admin-detail-close">Close</button>';
            document.getElementById('admin-detail-close').addEventListener('click', function () {
              panel.style.display = 'none';
              panel.innerHTML = '';
            });
          });
        });
      })
      .catch(function () {
        root.innerHTML = '<p class="alert alert-error">Network error.</p>';
      });
  }

  function statusSelect(ref, current) {
    var opts = [
      'placed',
      'pending_payment',
      'paid',
      'preparing',
      'ready',
      'completed',
      'cancelled',
    ];
    var html =
      '<select class="status-select" data-order-status data-ref="' +
      escapeHtml(ref) +
      '">';
    for (var i = 0; i < opts.length; i++) {
      var v = opts[i];
      html +=
        '<option value="' +
        v +
        '"' +
        (v === current ? ' selected' : '') +
        '>' +
        v +
        '</option>';
    }
    html += '</select>';
    return html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/auth/me', fetchOpts())
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.body.user || res.body.user.role !== 'admin') {
          window.location.href = '/admin/login';
          return;
        }
        loadOrders();
        var refresh = document.getElementById('admin-refresh');
        if (refresh) refresh.addEventListener('click', loadOrders);
      })
      .catch(function () {
        window.location.href = '/admin/login';
      });
  });
})();
