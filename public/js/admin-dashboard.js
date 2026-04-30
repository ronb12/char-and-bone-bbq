(function () {
  var LS_ACCEPT = 'cbbq_admin_accepting_orders';
  var LS_NOTES = 'cbbq_admin_kitchen_notes';

  var lastOrders = [];
  var lastCloud = false;
  var lastFetchAt = null;

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function fetchOpts(extra) {
    var o = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  function startOfLocalDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function isToday(iso) {
    if (!iso) return false;
    var t = new Date(iso).getTime();
    if (isNaN(t)) return false;
    var start = startOfLocalDay(new Date()).getTime();
    var end = start + 86400000;
    return t >= start && t < end;
  }

  function statusBadge(status) {
    var cls = 'badge-status badge-status--' + String(status || 'placed');
    return '<span class="' + escapeHtml(cls) + '">' + escapeHtml(status || '—') + '</span>';
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
      '<select class="status-select admin-table-select" data-order-status data-ref="' +
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

  function computeMetrics(orders) {
    var todayOrders = orders.filter(function (o) {
      return isToday(o.createdAt);
    });
    var todayCents = todayOrders.reduce(function (s, o) {
      return s + (o.totalCents || 0);
    }, 0);
    var active = orders.filter(function (o) {
      var st = o.status || '';
      return st !== 'completed' && st !== 'cancelled';
    });
    var ready = orders.filter(function (o) {
      return o.status === 'ready';
    });
    var inPit = orders.filter(function (o) {
      var st = o.status || '';
      return st === 'paid' || st === 'preparing';
    });
    return {
      todayCount: todayOrders.length,
      todayCents: todayCents,
      activeCount: active.length,
      readyCount: ready.length,
      pitCount: inPit.length,
    };
  }

  function metricCard(label, value, hint) {
    return (
      '<div class="admin-metric">' +
      '<div class="admin-metric-value">' +
      value +
      '</div>' +
      '<div class="admin-metric-label">' +
      escapeHtml(label) +
      '</div>' +
      (hint ? '<div class="admin-metric-hint muted small">' + escapeHtml(hint) + '</div>' : '') +
      '</div>'
    );
  }

  function renderMetrics(orders) {
    var el = document.getElementById('admin-metrics');
    if (!el) return;
    var m = computeMetrics(orders);
    el.innerHTML =
      metricCard('Orders today', String(m.todayCount), 'Placed today (local time)') +
      metricCard('Sales today', CBBQ_formatMoney(m.todayCents), 'Sum of order totals placed today') +
      metricCard('Active tickets', String(m.activeCount), 'Not completed or cancelled') +
      metricCard('Ready for pickup', String(m.readyCount), 'Call name or text when hot') +
      metricCard('On the pit board', String(m.pitCount), 'Paid + preparing');
  }

  function sortByCreatedAsc(a, b) {
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  }

  function renderPrepQueue(orders) {
    var el = document.getElementById('admin-prep-queue');
    if (!el) return;
    var pit = orders
      .filter(function (o) {
        var st = o.status || '';
        return st === 'paid' || st === 'preparing';
      })
      .sort(sortByCreatedAsc);
    if (!pit.length) {
      el.innerHTML =
        '<p class="muted admin-empty-pit">No tickets on the board. Paid orders will show here first.</p>';
      return;
    }
    var html = '<ul class="admin-pit-list">';
    for (var i = 0; i < pit.length; i++) {
      var o = pit[i];
      var c = o.customer || {};
      var name = c.name || 'Guest';
      var when = o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      html += '<li class="admin-pit-item">';
      html += '<div class="admin-pit-main">';
      html += '<strong>' + escapeHtml(name) + '</strong>';
      html += ' · <code class="admin-pit-ref">' + escapeHtml(o.ref) + '</code>';
      html += '<span class="admin-pit-meta muted small"> ' + escapeHtml(when) + ' · ' + escapeHtml(o.fulfillment || '') + '</span>';
      html += '</div>';
      html += '<div class="admin-pit-side">' + statusBadge(o.status) + '</div>';
      html += '</li>';
    }
    html += '</ul>';
    el.innerHTML = html;
  }

  function orderMatchesSearch(o, q) {
    if (!q) return true;
    q = q.toLowerCase();
    var c = o.customer || {};
    var blob =
      (o.ref || '') +
      ' ' +
      (c.name || '') +
      ' ' +
      (c.phone || '') +
      ' ' +
      (c.email || '') +
      ' ' +
      (o.fulfillment || '');
    return blob.toLowerCase().indexOf(q) !== -1;
  }

  function getFilteredOrders() {
    var status = (document.getElementById('admin-filter-status') || {}).value || '';
    var q = (document.getElementById('admin-search') || {}).value || '';
    q = String(q).trim();
    return lastOrders.filter(function (o) {
      if (status && (o.status || '') !== status) return false;
      return orderMatchesSearch(o, q);
    });
  }

  function bindOrderRowHandlers(orders) {
    var root = document.getElementById('admin-orders-table-root');
    if (!root) return;

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
            else loadOrders();
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
        var lines = (o.lines || [])
          .map(function (l) {
            var lineTotal =
              l.lineCents != null ? l.lineCents : (l.unitCents || 0) * (l.qty || 0);
            return (l.qty || 0) + '× ' + (l.name || l.id || 'item') + ' — ' + CBBQ_formatMoney(lineTotal);
          })
          .join('\n');
        var c = o.customer || {};
        panel.innerHTML =
          '<div class="admin-detail-inner">' +
          '<div class="admin-detail-head">' +
          '<h3>Order ' +
          escapeHtml(o.ref) +
          '</h3>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="admin-detail-close">Close</button>' +
          '</div>' +
          '<div class="admin-detail-grid">' +
          '<div><h4>Customer</h4><p>' +
          escapeHtml(c.name || '—') +
          '</p><p class="muted small">' +
          escapeHtml(c.phone || '') +
          (c.phone && c.email ? '<br>' : '') +
          escapeHtml(c.email || '') +
          '</p></div>' +
          '<div><h4>Fulfillment</h4><p>' +
          escapeHtml(o.fulfillment || '—') +
          '</p><h4>Total</h4><p>' +
          CBBQ_formatMoney(o.totalCents || 0) +
          '</p></div>' +
          '</div>' +
          '<h4>Line items</h4><pre class="admin-detail-lines">' +
          escapeHtml(lines || '—') +
          '</pre>' +
          '<h4>Raw JSON</h4><pre class="admin-json">' +
          escapeHtml(JSON.stringify(o, null, 2)) +
          '</pre>' +
          '</div>';
        document.getElementById('admin-detail-close').addEventListener('click', function () {
          panel.style.display = 'none';
          panel.innerHTML = '';
        });
      });
    });
  }

  function renderOrdersTable(orders) {
    var root = document.getElementById('admin-orders-table-root');
    if (!root) return;

    if (!orders.length) {
      root.innerHTML =
        '<p class="muted admin-empty-table">' +
        (lastOrders.length
          ? 'No orders match this filter. Clear search or set status to “All”.'
          : 'No orders in cloud yet. Connect <strong>Vercel KV / Redis</strong>, then place a test order from the live site. Until then, guests’ carts only save on their devices.') +
        '</p>';
      return;
    }

    var html =
      '<div class="table-wrap admin-table-wrap"><table class="data-table admin-data-table"><thead><tr>' +
      '<th>Ref</th><th>When</th><th>Customer</th><th>Fulfillment</th><th>Total</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : '';
      var cust = (o.customer && o.customer.name) || '—';
      var phone = (o.customer && o.customer.phone) || '';
      html += '<tr data-ref="' + escapeHtml(o.ref) + '">';
      html += '<td><code>' + escapeHtml(o.ref) + '</code></td>';
      html += '<td class="admin-cell-nowrap">' + escapeHtml(when) + '</td>';
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
    root.innerHTML = html;
    bindOrderRowHandlers(orders);
  }

  function renderSystemStatus() {
    var el = document.getElementById('admin-system-status');
    if (!el) return;
    var sync = lastFetchAt ? lastFetchAt.toLocaleString() : '—';
    el.innerHTML =
      '<p><strong>Order store</strong><br><span class="muted">' +
      (lastCloud ? 'Connected (KV / Redis)' : 'Not connected — list will stay empty until storage is linked.') +
      '</span></p>' +
      '<p><strong>Last refresh</strong><br><span class="muted">' +
      escapeHtml(sync) +
      '</span></p>';
  }

  function renderAllFromCache() {
    renderMetrics(lastOrders);
    renderPrepQueue(lastOrders);
    renderOrdersTable(getFilteredOrders());
    renderSystemStatus();
  }

  function exportCsv() {
    var rows = getFilteredOrders();
    var headers = ['ref', 'createdAt', 'customer_name', 'email', 'phone', 'fulfillment', 'total_cents', 'status'];
    function cell(v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [headers.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var o = rows[i];
      var c = o.customer || {};
      lines.push(
        [
          cell(o.ref),
          cell(o.createdAt),
          cell(c.name),
          cell(c.email),
          cell(c.phone),
          cell(o.fulfillment),
          cell(o.totalCents),
          cell(o.status),
        ].join(',')
      );
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'char-bone-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function wireShiftTools() {
    var accepting = document.getElementById('admin-accepting-orders');
    var notes = document.getElementById('admin-kitchen-notes');
    var saved = document.getElementById('admin-notes-saved');

    if (accepting) {
      var v = localStorage.getItem(LS_ACCEPT);
      accepting.checked = v !== '0';
      accepting.addEventListener('change', function () {
        localStorage.setItem(LS_ACCEPT, accepting.checked ? '1' : '0');
      });
    }

    var notesTimer = null;
    if (notes) {
      notes.value = localStorage.getItem(LS_NOTES) || '';
      function saveNotes() {
        localStorage.setItem(LS_NOTES, notes.value);
        if (saved) {
          saved.textContent = 'Notes saved on this device';
          setTimeout(function () {
            saved.textContent = '';
          }, 2000);
        }
      }
      notes.addEventListener('input', function () {
        clearTimeout(notesTimer);
        notesTimer = setTimeout(saveNotes, 500);
      });
      notes.addEventListener('blur', saveNotes);
    }

    var filt = document.getElementById('admin-filter-status');
    var search = document.getElementById('admin-search');
    if (filt)
      filt.addEventListener('change', function () {
        renderOrdersTable(getFilteredOrders());
      });
    if (search)
      search.addEventListener('input', function () {
        renderOrdersTable(getFilteredOrders());
      });

    var exp = document.getElementById('admin-export-csv');
    if (exp) exp.addEventListener('click', exportCsv);
  }

  function loadOrders() {
    var syncEl = document.getElementById('admin-last-sync');
    if (syncEl) syncEl.textContent = 'Loading…';

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
          var root = document.getElementById('admin-orders-table-root');
          if (res.status === 401 || res.status === 403) {
            window.location.href = '/admin/login';
            return;
          }
          if (root)
            root.innerHTML =
              '<p class="alert alert-error">' +
              escapeHtml((res.body && res.body.error) || 'Could not load orders') +
              '</p>';
          if (syncEl) syncEl.textContent = '';
          return;
        }

        var data = res.body;
        lastOrders = data.orders || [];
        lastCloud = !!data.cloud;
        lastFetchAt = new Date();
        if (syncEl) syncEl.textContent = 'Updated ' + lastFetchAt.toLocaleTimeString();

        renderAllFromCache();
      })
      .catch(function () {
        var root = document.getElementById('admin-orders-table-root');
        if (root) root.innerHTML = '<p class="alert alert-error">Network error.</p>';
        if (syncEl) syncEl.textContent = '';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireShiftTools();
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
