/* global chrome */
(() => {
  const statusEl = document.getElementById('status');
  const toggleEl = document.getElementById('toggleSwitch');

  function render(state) {
    const on = state.infopopEnabled !== false;
    if (statusEl) statusEl.textContent = on ? 'InfoPop is running ✅' : 'InfoPop is turned OFF 🔕';
    if (toggleEl) toggleEl.checked = on;
  }

  chrome.storage.sync.get(['infopopEnabled'], res => render(res));

  if (toggleEl) {
    toggleEl.addEventListener('change', e => {
      const value = e.target.checked;
      chrome.storage.sync.set({ infopopEnabled: value }, () => render({ infopopEnabled: value }));
    });
  }
})();