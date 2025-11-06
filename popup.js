/* global chrome */
(() => {
  const statusEl = document.getElementById('status');
  const toggleEl = document.getElementById('toggleSwitch');
  const providerEl = document.getElementById('apiProvider');
  const templateEl = document.getElementById('apiTemplate');
  const apiKeyEl = document.getElementById('apiKey');
  const apiKeyHeaderEl = document.getElementById('apiKeyHeader');
  const testAiBtn = document.getElementById('test-ai-endpoint');
  const triggerModeEl = document.getElementById('triggerMode');
  const modifierKeyEl = document.getElementById('modifierKey');
  const selectToHideBtn = document.getElementById('select-to-hide');
  const hiddenListContainer = document.getElementById('hidden-elements-list-container');
  // Quick buttons elements
  const addButton = document.getElementById('add-quick-button');
  const buttonListContainer = document.getElementById('quick-buttons-list-container');
  const btnLabel = document.getElementById('btn-label');
  const btnActionType = document.getElementById('btn-action-type');
  const btnActionTarget = document.getElementById('btn-action-target');
  // Autofill elements
  const profileNameEl = document.getElementById('profile-name');
  const profileFullnameEl = document.getElementById('profile-fullname');
  const profileEmailEl = document.getElementById('profile-email');
  const profilePhoneEl = document.getElementById('profile-phone');
  const saveProfileBtn = document.getElementById('save-profile');
  const applyProfileCurrentBtn = document.getElementById('apply-profile-current');
  const profilesListEl = document.getElementById('profiles-list');
  // Highlights elements
  const highlightSelectorEl = document.getElementById('highlight-selector');
  const highlightColorEl = document.getElementById('highlight-color');
  const addHighlightBtn = document.getElementById('add-highlight');
  const applyHighlightsBtn = document.getElementById('apply-highlights');
  const highlightsListEl = document.getElementById('highlights');

  function render(state) {
    const on = state.InfoBlendEnabled !== false;
    if (statusEl) statusEl.textContent = on ? 'InfoBlend is running ✅' : 'InfoBlend is turned OFF 🔕';
    if (toggleEl) toggleEl.checked = on;
  }

  chrome.storage.local.get(['InfoBlendEnabled'], res => render(res));

  // Load api settings from local storage only
  chrome.storage.local.get(['apiProvider','apiTemplate','apiKey','apiKeyHeader','triggerMode','modifierKey'], (res) => {
    if (providerEl) providerEl.value = res.apiProvider || 'dictionaryapi';
    if (templateEl) templateEl.value = res.apiTemplate || '';
    if (apiKeyEl) apiKeyEl.value = res.apiKey || '';
    if (apiKeyHeaderEl) apiKeyHeaderEl.value = res.apiKeyHeader || '';
    if (triggerModeEl) triggerModeEl.value = res.triggerMode || 'auto';
    if (modifierKeyEl) modifierKeyEl.value = res.modifierKey || 'Alt';
  });

  // Populate hidden elements list once popup opens
  loadHiddenElementsList();
  // Populate quick buttons list
  loadQuickButtonsList();
  // Load autofill profiles and highlights
  loadProfilesList();
  loadHighlightsList();

  // Load and render hidden elements list for current site
  function loadHiddenElementsList() {
    if (!hiddenListContainer) return;
    hiddenListContainer.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">Hidden Elements on this Site:</div>';
    // Query active tab to find hostname
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        hiddenListContainer.innerHTML += '<div style="color:var(--muted);">No active tab</div>';
        return;
      }
      let hostname = '';
      try { hostname = new URL(tab.url).hostname; } catch (e) { hostname = tab.url; }
      chrome.storage.local.get(['distractionList'], (res) => {
        const all = res.distractionList || {};
        const list = all[hostname] || [];
        if (!list || list.length === 0) {
          hiddenListContainer.innerHTML += '<div style="color:var(--muted); margin-top:6px;">No hidden elements.</div>';
          return;
        }
        const ul = document.createElement('div');
        ul.style.marginTop = '6px';
        list.forEach((sel, i) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.alignItems = 'center';
          row.style.marginBottom = '6px';
          const span = document.createElement('span');
          span.textContent = sel;
          span.style.wordBreak = 'break-all';
          const btn = document.createElement('button');
          btn.textContent = 'Remove';
          btn.style.marginLeft = '8px';
          btn.style.background = '#fee2e2';
          btn.style.border = '1px solid #fca5a5';
          btn.style.borderRadius = '6px';
          btn.style.padding = '4px 8px';
          btn.addEventListener('click', () => {
            // remove selector from storage
            chrome.storage.local.get(['distractionList'], (r2) => {
              const all2 = r2.distractionList || {};
              const arr = all2[hostname] || [];
              const idx = arr.indexOf(sel);
              if (idx > -1) arr.splice(idx, 1);
              all2[hostname] = arr;
              chrome.storage.local.set({ distractionList: all2 }, () => {
                loadHiddenElementsList();
              });
            });
          });
          row.appendChild(span);
          row.appendChild(btn);
          ul.appendChild(row);
        });
        hiddenListContainer.appendChild(ul);
      });
    });
  }

  // Autofill: per-site profiles
  function loadProfilesList() {
    if (!profilesListEl) return;
    profilesListEl.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">Saved Profiles:</div>';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        profilesListEl.innerHTML += '<div style="color:var(--muted);">No active tab</div>';
        return;
      }
      let hostname = '';
      try { hostname = new URL(tab.url).hostname; } catch (e) { hostname = tab.url; }
      chrome.storage.local.get(['autofillProfiles'], (res) => {
        const all = res.autofillProfiles || {};
        const list = all[hostname] || [];
        if (!list || list.length === 0) {
          profilesListEl.innerHTML += '<div style="color:var(--muted); margin-top:6px;">No profiles.</div>';
          return;
        }
        const wrap = document.createElement('div');
        wrap.style.marginTop = '6px';
        list.forEach((p, i) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.alignItems = 'center';
          row.style.marginBottom = '6px';
          const span = document.createElement('span');
          span.textContent = `${p.name} — ${p.email || ''}`;
          span.style.wordBreak = 'break-all';
          const applyBtn = document.createElement('button');
          applyBtn.textContent = 'Apply';
          applyBtn.style.marginLeft = '8px';
          applyBtn.style.background = '#eef2ff';
          applyBtn.style.border = '1px solid #c7d2fe';
          applyBtn.style.borderRadius = '6px';
          applyBtn.style.padding = '4px 8px';
          applyBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs2) => {
              const t = tabs2 && tabs2[0];
              if (!t || !t.id) return;
              chrome.tabs.sendMessage(t.id, { action: 'applyAutofill', profile: p });
            });
          });
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Remove';
          delBtn.style.marginLeft = '8px';
          delBtn.style.background = '#fee2e2';
          delBtn.style.border = '1px solid #fca5a5';
          delBtn.style.borderRadius = '6px';
          delBtn.style.padding = '4px 8px';
          delBtn.addEventListener('click', () => {
            chrome.storage.local.get(['autofillProfiles'], (r2) => {
              const all2 = r2.autofillProfiles || {};
              const arr = all2[hostname] || [];
              if (i > -1 && i < arr.length) arr.splice(i, 1);
              all2[hostname] = arr;
              chrome.storage.local.set({ autofillProfiles: all2 }, () => loadProfilesList());
            });
          });
          row.appendChild(span);
          const btnWrap = document.createElement('div'); btnWrap.appendChild(applyBtn); btnWrap.appendChild(delBtn);
          row.appendChild(btnWrap);
          wrap.appendChild(row);
        });
        profilesListEl.appendChild(wrap);
      });
    });
  }

  // Save profile for current host
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', () => {
    const name = profileNameEl ? profileNameEl.value.trim() : '';
    const full = profileFullnameEl ? profileFullnameEl.value.trim() : '';
    const email = profileEmailEl ? profileEmailEl.value.trim() : '';
    const phone = profilePhoneEl ? profilePhoneEl.value.trim() : '';
    if (!name) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) return;
      let hostname = '';
      try { hostname = new URL(tab.url).hostname; } catch (e) { hostname = tab.url; }
      chrome.storage.local.get(['autofillProfiles'], (res) => {
        const all = res.autofillProfiles || {};
        const arr = all[hostname] || [];
        arr.push({ name, fullname: full, email, phone });
        all[hostname] = arr;
        chrome.storage.local.set({ autofillProfiles: all }, () => {
          if (profileNameEl) profileNameEl.value = '';
          if (profileFullnameEl) profileFullnameEl.value = '';
          if (profileEmailEl) profileEmailEl.value = '';
          if (profilePhoneEl) profilePhoneEl.value = '';
          loadProfilesList();
        });
      });
    });
  });

  // Apply currently filled inputs as profile to page (quick apply without saving)
  if (applyProfileCurrentBtn) applyProfileCurrentBtn.addEventListener('click', () => {
    const profile = { name: (profileNameEl && profileNameEl.value.trim()) || 'Quick', fullname: profileFullnameEl ? profileFullnameEl.value.trim() : '', email: profileEmailEl ? profileEmailEl.value.trim() : '', phone: profilePhoneEl ? profilePhoneEl.value.trim() : '' };
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { action: 'applyAutofill', profile });
    });
  });

  // Highlights
  function loadHighlightsList() {
    if (!highlightsListEl) return;
    highlightsListEl.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">Highlights on this Site:</div>';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) { highlightsListEl.innerHTML += '<div style="color:var(--muted);">No active tab</div>'; return; }
      let hostname = '';
      try { hostname = new URL(tab.url).hostname; } catch (e) { hostname = tab.url; }
      chrome.storage.local.get(['highlights'], (res) => {
        const all = res.highlights || {};
        const list = all[hostname] || [];
        if (!list || list.length === 0) { highlightsListEl.innerHTML += '<div style="color:var(--muted); margin-top:6px;">No highlights.</div>'; return; }
        const wrap = document.createElement('div'); wrap.style.marginTop = '6px';
        list.forEach((h, i) => {
          const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.marginBottom = '6px';
          const span = document.createElement('span'); span.textContent = `${h.selector} — ${h.color}`; span.style.wordBreak = 'break-all';
          const applyBtn = document.createElement('button'); applyBtn.textContent = 'Apply'; applyBtn.style.marginLeft='8px'; applyBtn.style.background='#eef2ff'; applyBtn.style.border='1px solid #c7d2fe'; applyBtn.style.borderRadius='6px'; applyBtn.style.padding='4px 8px';
          applyBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs2) => { const t = tabs2 && tabs2[0]; if (!t || !t.id) return; chrome.tabs.sendMessage(t.id, { action: 'applyHighlights', highlights: [h] }); });
          });
          const delBtn = document.createElement('button'); delBtn.textContent = 'Remove'; delBtn.style.marginLeft='8px'; delBtn.style.background='#fee2e2'; delBtn.style.border='1px solid #fca5a5'; delBtn.style.borderRadius='6px'; delBtn.style.padding='4px 8px';
          delBtn.addEventListener('click', () => { chrome.storage.local.get(['highlights'], (r2) => { const all2 = r2.highlights || {}; const arr = all2[hostname] || []; if (i>-1 && i<arr.length) arr.splice(i,1); all2[hostname]=arr; chrome.storage.local.set({ highlights: all2 }, () => loadHighlightsList()); }); });
          row.appendChild(span); const btnWrap=document.createElement('div'); btnWrap.appendChild(applyBtn); btnWrap.appendChild(delBtn); row.appendChild(btnWrap); wrap.appendChild(row);
        }); highlightsListEl.appendChild(wrap);
      });
    });
  }

  if (addHighlightBtn) addHighlightBtn.addEventListener('click', () => {
    const sel = highlightSelectorEl ? highlightSelectorEl.value.trim() : '';
    const color = highlightColorEl ? highlightColorEl.value : '#ffea00';
    if (!sel) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]; if (!tab || !tab.url) return; let hostname=''; try{ hostname = new URL(tab.url).hostname; }catch(e){ hostname = tab.url; }
      chrome.storage.local.get(['highlights'], (res) => {
        const all = res.highlights || {};
        const arr = all[hostname] || [];
        arr.push({ selector: sel, color }); all[hostname]=arr; chrome.storage.local.set({ highlights: all }, () => { if (highlightSelectorEl) highlightSelectorEl.value=''; loadHighlightsList(); });
      });
    });
  });

  if (applyHighlightsBtn) applyHighlightsBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]; if (!tab || !tab.id) return; chrome.storage.local.get(['highlights'], (res) => { const all = res.highlights || {}; let hostname=''; try{ hostname=new URL(tab.url).hostname; }catch(e){ hostname=tab.url;} const list = all[hostname]||[]; if (list.length) chrome.tabs.sendMessage(tab.id, { action: 'applyHighlights', highlights: list }); });
    });
  });

  // Load and render quick access buttons for current site
  function loadQuickButtonsList() {
    if (!buttonListContainer) return;
    buttonListContainer.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">Quick Buttons on this Site:</div>';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        buttonListContainer.innerHTML += '<div style="color:var(--muted);">No active tab</div>';
        return;
      }
      let hostname = '';
      try { hostname = new URL(tab.url).hostname; } catch (e) { hostname = tab.url; }
      chrome.storage.local.get(['quickButtons'], (res) => {
        const all = res.quickButtons || {};
        const list = all[hostname] || [];
        if (!list || list.length === 0) {
          buttonListContainer.innerHTML += '<div style="color:var(--muted); margin-top:6px;">No quick buttons.</div>';
          return;
        }
        const wrap = document.createElement('div');
        wrap.style.marginTop = '6px';
        list.forEach((rule, i) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.alignItems = 'center';
          row.style.marginBottom = '6px';
          const span = document.createElement('span');
          span.textContent = `${rule.label} → ${rule.type === 'url' ? rule.target : rule.target}`;
          span.style.wordBreak = 'break-all';
          const btn = document.createElement('button');
          btn.textContent = 'Remove';
          btn.style.marginLeft = '8px';
          btn.style.background = '#fee2e2';
          btn.style.border = '1px solid #fca5a5';
          btn.style.borderRadius = '6px';
          btn.style.padding = '4px 8px';
          btn.addEventListener('click', () => {
            chrome.storage.local.get(['quickButtons'], (r2) => {
              const all2 = r2.quickButtons || {};
              const arr = all2[hostname] || [];
              // Remove by index to allow duplicate labels
              if (i > -1 && i < arr.length) arr.splice(i, 1);
              all2[hostname] = arr;
              chrome.storage.local.set({ quickButtons: all2 }, () => {
                loadQuickButtonsList();
              });
            });
          });
          row.appendChild(span);
          row.appendChild(btn);
          wrap.appendChild(row);
        });
        buttonListContainer.appendChild(wrap);
      });
    });
  }

  // Wire select-to-hide button
  if (selectToHideBtn) {
    selectToHideBtn.addEventListener('click', () => {
      // Send message to active tab to start selection mode
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, { action: 'selectElementToHide' });
      });
    });
  }

  // Wire add quick button
  if (addButton) {
    addButton.addEventListener('click', () => {
      const label = (btnLabel && btnLabel.value) ? btnLabel.value.trim() : '';
      const type = (btnActionType && btnActionType.value) ? btnActionType.value : 'url';
      const target = (btnActionTarget && btnActionTarget.value) ? btnActionTarget.value.trim() : '';
      if (!label || !target) return;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.url) return;
        let hostname = '';
        try { hostname = new URL(tab.url).hostname; } catch (e) { hostname = tab.url; }
        chrome.storage.local.get(['quickButtons'], (res) => {
          const all = res.quickButtons || {};
          const arr = all[hostname] || [];
          arr.push({ label, type, target });
          all[hostname] = arr;
          chrome.storage.local.set({ quickButtons: all }, () => {
            // reload list and clear inputs
            loadQuickButtonsList();
            if (btnLabel) btnLabel.value = '';
            if (btnActionTarget) btnActionTarget.value = '';
          });
        });
      });
    });
  }

  if (toggleEl) {
    toggleEl.addEventListener('change', e => {
      const value = e.target.checked;
      chrome.storage.local.set({ InfoBlendEnabled: value }, () => render({ InfoBlendEnabled: value }));
    });
  }

  // Save API settings: everything stored in local only
  const saveApiSettings = (cb) => {
    const obj = {
      apiProvider: providerEl ? providerEl.value : 'dictionaryapi',
      apiTemplate: templateEl ? templateEl.value.trim() : '',
      apiKey: apiKeyEl ? apiKeyEl.value.trim() : '',
      apiKeyHeader: apiKeyHeaderEl ? apiKeyHeaderEl.value.trim() : '',
      triggerMode: triggerModeEl ? triggerModeEl.value : 'auto',
      modifierKey: modifierKeyEl ? modifierKeyEl.value : 'Alt',
      InfoBlendEnabled: (toggleEl && toggleEl.checked) || true
    };
    chrome.storage.local.set(obj, () => {
      if (statusEl) {
        statusEl.textContent = 'Saved.';
        setTimeout(() => { statusEl.textContent = ''; }, 1400);
      }
      if (typeof cb === 'function') cb();
    });
  };

  if (providerEl) providerEl.addEventListener('change', () => saveApiSettings());
  if (templateEl) templateEl.addEventListener('blur', () => saveApiSettings());
  if (apiKeyEl) apiKeyEl.addEventListener('blur', () => saveApiSettings());
  if (apiKeyHeaderEl) apiKeyHeaderEl.addEventListener('blur', () => saveApiSettings());

  // Test Endpoint button: read current template/key and send a 'test' message to background
  if (testAiBtn) {
    testAiBtn.addEventListener('click', () => {
      testAiBtn.disabled = true;
      const originalText = testAiBtn.textContent;
      testAiBtn.textContent = 'Testing…';
      // Save current settings to local then send test message
      saveApiSettings(() => {
        const payload = {
          action: 'test',
          template: templateEl ? templateEl.value.trim() : '',
          apiKey: apiKeyEl ? apiKeyEl.value.trim() : '',
          apiKeyHeader: apiKeyHeaderEl ? apiKeyHeaderEl.value.trim() : '',
          provider: providerEl ? providerEl.value : 'dictionaryapi'
        };
        chrome.runtime.sendMessage(payload, (resp) => {
          if (!resp) {
            if (statusEl) statusEl.textContent = 'No response from background.';
          } else if (resp.error) {
            if (statusEl) statusEl.textContent = 'Error: ' + resp.error;
          } else if (resp.result) {
            if (statusEl) statusEl.textContent = 'Success! — ' + (resp.result || JSON.stringify(resp));
          } else {
            if (statusEl) statusEl.textContent = 'Unexpected response: ' + JSON.stringify(resp);
          }
          setTimeout(() => {
            testAiBtn.disabled = false;
            testAiBtn.textContent = originalText;
            if (statusEl) setTimeout(() => statusEl.textContent = '', 3000);
          }, 1400);
        });
      });
    });
  }

  // Trigger settings
  const saveTriggerSettings = () => {
    const obj = {
      triggerMode: triggerModeEl ? triggerModeEl.value : 'auto',
      modifierKey: modifierKeyEl ? modifierKeyEl.value : 'Alt'
    };
    chrome.storage.local.set(obj);
  };
  if (triggerModeEl) triggerModeEl.addEventListener('change', saveTriggerSettings);
  if (modifierKeyEl) modifierKeyEl.addEventListener('change', saveTriggerSettings);
})();