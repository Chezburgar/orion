/* ===== Terms of use =====
   Shown once, after a device is let in and before the desktop appears. The
   Continue button stays disabled until the box is ticked, so agreeing is a
   deliberate act rather than a click-through.

   TERMS_VERSION is what makes this re-showable: bump it when the wording
   changes and everyone is asked again, rather than silently holding people to
   terms they never saw.                                                     */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util;

  var TERMS_VERSION = 1;

  var POINTS = [
    'All games are not proxied or unblocked in any manner. They are simply embedded from ' +
    'other regularly accessible websites.',

    'Tools like Learn are powered by AI and are designed only for use abiding by your code ' +
    'of conduct. They have parameters set to ensure this, but any attempt at violation will ' +
    'result in permanent removal from Orion.',

    'Orion is a tool designed for the sheer purpose of convenience and is not intended for ' +
    'any other purpose.'
  ];

  function agreed() {
    return Emu.state.termsAccepted === TERMS_VERSION;
  }

  function show() {
    return new Promise(function (resolve) {
      var ov = U.el('<div class="tm-back"><div class="tm-card">' +
        '<img class="tm-logo" src="assets/orion.svg" width="52" height="52" alt="">' +
        '<h2>Welcome to Orion early access</h2>' +
        '<p class="tm-sub">To continue, please agree to our terms of use.</p>' +
        '<ul class="tm-list">' +
          POINTS.map(function (p) { return '<li>' + U.esc(p) + '</li>'; }).join('') +
        '</ul>' +
        '<label class="tm-agree"><input type="checkbox" data-agree>' +
          '<span>I agree to the terms of use</span></label>' +
        '<button class="btn primary tm-go" data-go disabled>Continue</button>' +
        '</div></div>');
      document.body.appendChild(ov);

      var box = ov.querySelector('[data-agree]');
      var go = ov.querySelector('[data-go]');

      box.addEventListener('change', function () { go.disabled = !box.checked; });

      go.addEventListener('click', function () {
        if (!box.checked) return;
        Emu.state.termsAccepted = TERMS_VERSION;
        Emu.state.termsAcceptedAt = Date.now();
        Emu.save();
        ov.classList.add('going');
        setTimeout(function () { ov.remove(); resolve(true); }, 260);
      });

      box.focus();
    });
  }

  global.Terms = {
    VERSION: TERMS_VERSION,
    agreed: agreed,
    /** Resolves once the terms have been accepted, now or previously. */
    require: function () { return agreed() ? Promise.resolve(false) : show(); },
    /** Read them again from Settings without having to re-accept. */
    review: show
  };
})(window);
