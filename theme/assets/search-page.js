(function() {
  if (window.NotepubSearchPage) return;

  var state = {
    form: null,
    input: null,
    autoResults: null,
    status: null,
    summary: null,
    pageList: null,
    empty: null,
    more: null,
    abort: null,
    debounceId: null,
    mode: null,
    staticItems: null,
    staticPromise: null,
    items: [],
    selected: -1
  };

  function getBasePath() {
    try {
      var raw = window.__notepubBaseURL || '/';
      var path = new URL(raw, window.location.origin).pathname || '/';
      return path.replace(/\/+$/, '');
    } catch (_err) {
      return '';
    }
  }

  function withBasePath(path) {
    if (!path || path.charAt(0) !== '/') return path;
    if (path.indexOf('//') === 0 || path.charAt(1) === '#') return path;
    var basePath = getBasePath();
    if (!basePath) return path;
    if (path === basePath || path.indexOf(basePath + '/') === 0) return path;
    return basePath + path;
  }

  function init() {
    state.form = document.querySelector('.np-search-page-form');
    state.input = document.querySelector('.np-search-page-form input[name="q"]');
    state.autoResults = document.querySelector('.search-page .np-search-results');
    state.status = document.querySelector('.search-page .np-search-status');
    state.summary = document.querySelector('.np-search-summary');
    state.pageList = document.querySelector('.np-search-page-results');
    state.empty = document.querySelector('.np-search-empty');
    state.more = document.querySelector('.np-search-more');
    if (!state.form || !state.input || !state.autoResults) return;

    state.input.addEventListener('input', onInput);
    state.input.addEventListener('keydown', onKeyDown);

    var initial = state.input.value.trim();
    if (initial.length >= 2) {
      search(initial);
    }
  }

  function onInput() {
    var q = state.input.value.trim();
    if (state.debounceId) window.clearTimeout(state.debounceId);
    state.debounceId = window.setTimeout(function() {
      search(q);
    }, 200);
  }

  function onKeyDown(e) {
    if (!state.items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.selected = Math.min(state.items.length - 1, state.selected + 1);
      renderAutocomplete(state.items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.selected = Math.max(0, state.selected - 1);
      renderAutocomplete(state.items);
    } else if (e.key === 'Enter') {
      if (state.selected >= 0 && state.items[state.selected]) {
        e.preventDefault();
        window.location.href = withBasePath(state.items[state.selected].path);
      }
    }
  }

  function search(q) {
    updateHistory(q);
    if (q.length < 2) {
      state.items = [];
      state.selected = -1;
      renderAutocomplete([]);
      setStatus('');
      updateSummary(q, 0);
      return;
    }
    resolveMode().then(function(mode) {
      if (mode === 'static') {
        searchStatic(q);
      } else {
        searchServer(q);
      }
    });
  }

  function resolveMode() {
    if (state.mode) return Promise.resolve(state.mode);
    if (state.staticPromise) return state.staticPromise;
    if (window.__notepubSearchMode === 'server') {
      state.mode = 'server';
      return Promise.resolve(state.mode);
    }
    if (window.__notepubSearchMode === 'static') {
      return loadStaticIndex();
    }
    return loadStaticIndex().catch(function() {
      state.mode = 'server';
      return state.mode;
    });
  }

  function loadStaticIndex() {
    state.staticPromise = fetch(withBasePath('/search.json'), {
      headers: { 'Accept': 'application/json' }
    })
      .then(function(res) {
        if (!res.ok) throw res;
        return res.json();
      })
      .then(function(data) {
        state.staticItems = Array.isArray(data.items) ? data.items : [];
        state.mode = 'static';
        return state.mode;
      });
    return state.staticPromise;
  }

  function searchServer(q) {
    if (state.abort) state.abort.abort();
    state.abort = new AbortController();
    setStatus('Loading...');
    fetch(withBasePath('/v1/search') + '?q=' + encodeURIComponent(q) + '&limit=10', {
      signal: state.abort.signal,
      headers: { 'Accept': 'application/json' }
    })
      .then(function(res) { return res.ok ? res.json() : Promise.reject(res); })
      .then(function(data) {
        var items = Array.isArray(data.items) ? data.items : [];
        state.items = items;
        state.selected = -1;
        renderAutocomplete(items);
        renderPageResults(items);
        updateSummary(q, items.length);
        setStatus(items.length ? '' : 'No results');
      })
      .catch(function(err) {
        if (err && err.name === 'AbortError') return;
        setStatus('Error loading results');
      });
  }

  function searchStatic(q) {
    setStatus('Loading...');
    var items = Array.isArray(state.staticItems) ? state.staticItems : [];
    var query = q.toLowerCase();
    var matches = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var hay = (item.title || '') + ' ' + (item.snippet || '') + ' ' + (item.path || '');
      if (hay.toLowerCase().indexOf(query) !== -1) {
        matches.push(item);
      }
    }
    matches.sort(function(a, b) {
      return (Number(b.score) || 0) - (Number(a.score) || 0);
    });
    var top = matches.slice(0, 10);
    state.items = top;
    state.selected = -1;
    renderAutocomplete(top);
    renderPageResults(top);
    updateSummary(q, matches.length);
    setStatus(top.length ? '' : 'No results');
  }

  function renderAutocomplete(items) {
    state.autoResults.innerHTML = '';
    if (!items.length) {
      state.autoResults.classList.remove('has-items');
      return;
    }
    state.autoResults.classList.add('has-items');
    items.forEach(function(item, idx) {
      var row = document.createElement('div');
      row.className = 'np-search-item' + (idx === state.selected ? ' is-selected' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', idx === state.selected ? 'true' : 'false');

      var thumb = document.createElement('img');
      thumb.className = 'np-search-item-thumb';
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      thumb.src = resolveThumb(item);
      thumb.onerror = function() {
        thumb.onerror = null;
        thumb.src = withBasePath('/assets/notepub.jpg');
      };

      var body = document.createElement('div');
      body.className = 'np-search-item-body';

      var title = document.createElement('div');
      title.className = 'np-search-item-title';
      title.textContent = item.title || item.path;

      body.appendChild(title);
      if (item.snippet) {
        var snippet = document.createElement('div');
        snippet.className = 'np-search-item-snippet';
        snippet.textContent = item.snippet;
        body.appendChild(snippet);
      }

      row.appendChild(thumb);
      row.appendChild(body);
      row.addEventListener('click', function() {
        window.location.href = withBasePath(item.path);
      });
      state.autoResults.appendChild(row);
    });
  }

  function renderPageResults(items) {
    if (state.pageList) {
      state.pageList.innerHTML = '';
      items.forEach(function(item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        var thumb = document.createElement('img');
        var body = document.createElement('span');
        var title = document.createElement('span');
        a.href = withBasePath(item.path);
        a.className = 'np-search-item-card';
        thumb.className = 'np-search-item-thumb';
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        thumb.src = resolveThumb(item);
        thumb.onerror = function() {
          thumb.onerror = null;
          thumb.src = withBasePath('/assets/notepub.jpg');
        };
        body.className = 'np-search-item-body';
        title.className = 'np-search-item-title';
        title.textContent = item.title || item.path;
        body.appendChild(title);
        if (item.snippet) {
          var snippet = document.createElement('span');
          snippet.className = 'np-search-item-snippet';
          snippet.textContent = item.snippet;
          body.appendChild(snippet);
        }
        a.appendChild(thumb);
        a.appendChild(body);
        li.appendChild(a);
        state.pageList.appendChild(li);
      });
    }

    if (state.empty) {
      state.empty.style.display = items.length ? 'none' : '';
    }
    if (state.more) {
      state.more.style.display = 'none';
    }
  }

  function updateSummary(q, count) {
    if (!state.summary) return;
    if (!q) {
      state.summary.textContent = '';
      return;
    }
    state.summary.textContent = 'Query: ' + q + ' (' + count + ')';
  }

  function setStatus(text) {
    if (state.status) state.status.textContent = text;
  }

  function updateHistory(q) {
    if (!window.history || !window.history.replaceState) return;
    var url = q ? withBasePath('/search?q=' + encodeURIComponent(q)) : withBasePath('/search');
    window.history.replaceState({}, '', url);
  }

  window.NotepubSearchPage = { init: init };

  function resolveThumb(item) {
    var thumb = item && (item.image || item.thumbnail) ? (item.image || item.thumbnail) : '/assets/notepub.jpg';
    if (typeof thumb !== 'string') return withBasePath('/assets/notepub.jpg');
    if (/^https?:\/\//i.test(thumb)) return thumb;
    return withBasePath(thumb);
  }
})();
