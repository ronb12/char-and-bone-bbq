(function () {
  var STORAGE_KEY = 'cbbq_cart_v1';

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { lines: [] };
      var data = JSON.parse(raw);
      return data && Array.isArray(data.lines) ? data : { lines: [] };
    } catch (e) {
      return { lines: [] };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('cbbq-cart-updated'));
  }

  function findIndex(lines, id) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].id === id) return i;
    }
    return -1;
  }

  window.CBBQ_Cart = {
    getLines: function () {
      return load().lines.slice();
    },

    setQty: function (id, qty, menuItem) {
      var data = load();
      var q = parseInt(qty, 10);
      if (!id || !menuItem) return;
      var idx = findIndex(data.lines, id);
      if (q < 1) {
        if (idx >= 0) data.lines.splice(idx, 1);
      } else {
        q = Math.min(99, q);
        if (idx >= 0) data.lines[idx].qty = q;
        else data.lines.push({ id: id, qty: q });
      }
      save(data);
    },

    add: function (id, addQty, menuItem) {
      var data = load();
      var q = Math.min(99, Math.max(1, parseInt(addQty, 10) || 1));
      var idx = findIndex(data.lines, id);
      if (idx >= 0) data.lines[idx].qty = Math.min(99, data.lines[idx].qty + q);
      else data.lines.push({ id: id, qty: q });
      save(data);
    },

    remove: function (id) {
      var data = load();
      var idx = findIndex(data.lines, id);
      if (idx >= 0) {
        data.lines.splice(idx, 1);
        save(data);
      }
    },

    clear: function () {
      save({ lines: [] });
    },

    countItems: function () {
      return load().lines.reduce(function (s, l) {
        return s + l.qty;
      }, 0);
    },

    computeTotals: function (menuConfig) {
      var items = (menuConfig && menuConfig.items) || [];
      var byId = {};
      for (var i = 0; i < items.length; i++) byId[items[i].id] = items[i];
      var taxRate = menuConfig && typeof menuConfig.taxRate === 'number' ? menuConfig.taxRate : 0;
      var deliveryFeeCents =
        menuConfig && typeof menuConfig.deliveryFeeCents === 'number'
          ? menuConfig.deliveryFeeCents
          : 0;

      var lines = load().lines;
      var subtotal = 0;
      var detail = [];
      for (var j = 0; j < lines.length; j++) {
        var line = lines[j];
        var item = byId[line.id];
        if (!item) continue;
        var lt = item.priceCents * line.qty;
        subtotal += lt;
        detail.push({
          id: item.id,
          name: item.name,
          qty: line.qty,
          unitCents: item.priceCents,
          lineCents: lt,
        });
      }
      return {
        lines: detail,
        subtotalCents: subtotal,
        deliveryFeeCents: deliveryFeeCents,
        taxRate: taxRate,
      };
    },

    withFulfillment: function (menuConfig, fulfillment) {
      var base = this.computeTotals(menuConfig);
      var delivery =
        fulfillment === 'delivery' ? base.deliveryFeeCents : 0;
      var taxBase = base.subtotalCents + delivery;
      var taxCents = Math.round(taxBase * base.taxRate);
      var totalCents = base.subtotalCents + delivery + taxCents;
      return {
        lines: base.lines,
        subtotalCents: base.subtotalCents,
        deliveryFeeCents: delivery,
        taxCents: taxCents,
        totalCents: totalCents,
      };
    },
  };

  window.CBBQ_formatMoney = function (cents) {
    var n = (cents || 0) / 100;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };
})();
