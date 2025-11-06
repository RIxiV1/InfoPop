/* global chrome */
(() => {
  const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

  // Inject stylesheet once
  if (!document.getElementById('infoblend-style')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'infoblend-style';
    link.href = chrome.runtime.getURL('style.css');
    document.head.appendChild(link);
  }

  // Helpers
  const removePopup = () => {
    const box = document.getElementById('infoblend');
    if (!box) return;
    box.classList.remove('show');
    // Remove after transition completes or after 300ms fallback
    const removeNow = () => box.remove();
    const onTrans = () => { box.removeEventListener('transitionend', onTrans); removeNow(); };
    box.addEventListener('transitionend', onTrans);
    setTimeout(() => { if (document.body.contains(box)) removeNow(); }, 400);
  };

  const isEditable = (node) => {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const el = node instanceof Element ? node : null;
    if (!el) return false;
    return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest && el.closest('[contenteditable="true"]');
  };

  // Position popup near selection if possible
  const positionNearSelection = (popup) => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0).cloneRange();
      // Try to get bounding rect of the range
      let rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        // If invisible (e.g., collapsed), try to expand
        const span = document.createElement('span');
        span.textContent = '\u200b';
        range.insertNode(span);
        rect = span.getBoundingClientRect();
        span.remove();
      }
      // Place popup above the selection if there's space, otherwise below
      const margin = 8;
  const popupW = Math.min(window.innerWidth - 16, 360);
  const popupH = popup.offsetHeight || 60;
      popup.style.maxWidth = popupW + 'px';
      const top = rect.top - popup.offsetHeight - margin;
      const left = Math.min(Math.max(rect.left + rect.width / 2 - popupW / 2, 8), window.innerWidth - popupW - 8);
      // Use fixed positioning so popup is placed relative to the viewport (avoids scroll/jumping)
      const viewportTop = top > 8 ? top : (rect.bottom + margin);
      // Clamp to viewport
  const clampedTop = Math.min(Math.max(viewportTop, 8), window.innerHeight - 8 - popupH); // leave room
      const clampedLeft = Math.min(Math.max(left, 8), window.innerWidth - popupW - 8);
      popup.style.position = 'fixed';
      popup.style.top = clampedTop + 'px';
      popup.style.left = clampedLeft + 'px';
      popup.style.zIndex = 2147483647;
    } catch (e) {
      // ignore positioning errors
  console.debug('infoblend positioning error', e);
    }
  };

  // Main show
  const showPopup = (text) => {
    removePopup();

    const popup = document.createElement('div');
    popup.id = 'infoblend';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-live', 'polite');
    popup.innerHTML = `
      <button id="infoblend-close-btn" aria-label="Close">&times;</button>
      <div class="word"></div>
      <div class="def">Looking up…</div>
    `;
    document.body.appendChild(popup);
    // Fill text safely
    const wordEl = popup.querySelector('.word');
    const defEl = popup.querySelector('.def');
    wordEl.textContent = text;

    // Position after inserting to measure sizes
    // default initial off-screen to avoid jump
    popup.style.left = '-9999px';
    popup.style.top = '-9999px';
    requestAnimationFrame(() => {
      positionNearSelection(popup);
      requestAnimationFrame(() => popup.classList.add('show'));
    });

  // Auto-dismiss timer (will be paused while hovered)
  let timer = setTimeout(() => { removePopup(); timer = null; }, 10000);

  // Pause auto-dismiss while the user hovers the popup; resume on mouseleave
  const pauseTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const resumeTimer = (delay = 5000) => { if (!timer) timer = setTimeout(() => { removePopup(); timer = null; }, delay); };
  popup.addEventListener('mouseenter', pauseTimer);
  popup.addEventListener('mouseleave', () => resumeTimer(5000));

    // Close button wiring
    try {
  const closeBtn = popup.querySelector('#infoblend-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); if (timer) clearTimeout(timer); removePopup(); });
    } catch (e) { /* ignore */ }

    // Dismiss when clicking outside
    const outsideHandler = (e) => {
      if (!popup.contains(e.target)) { if (timer) clearTimeout(timer); removePopup(); document.removeEventListener('mousedown', outsideHandler, true); }
    };
    document.addEventListener('mousedown', outsideHandler, true);

    // Escape key
    const esc = (e) => { if (e.key === 'Escape') { if (timer) clearTimeout(timer); removePopup(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);

    // Lookup is handled by the background service worker; showPopup only creates the UI.
  };

  // --- Trigger logic ---
  let lastText = '';
  let enabled = true; // default
  let triggerMode = 'auto';
  let requiredModifier = 'Alt';
  const pressed = new Set();

  // Read setting
  try {
    chrome.storage && chrome.storage.local && chrome.storage.local.get(['InfoBlendEnabled'], (res) => {
      if (res && typeof res.InfoBlendEnabled !== 'undefined') enabled = !!res.InfoBlendEnabled;
    });
  } catch (e) {
    // ignore storage errors in older browsers
  }

  // Read trigger settings
  try {
    chrome.storage && chrome.storage.local && chrome.storage.local.get(['triggerMode','modifierKey'], (res) => {
      if (res && res.triggerMode) triggerMode = res.triggerMode;
      if (res && res.modifierKey) requiredModifier = res.modifierKey;
    });
  } catch (e) {}

  // Listen for storage changes so content script reacts in real-time
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.InfoBlendEnabled) enabled = !!changes.InfoBlendEnabled.newValue;
      if (changes.triggerMode) triggerMode = changes.triggerMode.newValue || 'auto';
      if (changes.modifierKey) requiredModifier = changes.modifierKey.newValue || 'Alt';
    });
  }

  // Track pressed modifier keys
  const keyMap = { 'Alt': 'Alt', 'Ctrl': 'Control', 'Shift': 'Shift', 'Meta': 'Meta' };
  window.addEventListener('keydown', (e) => { pressed.add(e.key); });
  window.addEventListener('keyup', (e) => { pressed.delete(e.key); });

  // --- Distraction Hider: apply rules and selection mode ---
  // Build a robust, specific selector for an element.
  // Priority:
  // 1) If element has an ID, use that.
  // 2) If nearest ancestor has an ID, build selector from that ancestor (#id > ... > target).
  // 3) Otherwise build a path from body using tag:nth-of-type(i) for each step.
  function buildRobustSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    try {
      if (el.id) {
        try { return '#' + (CSS && CSS.escape ? CSS.escape(el.id) : el.id); } catch (e) { return '#' + el.id; }
      }

      // find closest ancestor with id
      let anc = el.parentElement;
      while (anc && anc !== document.documentElement && !anc.id) anc = anc.parentElement;

      const buildPath = (fromNode, toNode, stopAtAncestorWithId) => {
        const parts = [];
        let node = toNode;
        while (node && node !== fromNode && node !== document.documentElement) {
          const tag = node.tagName.toLowerCase();
          // classes (only a few for readability)
          let cls = '';
          try {
            if (node.classList && node.classList.length) {
              const arr = Array.from(node.classList).slice(0,2).map(c => c.trim().replace(/\s+/g, '.')).filter(Boolean);
              if (arr.length) cls = '.' + arr.join('.');
            }
          } catch (e) { cls = ''; }
          // nth-of-type for uniqueness
          let ix = 1;
          try {
            let sib = node.previousElementSibling;
            while (sib) {
              if (sib.tagName && sib.tagName.toLowerCase() === tag) ix++;
              sib = sib.previousElementSibling;
            }
          } catch (e) { ix = 1; }
          const part = `${tag}${cls}:nth-of-type(${ix})`;
          parts.unshift(part);
          node = node.parentElement;
          if (stopAtAncestorWithId && node && node.id) break;
          if (parts.length > 10) break;
        }
        return parts.join(' > ');
      };

      if (anc && anc.id) {
        // build path from ancestor (use its id as root)
        const path = buildPath(anc, el, true);
        try { return `#${CSS && CSS.escape ? CSS.escape(anc.id) : anc.id} > ${path}`; } catch (e) { return `#${anc.id} > ${path}`; }
      }

      // no ancestor id: build from body
      const path = buildPath(document.body, el, false);
      return path ? `body > ${path}` : (el.tagName.toLowerCase());
    } catch (e) {
      // fallback to tag
      return el.tagName ? el.tagName.toLowerCase() : null;
    }
  }
  function applyDistractionHider() {
    try {
      chrome.storage.local.get(['distractionList'], (res) => {
        const all = res.distractionList || {};
        const host = window.location.hostname;
        const list = all[host] || [];
        list.forEach((sel) => {
          try {
            document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
          } catch (e) { /* ignore invalid selector */ }
        });
      });
    } catch (e) { /* ignore storage errors */ }
  }

  // Message listener for selection mode
  chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.action !== 'selectElementToHide') return;

    // Handlers need named refs to remove later
    const hoverHandler = (e) => {
      try {
        const t = e.target;
        if (!t) return;
        // store prev outline
  if (t.__infoblend_prev_outline === undefined) t.__infoblend_prev_outline = t.style.outline || '';
        t.style.outline = '2px solid red';
      } catch (err) {}
    };
    const mouseoutHandler = (e) => {
      try {
        const t = e.target;
        if (!t) return;
        if (t.__infoblend_prev_outline !== undefined) {
          t.style.outline = t.__infoblend_prev_outline || '';
          delete t.__infoblend_prev_outline;
        } else {
          t.style.outline = '';
        }
      } catch (err) {}
    };

    const clickHandler = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        const el = e.target;
        if (!el) return;
  // Build a robust selector for this exact element so we don't hide all similar elements
  let selector = buildRobustSelector(el) || (el.id ? ('#' + (CSS && CSS.escape ? CSS.escape(el.id) : el.id)) : el.tagName.toLowerCase());

        const host = window.location.hostname;
        chrome.storage.local.get(['distractionList'], (res) => {
          const all = res.distractionList || {};
          const arr = all[host] || [];
          if (!arr.includes(selector)) arr.push(selector);
          all[host] = arr;
          chrome.storage.local.set({ distractionList: all });
        });

        // Apply immediately
        try { el.style.display = 'none'; } catch (err) {}

        // Remove listeners to exit selection mode
        document.body.removeEventListener('mouseover', hoverHandler, true);
        document.body.removeEventListener('mouseout', mouseoutHandler, true);
        document.body.removeEventListener('click', clickHandler, true);

        sendResponse && sendResponse({ success: true, selector });
      } catch (err) {
        sendResponse && sendResponse({ success: false, error: String(err) });
      }
    };

    // Attach listeners in capture mode so we can intercept
    document.body.addEventListener('mouseover', hoverHandler, true);
    document.body.addEventListener('mouseout', mouseoutHandler, true);
    document.body.addEventListener('click', clickHandler, true);

    // indicate async response if needed
    return true;
  });

  // Additional message handlers: autofill and highlights
  chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    // Apply an autofill profile to the page
    if (msg.action === 'applyAutofill' && msg.profile) {
      try {
        const p = msg.profile || {};
        const trigger = (el) => {
          try {
            el.focus && el.focus();
            el.value = p.value || el.value;
            el.dispatchEvent && el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent && el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
        };

        // helpers to set value on element (input/textarea/contenteditable)
        const setElValue = (el, value) => {
          if (!el || typeof value === 'undefined' || value === null) return false;
          try {
            if (el.isContentEditable) {
              el.focus && el.focus();
              el.innerText = value;
              el.dispatchEvent && el.dispatchEvent(new Event('input', { bubbles: true }));
            } else if ('value' in el) {
              el.focus && el.focus();
              el.value = value;
              el.dispatchEvent && el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent && el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              return false;
            }
            return true;
          } catch (e) { return false; }
        };

        // Mapping rules for common field types
        const applyIfMatches = (value, tests) => {
          if (!value) return;
          // Try autocomplete attribute first
          try {
            tests.forEach((t) => {
              // autocomplete
              if (t.autocomplete) {
                document.querySelectorAll(`[autocomplete*="${t.autocomplete}"]`).forEach((el) => setElValue(el, value));
              }
              // type-specific selectors
              if (t.selector) {
                document.querySelectorAll(t.selector).forEach((el) => setElValue(el, value));
              }
              // placeholder/name/id contains
              if (t.contains) {
                const q = `input,textarea,select,div[contenteditable=true]`;
                document.querySelectorAll(q).forEach((el) => {
                  try {
                    const target = (el.getAttribute && (el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('placeholder') || el.getAttribute('aria-label')) || '') + '';
                    if (target.toLowerCase().includes(t.contains)) setElValue(el, value);
                  } catch (e) {}
                });
              }
            });
          } catch (e) {}
        };

        // fullname / name
        applyIfMatches(p.fullname || p.name, [
          { autocomplete: 'name' },
          { contains: 'fullname' },
          { contains: 'full name' },
          { contains: 'name' }
        ]);

        // email
        applyIfMatches(p.email, [
          { autocomplete: 'email' },
          { selector: 'input[type="email"]' },
          { contains: 'email' }
        ]);

        // phone
        applyIfMatches(p.phone, [
          { autocomplete: 'tel' },
          { selector: 'input[type="tel"]' },
          { contains: 'phone' },
          { contains: 'tel' },
        ]);

        // fallback: try to fill any visible text inputs if only a single obvious input exists
        try {
          const textInputs = Array.from(document.querySelectorAll('input[type=text], input:not([type]), textarea')).filter(el => el.offsetParent !== null && !el.disabled);
          if (textInputs.length === 1) {
            const el = textInputs[0];
            if (p.fullname) setElValue(el, p.fullname);
            else if (p.name) setElValue(el, p.name);
          }
        } catch (e) {}

        sendResponse && sendResponse({ success: true });
      } catch (err) {
        sendResponse && sendResponse({ success: false, error: String(err) });
      }
      return true; // async
    }

    // Apply highlight rules
    if (msg.action === 'applyHighlights' && Array.isArray(msg.highlights)) {
      try {
        msg.highlights.forEach((h) => {
          try {
            if (!h || !h.selector) return;
            const els = document.querySelectorAll(h.selector);
            els.forEach((el) => {
              try {
                // store previous style to allow future removal if desired
                if (el.__infoblend_prev_style === undefined) el.__infoblend_prev_style = el.getAttribute('style') || '';
                // apply visible highlight
                el.style.outline = `3px solid ${h.color || '#ffea00'}`;
                el.style.boxShadow = `0 0 8px ${h.color || '#ffea00'}`;
                el.style.transition = 'box-shadow 200ms ease, outline 200ms ease';
                el.setAttribute('data-infoblend-highlight', '1');
              } catch (e) {}
            });
          } catch (e) {}
        });
        sendResponse && sendResponse({ success: true });
      } catch (err) { sendResponse && sendResponse({ success: false, error: String(err) }); }
      return true;
    }
  });

  // Run initial apply
  try { applyDistractionHider(); } catch (e) {}

  // Quick Access Buttons injection
  function injectQuickButtons() {
    try {
      chrome.storage.local.get(['quickButtons'], (res) => {
        const all = res.quickButtons || {};
        const host = window.location.hostname;
        const rules = all[host] || [];
        if (!rules || rules.length === 0) return;

        // Remove existing bar if any
  const existing = document.getElementById('infoblend-quick-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'infoblend-quick-bar';
        rules.forEach((rule) => {
          try {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = rule.label || (rule.type === 'url' ? 'Open' : 'Click');
            btn.addEventListener('click', (e) => {
              try {
                if (rule.type === 'url') {
                  // Navigate to URL; allow relative URLs
                  const target = rule.target || '';
                  if (/^https?:\/\//i.test(target)) {
                    window.location.href = target;
                  } else {
                    // try as absolute relative to current origin
                    window.location.href = target;
                  }
                } else if (rule.type === 'click') {
                  const sel = rule.target || '';
                  try {
                    const el = document.querySelector(sel);
                    if (el && typeof el.click === 'function') el.click();
                  } catch (err) { console.debug('Quick button click error', err); }
                }
              } catch (err) { console.debug('Quick button handler error', err); }
            });
            bar.appendChild(btn);
          } catch (err) { /* ignore button build errors */ }
        });
        document.body.appendChild(bar);
      });
    } catch (e) { /* ignore storage errors */ }
  }

  try { injectQuickButtons(); } catch (e) {}

  // Debounced selection handling
  let selTimer = null;
  const handleSelection = () => {
    if (!enabled) return;
    const sel = window.getSelection();
    if (!sel) return;
    const text = sel.toString().trim();
    if (!text) {
      lastText = '';
      return;
    }
    // Ignore selections that are inside the popup or inside editable fields
    const anchorNode = sel.anchorNode;
    if (isEditable(anchorNode)) return;
    // Avoid repeating for same selection
    if (text === lastText) return;
    lastText = text;
    // Only handle selections of length >=2 to avoid accidental single letters
    if (text.length >= 2) {
      // If triggerMode requires modifier, check pressed set
      if (triggerMode === 'modifier') {
        const needed = keyMap[requiredModifier] || requiredModifier;
        if (!pressed.has(needed) && !pressed.has(requiredModifier)) return;
      }
      // Build phrase candidates by using the closest block-level parent of the selection
      const buildCandidates = () => {
        try {
          const r = sel.getRangeAt(0);
          const startNode = r.startContainer;
          const endNode = r.endContainer;

          const blockTags = new Set(['p','div','li','article','section','td','th','main','header','footer','aside','blockquote','body','ul','ol']);
          const closestBlock = (node) => {
            let n = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : node;
            while (n && n !== document.documentElement) {
              if (n.nodeType === 1 && blockTags.has(n.tagName.toLowerCase())) return n;
              n = n.parentElement;
            }
            return document.body;
          };

          const block = closestBlock(startNode || endNode);
          if (!block) return [];

          // Use Range to get text before and after within the block
          const beforeRange = document.createRange();
          beforeRange.setStart(block, 0);
          beforeRange.setEnd(r.startContainer, r.startOffset);
          const beforeText = beforeRange.toString() || '';

          const afterRange = document.createRange();
          try { afterRange.setStart(r.endContainer, r.endOffset); } catch (e) { afterRange.setStart(r.startContainer, r.endOffset); }
          afterRange.setEnd(block, block.childNodes.length);
          const afterText = afterRange.toString() || '';

          const candidates = [];
          if (!text.includes(' ')) {
            const prevMatch = beforeText.match(/([A-Za-z'-]{1,30})[^A-Za-z0-9]*$/);
            const nextMatch = afterText.match(/^[^A-Za-z0-9]*([A-Za-z'-]{1,30})/);
            const prevWord = prevMatch ? prevMatch[1] : '';
            const nextWord = nextMatch ? nextMatch[1] : '';
            if (nextWord) candidates.push((text + ' ' + nextWord).trim());
            if (prevWord) candidates.push((prevWord + ' ' + text).trim());
            if (prevWord && nextWord) candidates.push((prevWord + ' ' + text + ' ' + nextWord).trim());
          }
          return candidates.filter(Boolean).reduce((arr, c) => { if (!arr.includes(c)) arr.push(c); return arr; }, []);
        } catch (e) { return []; }
      };

      const candidates = buildCandidates();

      // Send request to background to perform lookup (handles CORS and API keys)
      try {
        const payload = { action: 'lookup', text };
        if (candidates && candidates.length) payload.candidates = candidates;
        chrome.runtime.sendMessage(payload, (resp) => {
          // If background returned data, show popup then update its def
          showPopup(text);
          // Wait a moment for popup to be created
            setTimeout(() => {
              const popup = document.getElementById('infoblend');
            if (!popup) return;
            const defEl = popup.querySelector('.def');
            const wordEl = popup.querySelector('.word');
            if (!resp) {
              defEl.textContent = 'No info found.';
              defEl.classList.add('error');
              return;
            }
            if (resp.success) {
              // If background returned which candidate matched, prefer showing that phrase
              // show the matched candidate phrase (if present) so users see context-aware matches
              if (resp.candidate && typeof resp.candidate === 'string' && resp.candidate.trim().length > 0) {
                try { wordEl.textContent = resp.candidate; } catch (e) { /* ignore */ }
              } else {
                try { wordEl.textContent = text; } catch (e) { /* ignore */ }
              }
              defEl.textContent = resp.def || 'No info found.';
              defEl.classList.remove('error');
            } else {
              defEl.textContent = 'No info found.';
              defEl.classList.add('error');
            }
          }, 60);
        });
      } catch (e) {
        // Fallback: local fetch if messaging fails
        showPopup(text);
      }
    }
  };

  document.addEventListener('selectionchange', () => {
    if (selTimer) clearTimeout(selTimer);
    selTimer = setTimeout(() => { handleSelection(); selTimer = null; }, 150);
  });

  // Also handle mouseup (some environments won't fire selectionchange reliably)
  document.addEventListener('mouseup', (e) => {
    // If clicking inside an editable area or on the popup, ignore
    if (isEditable(e.target) || (e.target && e.target.closest && e.target.closest('#infoblend'))) return;
    // Small delay to allow selection to be set
    setTimeout(handleSelection, 50);
  });

  // Keep popup removed when navigating away or on focus changes
  window.addEventListener('blur', () => removePopup());
  document.addEventListener('keyup', (e) => { if (e.key === 'Escape') removePopup(); });

})();