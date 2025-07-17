/* global chrome */
(() => {
  const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

  /* 1. Inject stylesheet once */
  if (!document.getElementById('infopop-style')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'infopop-style';
    link.href = chrome.runtime.getURL('style.css');
    document.head.appendChild(link);
  }

  /* 2. Utility helpers */
  const kill = () => {
    const box = document.getElementById('infopop');
    if (box) {
      box.style.opacity = 0;
      // Use requestAnimationFrame for smoother removal after opacity transition
      box.addEventListener('transitionend', function handler() {
          box.removeEventListener('transitionend', handler);
          box.remove();
      }, { once: true });
    }
  };

  const showPopup = (sel) => {
    kill(); // remove any existing popup

    /* 4. Create popup */
    const popup = document.createElement('div');
    popup.id = 'infopop';
    popup.innerHTML = `
      <span class="close" title="Close (Esc)">&times;</span>
      <div class="word">${sel}</div>
      <div class="def">Looking up…</div>
    `;
    document.body.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('show'));

    /* 5. Fetch definition */
    fetch(API + encodeURIComponent(sel))
      .then(r => {
          if (!r.ok) {
              console.error('Fetch error:', r.status, r.statusText);
              return Promise.reject(new Error(`HTTP error! status: ${r.status}`));
          }
          return r.json();
      })
      .then(data => {
        console.log('API response data:', data);
        const def =
          data[0]?.meanings?.[0]?.definitions?.[0]?.definition ||
          'Definition unavailable.';
        popup.querySelector('.def').textContent = def;
      })
      .catch(error => {
        console.error('Error fetching definition:', error);
        popup.querySelector('.def').textContent = 'No info found.';
        popup.querySelector('.def').classList.add('error');
      });

    /* 6. Auto & manual dismiss */
    const timer = setTimeout(kill, 8000);
    popup.querySelector('.close').onclick = () => { clearTimeout(timer); kill(); };

    // Dismiss on click outside
    document.addEventListener('mousedown', e => { // Changed to mousedown for faster dismissal
      if (popup && !popup.contains(e.target)) { // Check if popup still exists
          clearTimeout(timer);
          kill();
      }
    }, { once: true, capture: true });

    // Dismiss on Escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            clearTimeout(timer);
            kill();
            document.removeEventListener('keydown', escHandler); // Remove self
        }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  };


  // --- New Logic for Triggering ---
  let currentSelection = ''; // To prevent showing popup for the same selection repeatedly

  document.addEventListener('selectionchange', () => {
    // Debounce to prevent multiple rapid firings during selection
    if (this._selectionTimer) clearTimeout(this._selectionTimer);
    this._selectionTimer = setTimeout(() => {
        const sel = window.getSelection().toString().trim();

        // Only show if a new valid selection is made
        if (sel.length >= 2 && !/\s/.test(sel) && sel !== currentSelection) {
            currentSelection = sel;
            showPopup(sel);
        } else if (sel.length === 0) { // If selection is cleared, remove popup
            currentSelection = '';
            kill();
        }
    }, 100); // Small delay to ensure selection is stable
  });

  // Keep existing mouseup for cases where selectionchange might not immediately trigger for some reason
  // Or, use it for dismissal instead of triggering
  document.addEventListener('mouseup', (e) => {
      const sel = window.getSelection().toString().trim();
      // If user clicks outside a previous popup, clear it
      const popup = document.getElementById('infopop');
      if (popup && !popup.contains(e.target) && sel.length === 0) {
          kill();
      }
      // Your original single-word alert logic, perhaps triggered on mouseup after an invalid selection
      if (sel.length < 2 || /\s/.test(sel)) {
        if (/\s/.test(sel)) {
            // alert('Please select a single word.'); // Still consider less intrusive UI here
            console.log('InfoPop: Please select a single word.');
        }
        kill();
      }
  });


})();