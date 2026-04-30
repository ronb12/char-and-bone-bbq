(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });

  var deferred = null;

  function isAdminPath() {
    return window.location.pathname.indexOf('/admin') === 0;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (isAdminPath()) return;

    var el = document.getElementById('cbbq-pwa-install');
    if (el) {
      el.hidden = false;
      return;
    }

    el = document.createElement('div');
    el.id = 'cbbq-pwa-install';
    el.className = 'cbbq-pwa-install-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Install app');
    el.innerHTML =
      '<div class="cbbq-pwa-install-bar__inner">' +
      '<p class="cbbq-pwa-install-bar__text">Install <strong>Char &amp; Bone</strong> for quick ordering from your home screen.</p>' +
      '<div class="cbbq-pwa-install-bar__actions">' +
      '<button type="button" class="btn btn-primary btn-sm" id="cbbq-pwa-install-btn">Install</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cbbq-pwa-install-dismiss" aria-label="Dismiss">Not now</button>' +
      '</div></div>';

    document.body.appendChild(el);

    document.getElementById('cbbq-pwa-install-dismiss').addEventListener('click', function () {
      el.remove();
      deferred = null;
    });

    document.getElementById('cbbq-pwa-install-btn').addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () {
        el.remove();
        deferred = null;
      });
    });
  });
})();
