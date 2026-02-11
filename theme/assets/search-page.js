(function () {
  if (window.NotepubSearchPage) return;

  var state = {
    form: null,
    input: null,
    results: null,
    timer: null,
    staticPromise: null
  };

  function withBasePath(path) {
    var base = (window.__notepubBaseURL || '').replace(/\/+$/, '');
    if (!path) return base || '/';
    if (/^https?:\/\//.test(path)) return path;
    if (path.charAt(0) !== '/') path = '/' + path;
    return (base || '') + path;
  }

  function readQueryFromURL() {
    var url = new URL(window.location.href);
    return (url.searchParams.get('q') || '').trim();
  }

  function updateURLQuery(q) {
    var next = q ? withBasePath('/search?q=' + encodeURIComponent(q)) : withBasePath('/search');
    window.history.replaceState({}, '', next);
  }

  function render(items, q) {
    if (!state.results) return;
    if (!q || q.length < 2) {
      state.results.innerHTML = '<p class="muted">Type at least 2 characters.</p>';
      return;
    }
    if (!items || items.length === 0) {
      state.results.innerHTML = '<p class="muted">No results yet.</p>';
      return;
    }
    var html = '<ul>';
    items.forEach(function (item) {
      var title = item.title || '';
      var path = withBasePath(item.path || '');
      var snippet = item.snippet || '';
      var thumb = item.image || item.thumbnail || '/assets/placeholder.svg';
      if (!/^https?:\/\//.test(thumb)) thumb = withBasePath(thumb);
      html += '<li><a class="search-item-card" href="' + path + '">';
      html += '<img class="search-item-thumb" src="' + thumb + '" alt="" loading="lazy" decoding="async">';
      html += '<span class="search-item-body"><span class="search-item-title">' + title + '</span>';
      if (snippet) html += '<span class="search-item-snippet muted">' + snippet + '</span>';
      html += '</span></a></li>';
    });
    html += '</ul>';
    state.results.innerHTML = html;
  }

  function getStaticIndex() {
    if (state.staticPromise) return state.staticPromise;
    state.staticPromise = fetch(withBasePath('/search.json'), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('search.json not available');
        return res.json();
      })
      .then(function (data) {
        return (data && data.items) || [];
      });
    return state.staticPromise;
  }

  function searchStatic(q) {
    return getStaticIndex().then(function (items) {
      var needle = q.toLowerCase();
      var filtered = items.filter(function (item) {
        return ((item.title || '').toLowerCase().indexOf(needle) !== -1) ||
          ((item.snippet || '').toLowerCase().indexOf(needle) !== -1);
      }).slice(0, 10);
      render(filtered, q);
    }).catch(function () {
      render([], q);
    });
  }

  function searchServer(q) {
    return fetch(withBasePath('/v1/search') + '?q=' + encodeURIComponent(q) + '&limit=10', {
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('search failed');
      return res.json();
    }).then(function (data) {
      render((data && data.items) || [], q);
    }).catch(function () {
      render([], q);
    });
  }

  function runSearch(q) {
    var query = (q || '').trim();
    updateURLQuery(query);
    if (query.length < 2) {
      render([], query);
      return;
    }
    if (window.__notepubSearchMode === 'server') {
      searchServer(query);
      return;
    }
    searchStatic(query);
  }

  function init() {
    state.form = document.querySelector('[data-search-page-form]');
    state.input = document.querySelector('[data-search-page-input]');
    state.results = document.querySelector('[data-search-page-results]');
    if (!state.form || !state.input || !state.results) return;

    state.form.addEventListener('submit', function (e) {
      e.preventDefault();
      runSearch(state.input.value);
    });

    state.input.addEventListener('input', function () {
      clearTimeout(state.timer);
      state.timer = setTimeout(function () {
        runSearch(state.input.value);
      }, 180);
    });

    var initial = readQueryFromURL();
    if (initial) {
      state.input.value = initial;
      runSearch(initial);
    }
  }

  window.NotepubSearchPage = { init: init };
  init();
})();
