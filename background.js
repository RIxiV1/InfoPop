/* Background service worker for InfoBlend
  - Listens for lookup requests from content scripts
  - Reads stored API settings (template, key, header)
  - Performs fetch and returns a compact result
*/

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || (message.action !== 'lookup' && message.action !== 'test')) return;
  const isTest = message.action === 'test';
  const text = isTest ? 'test' : (message.text || '').trim();
  if (!text) return sendResponse({ success: false, error: 'empty' });

  // Async handler
  (async () => {
    try {
  // Load config from local storage only (privacy: keys/settings stay local)
  const cfg = await new Promise(res => chrome.storage.local.get(['apiProvider','apiTemplate','apiKey','apiKeyHeader'], res));
  let provider = cfg.apiProvider || 'dictionaryapi';
  let template = cfg.apiTemplate || '';
  let key = cfg.apiKey || '';
  let keyHeader = cfg.apiKeyHeader || '';

  // Allow overrides supplied by the popup's test message
  if (message.template) template = message.template;
  if (message.apiKey) key = message.apiKey;
  if (message.apiKeyHeader) keyHeader = message.apiKeyHeader;
  if (message.provider) provider = message.provider;

      const defaultAPI = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

      const buildUrl = (query) => {
        if (provider === 'custom' && template) {
          if (template.indexOf('{query}') === -1) return template + encodeURIComponent(query);
          return template.replace(/\{query\}/g, encodeURIComponent(query));
        }
        return defaultAPI + encodeURIComponent(query);
      };

      const buildHeaders = () => {
        const headers = {};
        if (provider === 'custom' && key) {
          if (keyHeader) headers[keyHeader] = key;
          else { headers['x-api-key'] = key; headers['Authorization'] = 'Bearer ' + key; }
        }
        return headers;
      };

      const headers = buildHeaders();

      const fetchText = async (url) => {
        const r = await fetch(url, { method: 'GET', headers });
        const t = await r.text();
        return { ok: r.ok, status: r.status, text: t };
      };

      // POST-based AI fetch for 'custom' provider (e.g., Google's Gemini or other LLM endpoints)
      const fetchAIResponse = async (text) => {
        if (!template) throw new Error('No template URL configured for custom provider');
        // Build headers (copy) and ensure JSON content type
        const hdrs = Object.assign({}, headers || {});
        hdrs['Content-Type'] = 'application/json';

        // Smart prompt: single word vs phrase
        let promptText = '';
        if (String(text).includes(' ')) {
          promptText = `Explain this in one short, simple line: '${text}'`;
        } else {
          promptText = `What is "${text}"? Give a very short, simple definition.`;
        }

        // Construct a simple Gemini-style prompt body. Consumers can change template to point at any compatible endpoint.
        const body = {
          contents: [{ parts: [{ text: promptText }] }]
        };

        const resp = await fetch(template, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
        const json = await resp.json().catch(() => null);

        // Try common response shapes to extract the LLM answer.
        // 1) Gemini-like: { candidates: [ { content: { parts: [ { text } ] } } ] }
        try {
          if (json && Array.isArray(json.candidates) && json.candidates.length) {
            const c = json.candidates[0];
            if (c && c.content && Array.isArray(c.content.parts) && c.content.parts.length) return String(c.content.parts[0].text || '').trim();
            if (c && c.content && c.content.parts && c.content.parts[0] && c.content.parts[0].text) return String(c.content.parts[0].text).trim();
          }
        } catch (e) {}

        // 2) Another Gemini variant: { output: [ { content: [ { text } ] } ] }
        try {
          if (json && Array.isArray(json.output) && json.output.length) {
            const o = json.output[0];
            if (o && Array.isArray(o.content) && o.content.length && o.content[0].text) return String(o.content[0].text).trim();
          }
        } catch (e) {}

        // 3) OpenAI-like: { choices: [ { message: { content: '...' } } ] } or { choices: [ { text: '...' } ] }
        try {
          if (json && Array.isArray(json.choices) && json.choices.length) {
            const ch = json.choices[0];
            if (ch.message && ch.message.content) return String(ch.message.content).trim();
            if (ch.text) return String(ch.text).trim();
          }
        } catch (e) {}

        // 4) fallback: if body contains simple text field
        if (json && typeof json === 'object') {
          // try to find first string value
          for (const k of Object.keys(json)) {
            const v = json[k];
            if (typeof v === 'string' && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
          }
        }

        return null;
      };

      // Extract a short single definition: find first POS entry and first definition, then truncate at first semicolon
      const extractDef = (obj) => {
        if (!obj) return null;
        try {
          const pickFirstDef = (pos, raw) => {
            if (!raw) return null;
            let text = '';
            if (typeof raw === 'string') text = raw;
            else if (raw.definition) text = raw.definition;
            else text = String(raw);
            // Split by semicolon and keep only the first clause
            const firstPart = text.split(';')[0].trim();
            return `(${pos || 'def'}): ${firstPart}`;
          };

          const tryFromMeanings = (meanings) => {
            if (!meanings || !Array.isArray(meanings)) return null;
            for (const m of meanings) {
              if (!m) continue;
              const defs = m.definitions || m.definition || m.defs || null;
              let candidate = null;
              if (Array.isArray(defs) && defs.length) candidate = defs[0];
              else if (typeof defs === 'string') candidate = defs;
              else if (m.definitions && Array.isArray(m.definitions) && m.definitions.length) candidate = m.definitions[0];
              if (candidate) return pickFirstDef(m.partOfSpeech || m.type || '', candidate);
            }
            return null;
          };

          // If top-level is an array (dictionaryapi.dev style), iterate entries
          if (Array.isArray(obj)) {
            for (const entry of obj) {
              if (!entry) continue;
              const fromMeanings = tryFromMeanings(entry.meanings || entry.meaning || entry.senses || null);
              if (fromMeanings) return fromMeanings;
              // fallback to shortdef / definition
              if (entry.shortdef && Array.isArray(entry.shortdef) && entry.shortdef.length) return pickFirstDef('', entry.shortdef[0]);
              if (entry.definition && typeof entry.definition === 'string') return pickFirstDef('', entry.definition);
            }
          }

          // If object with nested results/entries
          const collectCandidates = (o) => {
            if (!o || typeof o !== 'object') return null;
            // common shapes
            if (o.meanings) {
              const r = tryFromMeanings(o.meanings);
              if (r) return r;
            }
            if (o.results && Array.isArray(o.results)) {
              for (const r of o.results) {
                const rr = collectCandidates(r);
                if (rr) return rr;
              }
            }
            if (o.entries && Array.isArray(o.entries)) {
              for (const r of o.entries) {
                const rr = collectCandidates(r);
                if (rr) return rr;
              }
            }
            if (o.senses && Array.isArray(o.senses)) {
              // some dicts nest senses
              for (const s of o.senses) {
                if (s.definition) return pickFirstDef(o.partOfSpeech || '', s.definition);
                if (s.definitions && s.definitions.length) return pickFirstDef(o.partOfSpeech || '', s.definitions[0]);
              }
            }
            if (o.shortdef && Array.isArray(o.shortdef) && o.shortdef.length) return pickFirstDef(o.partOfSpeech || '', o.shortdef[0]);
            if (o.definition && typeof o.definition === 'string') return pickFirstDef(o.partOfSpeech || '', o.definition);
            return null;
          };

          const res = collectCandidates(obj);
          if (res) return res;
        } catch (e) {
          // ignore
        }
        return null;
      };

  // If content script provided phrase candidates (e.g., "blow up"), try those first
      // If provider is custom (AI), use POST flow and return AI answer immediately
      if (provider === 'custom') {
        try {
          const aiAnswer = await fetchAIResponse(text);
          if (aiAnswer) return sendResponse({ success: true, def: aiAnswer, result: aiAnswer, raw: null });
          return sendResponse({ success: true, def: '(no answer)', result: '(no answer)', raw: null });
        } catch (e) {
          return sendResponse({ success: false, error: String(e) });
        }
      }

      if (message.candidates && Array.isArray(message.candidates) && message.candidates.length > 0) {
        for (const cand of message.candidates) {
          try {
            const url = buildUrl(cand);
            const res = await fetchText(url);
            if (!res.ok) continue;
            let p = null;
            try { p = JSON.parse(res.text); } catch (e) { p = null; }
            const d = extractDef(p);
            if (d) return sendResponse({ success: true, def: d, result: d, raw: p || res.text, candidate: cand });
          } catch (e) { /* ignore per-candidate errors */ }
        }
      }

      // primary lookup (original selection)
      const primaryUrl = buildUrl(text);
      const primary = await fetchText(primaryUrl);
      if (!primary.ok) {
        // If primary fails (e.g., 404), continue to fallback rather than erroring out
        // but record status
      }

      let parsed = null;
      try { parsed = JSON.parse(primary.text); } catch (e) { parsed = null; }

      let def = extractDef(parsed);
  if (def) return sendResponse({ success: true, def, result: def, raw: parsed || primary.text });

      // If no definition and selection looks like a phrase, try keyword fallback
      if (text.includes(' ')) {
        // extract candidate words: remove punctuation, split, filter stopwords and short words
        const stop = new Set(['the','a','an','of','in','on','and','or','for','to','with','by','at','from','is','are','was','were','that','this','it']);
        const words = text.toLowerCase().replace(/["'“”‘’\(\)\[\]\{\},:;!?]/g, ' ').split(/\s+/).map(s => s.trim()).filter(Boolean);
        const candidates = [];
        for (const w of words) {
          if (w.length < 3) continue;
          if (stop.has(w)) continue;
          if (!candidates.includes(w)) candidates.push(w);
          if (candidates.length >= 4) break;
        }

        if (candidates.length > 0) {
          const defs = [];
          for (const w of candidates) {
            try {
              const url = buildUrl(w);
              const res = await fetchText(url);
              if (!res.ok) continue;
              let p = null;
              try { p = JSON.parse(res.text); } catch (e) { p = null; }
              const d = extractDef(p);
              if (d) defs.push({ word: w, def: d });
            } catch (e) {
              // ignore per-word errors
            }
            if (defs.length >= 3) break;
          }
            if (defs.length > 0) {
            // Combine into a readable summary
            const combined = defs.map(x => `${x.word}: ${x.def}`).join('\n\n');
            return sendResponse({ success: true, def: combined, result: combined, raw: { primary: parsed, fallback: defs } });
          }
        }
      }

      // Final fallback: return primary raw text or a generic message
  if (parsed) return sendResponse({ success: true, def: JSON.stringify(parsed).slice(0, 800), result: JSON.stringify(parsed).slice(0,800), raw: parsed });
  return sendResponse({ success: true, def: primary.text.slice(0, 800), result: primary.text.slice(0,800), raw: primary.text });
    } catch (err) {
      return sendResponse({ success: false, error: String(err) });
    }
  })();

  // Indicate async response
  return true;
});
