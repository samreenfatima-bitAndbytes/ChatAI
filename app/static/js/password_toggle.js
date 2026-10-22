(function () {
  const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  function bindToggle(wrap) {
    if (!wrap || wrap.dataset.toggleBound) return;
    const input = wrap.querySelector('input[type="password"], input[type="text"]');
    const btn = wrap.querySelector('.bnb-password__toggle');
    if (!input || !btn) return;
    wrap.dataset.toggleBound = '1';
    btn.innerHTML = EYE;
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      input.focus({ preventScroll: true });
    });
  }

  function wrapPasswordInput(input) {
    if (!input || input.closest('.bnb-password')) return input.closest('.bnb-password');
    const wrap = document.createElement('div');
    wrap.className = 'bnb-password';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bnb-password__toggle';
    wrap.appendChild(btn);
    bindToggle(wrap);
    return wrap;
  }

  function initPasswordToggles(root) {
    const scope = root || document;
    scope.querySelectorAll('.bnb-password').forEach(bindToggle);
    scope.querySelectorAll('input[type="password"]').forEach(function (input) {
      if (!input.closest('.bnb-password')) wrapPasswordInput(input);
    });
  }

  window.initPasswordToggles = initPasswordToggles;
  window.wrapPasswordInput = wrapPasswordInput;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initPasswordToggles(document);
    });
  } else {
    initPasswordToggles(document);
  }
})();
