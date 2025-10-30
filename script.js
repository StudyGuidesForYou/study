/*  script.js
    Robust Supabase + realtime anonymous chat
    - tries CDN (UMD) first
    - falls back to /libs/supabase.js if blocked
    - waits for window.supabase before calling createClient
    - verbose console + visible status/errors
*/

(() => {
  // ---------- CONFIG ----------
  const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
  // Use your anon (public) key here (do NOT use service_role in frontend)
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';
  const SUPABASE_LOCAL_FALLBACK = '/libs/supabase.js'; // put supabase UMD here if CDN blocked

  const STATUS = document.getElementById('status');
  const ERROR_BOX = document.getElementById('error-box');
  const CHAT_WRAP = document.getElementById('chat-wrap');
  const MESSAGES = document.getElementById('messages');
  const FORM = document.getElementById('chat-form');
  const INPUT = document.getElementById('input');

  // ---------- UTIL ----------
  function log(...args) { console.log('[chat]', ...args); }
  function error(...args) { console.error('[chat]', ...args); showError(args.join(' ')); }
  function setStatus(text) { STATUS.textContent = text; }
  function showError(msg) {
    ERROR_BOX.textContent = msg;
    ERROR_BOX.classList.remove('hidden');
  }
  function hideError() { ERROR_BOX.classList.add('hidden'); }

  // wait for a condition with timeout
  function waitFor(conditionFn, interval = 200, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function tick() {
        try {
          if (conditionFn()) return resolve();
        } catch(e) {}
        if (Date.now() - start > timeout) return reject(new Error('timeout waiting'));
        setTimeout(tick, interval);
      })();
    });
  }

  // inject a script dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  // ---------- Boot sequence ----------
  (async function boot() {
    try {
      setStatus('Checking Supabase library...');
      log('Checking window.supabase');
      // quick check
      if (!window.supabase) {
        log('window.supabase not present — waiting for CDN to load (if any)...');

        // Wait a little for the CDN script (in index.html) to load
        try {
          await waitFor(() => !!window.supabase, 200, 3000);
          log('supabase appeared via CDN.');
        } catch (cdnTimeoutErr) {
          log('CDN did not load within 3s. Attempting local fallback:', SUPABASE_LOCAL_FALLBACK);
          // try loading a local fallback file (user must put file at /libs/supabase.js)
          try {
            await loadScript(SUPABASE_LOCAL_FALLBACK);
            await waitFor(() => !!window.supabase, 200, 3000);
            log('supabase loaded from local fallback');
          } catch (fallbackErr) {
            throw new Error('Supabase library not available (CDN blocked and local fallback missing). See console.');
          }
        }
      } else {
        log('window.supabase found (CDN loaded).');
      }

      setStatus('Initializing Supabase client...');
      if (!window.supabase) throw new Error('supabase is still missing after fallback');

      // Create client
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      log('Supabase client created');

      // Run main app
      await runApp(supabase);
    } catch (err) {
      error(err.message || String(err));
      setStatus('Initialization failed');
    }
  })();

  // ---------- Main app ----------
  async function runApp(supabase) {
    hideError();
    setStatus('Connecting to database...');

    // safety: check table exists (best-effort; will not throw if permission error)
    try {
      const { error: metaErr } = await supabase.rpc('pg_table_is_visible', { /* noop: some projects don't allow */ }).catch(()=>({ error: null }));
      // ignore; just a probe placeholder (not required)
    } catch(e) {}

    // load history
    async function loadMessages() {
      setStatus('Loading messages...');
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id,message,created_at')
          .order('created_at', { ascending: true })
          .limit(500);

        if (error) {
          throw error;
        }
        MESSAGES.innerHTML = '';
        data.forEach(r => appendMessageToDOM(r.message));
        scrollToBottom();
        setStatus('Connected — realtime listening');
      } catch (e) {
        error('Failed to load messages:', e.message || e);
        setStatus('Connected (history failed)');
      }
    }

    // append to DOM
    function appendMessageToDOM(text) {
      const li = document.createElement('li');
      li.textContent = text;
      MESSAGES.appendChild(li);
    }
    function scrollToBottom() { MESSAGES.scrollTop = MESSAGES.scrollHeight; }

    // send
    FORM.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const txt = INPUT.value.trim();
      if (!txt) return;
      INPUT.disabled = true;
      setStatus('Sending message...');
      try {
        const { error } = await supabase.from('messages').insert([{ message: txt }]);
        if (error) throw error;
        INPUT.value = '';
        setStatus('Connected — realtime listening');
      } catch (e) {
        error('Send failed: ' + (e.message || e));
        setStatus('Send failed');
      } finally {
        INPUT.disabled = false;
      }
    });

    INPUT.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // form submit will trigger
      }
    });

    // realtime subscription with reconnect/backoff
    let retryDelay = 1000;
    async function subscribe() {
      try {
        setStatus('Subscribing to realtime...');
        const channel = supabase
          .channel('public:messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            try {
              appendMessageToDOM(payload.new.message);
              scrollToBottom();
            } catch (e) {
              console.error('[chat] render error', e);
            }
          })
          .subscribe();

        // log subscription success
        channel.on('subscription_succeeded', () => {
          log('Realtime subscription succeeded');
          retryDelay = 1000;
        });

        // note: channel.subscribe returns a Promise in newer SDKs, but above usage is safe.
      } catch (e) {
        error('Realtime subscribe failed: ' + (e.message || e));
        setTimeout(() => {
          retryDelay = Math.min(30000, retryDelay * 2);
          subscribe();
        }, retryDelay);
      }
    }

    // show UI and start
    CHAT_WRAP.classList.remove('hidden'); // show chat area
    await loadMessages();
    subscribe();
  }

})();
