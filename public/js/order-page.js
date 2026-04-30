(function () {
  var menuConfig = null;

  function getQtyInCart(id) {
    var lines = CBBQ_Cart.getLines();
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].id === id) return lines[i].qty;
    }
    return 0;
  }

  function renderMenu() {
    var root = document.getElementById('menu-root');
    var nav = document.getElementById('menu-nav');
    if (!root || !menuConfig) return;

    var byCat = {};
    for (var i = 0; i < menuConfig.items.length; i++) {
      var it = menuConfig.items[i];
      if (!byCat[it.category]) byCat[it.category] = [];
      byCat[it.category].push(it);
    }

    nav.innerHTML = '';
    root.innerHTML = '';

    var cats = Object.keys(byCat);
    for (var c = 0; c < cats.length; c++) {
      var cat = cats[c];
      var slug = cat.replace(/\s+/g, '-').toLowerCase();
      var a = document.createElement('a');
      a.href = '#' + slug;
      a.textContent = cat;
      nav.appendChild(a);

      var section = document.createElement('section');
      section.className = 'menu-category';
      section.id = slug;
      section.innerHTML = '<h2>' + escapeHtml(cat) + '</h2>';
      var list = byCat[cat];
      for (var j = 0; j < list.length; j++) {
        section.appendChild(cardEl(list[j]));
      }
      root.appendChild(section);
    }
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function cardEl(item) {
    var card = document.createElement('article');
    card.className = 'menu-card' + (item.image ? ' menu-card--with-image' : '');
    var qty = getQtyInCart(item.id);

    if (item.image) {
      var img = document.createElement('img');
      img.className = 'menu-card__media';
      img.src = item.image;
      img.alt = item.name || 'BBQ menu item';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 900;
      img.height = 563;
      card.appendChild(img);
    }

    var body = document.createElement('div');
    body.className = 'menu-card__body';

    var h3 = document.createElement('h3');
    h3.textContent = item.name;
    var desc = document.createElement('p');
    desc.textContent = item.description || '';
    var price = document.createElement('div');
    price.className = 'price';
    price.textContent = CBBQ_formatMoney(item.priceCents);

    var actions = document.createElement('div');
    actions.className = 'actions';

    if (qty < 1) {
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-primary btn-sm';
      add.textContent = 'Add to cart';
      add.dataset.id = item.id;
      add.addEventListener('click', function () {
        CBBQ_Cart.add(item.id, 1, item);
        renderMenu();
        renderCartPanel();
      });
      actions.appendChild(add);
    } else {
      var step = document.createElement('div');
      step.className = 'qty-stepper';
      step.innerHTML =
        '<button type="button" aria-label="Decrease" data-delta="-1">−</button>' +
        '<span>' +
        qty +
        '</span>' +
        '<button type="button" aria-label="Increase" data-delta="1">+</button>';
      step.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var d = parseInt(btn.getAttribute('data-delta'), 10);
          var current = getQtyInCart(item.id);
          CBBQ_Cart.setQty(item.id, current + d, item);
          renderMenu();
          renderCartPanel();
        });
      });
      actions.appendChild(step);
    }

    body.appendChild(h3);
    body.appendChild(price);
    body.appendChild(desc);
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderCartPanel() {
    var listEl = document.getElementById('cart-lines');
    var emptyEl = document.getElementById('cart-empty-msg');
    var totalsEl = document.getElementById('cart-totals');
    var checkoutBtn = document.getElementById('cart-checkout');
    if (!listEl || !menuConfig) return;

    var t = CBBQ_Cart.withFulfillment(menuConfig, 'pickup');
    listEl.innerHTML = '';

    if (!t.lines.length) {
      emptyEl.style.display = 'block';
      totalsEl.style.display = 'none';
      if (checkoutBtn) checkoutBtn.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      totalsEl.style.display = 'block';
      if (checkoutBtn) checkoutBtn.style.display = 'inline-flex';

      for (var i = 0; i < t.lines.length; i++) {
        var line = t.lines[i];
        var row = document.createElement('div');
        row.className = 'cart-line';
        row.innerHTML =
          '<div><strong>' +
          escapeHtml(line.name) +
          '</strong><div class="meta">' +
          line.qty +
          ' × ' +
          CBBQ_formatMoney(line.unitCents) +
          '</div></div><div class="line-total">' +
          CBBQ_formatMoney(line.lineCents) +
          '</div>';
        listEl.appendChild(row);
      }

      totalsEl.innerHTML =
        '<div><span>Subtotal</span><span>' +
        CBBQ_formatMoney(t.subtotalCents) +
        '</span></div>' +
        '<div class="muted" style="font-size:0.9rem">Tax & delivery calculated at checkout</div>' +
        '<div class="grand"><span>Due now</span><span>' +
        CBBQ_formatMoney(t.subtotalCents) +
        '</span></div>';
    }

    var mobileSum = document.getElementById('cart-mobile-sum');
    if (mobileSum) {
      mobileSum.textContent =
        t.lines.length > 0 ? CBBQ_formatMoney(t.subtotalCents) + ' + tax' : 'Cart empty';
    }
  }

  function setupMobileCart() {
    var panel = document.getElementById('cart-panel');
    var openBtn = document.getElementById('cart-open-mobile');
    var backdrop = document.getElementById('cart-backdrop');
    function close() {
      panel.classList.remove('is-open');
      backdrop.classList.remove('is-open');
    }
    function open() {
      panel.classList.add('is-open');
      backdrop.classList.add('is-open');
    }
    if (openBtn) openBtn.addEventListener('click', open);
    if (backdrop) backdrop.addEventListener('click', close);
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/menu.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        menuConfig = data;
        renderMenu();
        renderCartPanel();
        setupMobileCart();
      })
      .catch(function () {
        document.getElementById('menu-root').innerHTML =
          '<p class="alert alert-error">Could not load menu. Refresh and try again.</p>';
      });

    window.addEventListener('cbbq-cart-updated', function () {
      if (menuConfig) {
        renderMenu();
        renderCartPanel();
      }
    });
  });
})();
