(function () {
  window.CBBQ_syncOrder = function (order) {
    return fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .catch(function () {
        return { ok: false };
      });
  };

  window.CBBQ_normPhone = function (p) {
    return String(p || '').replace(/\D/g, '');
  };
})();
