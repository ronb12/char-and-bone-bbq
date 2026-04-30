(function () {
  function refresh() {
    var n = window.CBBQ_Cart ? window.CBBQ_Cart.countItems() : 0;
    document.querySelectorAll('[data-cart-badge]').forEach(function (el) {
      el.textContent = String(n);
      el.style.display = n > 0 ? 'inline-flex' : 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', refresh);
  window.addEventListener('cbbq-cart-updated', refresh);
})();
