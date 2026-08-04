var UI = (function () {
  var viewRoot = document.getElementById("viewRoot");
  var sentinel = document.getElementById("scrollSentinel");
  var toastEl = document.getElementById("toast");
  var rows = {};
  var rowOrder = [];
  var viewState = null;
  var lazyObserver = null;
  var revealObserver = null;
  var sentinelObserver = null;

  function init() {
    lazyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) img.src = img.dataset.src;
            lazyObserver.unobserve(img);
          }
        });
      },
      { rootMargin: "300px" },
    );

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            revealObserver.unobserve(entry.target);
            var key = entry.target.dataset.rowKey;
            if (rows[key] && !rows[key].started) loadRowPage(key);
          }
        });
      },
      { rootMargin: "400px" },
    );

    sentinelObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) loadGridPage();
      },
      { rootMargin: "600px" },
    );
    sentinelObserver.observe(sentinel);
  }

  function observeLazy(el) {
    lazyObserver.observe(el);
  }

  function registerLazy(root) {
    root.querySelectorAll("img[data-src]").forEach(function (img) {
      observeLazy(img);
    });
  }

  function skeletonCard() {
    var el = document.createElement("div");
    el.className = "card card-skeleton";
    el.innerHTML =
      '<div class="card-media"><div class="skeleton skeleton-media"></div></div>' +
      '<div class="card-body">' +
      '<div class="skeleton skeleton-line w70"></div>' +
      '<div class="skeleton skeleton-line w40"></div>' +
      "</div>";
    return el;
  }

  function skeletons(n) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) frag.appendChild(skeletonCard());
    return frag;
  }

  function shortTitle(item) {
    return item.title || item.name || "Untitled";
  }

  function shortYear(item) {
    var d = item.release_date || item.first_air_date;
    return d ? String(d).slice(0, 4) : "";
  }

  function ratingText(v) {
    return typeof v === "number" ? v.toFixed(1) : "N/A";
  }

  function card(item, mediaType) {
    var type = mediaType || item.media_type || "movie";
    var el = document.createElement("div");
    el.className = "card";
    el.dataset.type = type;
    el.dataset.id = item.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.innerHTML =
      '<div class="card-media">' +
      '<img class="card-img" data-src="' +
      API.poster(item.poster_path) +
      '" alt="' +
      shortTitle(item) +
      '" loading="lazy">' +
      '<div class="card-shade"></div>' +
      '<span class="card-play"><i class="fas fa-play"></i></span>' +
      '<span class="card-rating"><i class="fas fa-star"></i> ' +
      ratingText(item.vote_average) +
      "</span>" +
      '<span class="card-type">' +
      (type === "tv" ? "TV" : "Movie") +
      "</span>" +
      "</div>" +
      '<div class="card-body">' +
      '<h3 class="card-title">' +
      shortTitle(item) +
      "</h3>" +
      '<div class="card-sub">' +
      shortYear(item) +
      "</div>" +
      "</div>";
    el.addEventListener("click", function () {
      location.hash = "#/" + type + "/" + item.id;
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        location.hash = "#/" + type + "/" + item.id;
      }
    });
    return el;
  }

  function hero(item) {
    var el = document.createElement("section");
    el.className = "hero";
    var bg =
      API.backdrop(item.backdrop_path) || API.poster(item.poster_path, "w1280");
    el.innerHTML =
      '<div class="hero-bg-wrap"><img class="hero-bg" data-src="' +
      bg +
      '" alt="" loading="lazy"></div>' +
      '<div class="hero-content">' +
      '<span class="hero-badge"><i class="fas fa-fire"></i> Trending Today</span>' +
      '<h1 class="hero-title">' +
      shortTitle(item) +
      "</h1>" +
      '<div class="hero-meta">' +
      '<span class="hero-rating"><i class="fas fa-star"></i> ' +
      ratingText(item.vote_average) +
      "</span>" +
      "<span>" +
      shortYear(item) +
      "</span>" +
      "<span>" +
      (item.media_type === "tv" ? "TV Show" : "Movie") +
      "</span>" +
      "</div>" +
      '<p class="hero-overview">' +
      (item.overview || "") +
      "</p>" +
      '<div class="hero-actions">' +
      '<button class="btn btn-accent" data-watch><i class="fas fa-play"></i> Watch Now</button>' +
      "</div>" +
      "</div>";
    el.querySelector("[data-watch]").addEventListener("click", function () {
      location.hash =
        item.media_type === "tv" ? "#/tv/" + item.id : "#/movie/" + item.id;
    });
    return el;
  }

  function makeSection(key, label) {
    var sec = document.createElement("section");
    sec.className = "row-section";
    sec.dataset.rowKey = key;
    sec.innerHTML =
      '<div class="row-head">' +
      '<h2 class="row-title">' +
      label +
      "</h2>" +
      "</div>" +
      '<div class="row-track"></div>';
    revealObserver.observe(sec);
    return sec;
  }

  function loadRowPage(key) {
    var row = rows[key];
    if (!row || row.loading || row.done) return;
    if (!row.started) {
      row.started = true;
      row.track.innerHTML = "";
      row.track.appendChild(skeletons(CONFIG.pageSize));
    }
    row.loading = true;
    var page = row.page + 1;
    var source = row.source;
    source(page)
      .then(function (data) {
        row.loading = false;
        row.page = page;
        row.done = !data.results || data.results.length === 0;
        if (row.started) row.track.innerHTML = "";
        row.started = true;
        var frag = document.createDocumentFragment();
        (data.results || []).forEach(function (item) {
          frag.appendChild(card(item, row.type));
        });
        row.track.appendChild(frag);
        registerLazy(row.track);
      })
      .catch(function () {
        row.loading = false;
        if (!row.started) row.started = true;
        UI.toast(
          "Could not load " +
            row.label +
            ". Check your network or TMDB API key.",
        );
      });
  }

  function handleRowScroll(key, track) {
    return function () {
      var nearEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 400;
      if (nearEnd) loadRowPage(key);
    };
  }

  function renderHome() {
    viewRoot.innerHTML = "";
    rows = {};
    rowOrder = [];
    var top = document.createElement("div");
    API.trending("movie", 1)
      .then(function (data) {
        var items = (data.results || []).filter(function (it) {
          return it.backdrop_path || it.poster_path;
        });
        if (items.length) {
          top.appendChild(hero(items[0]));
          viewRoot.prepend(top);
          registerLazy(top);
        }
      })
      .catch(function () {});
    viewRoot.appendChild(top);

    var defs = [
      {
        key: "trending-movies",
        label: "Trending Movies",
        type: "movie",
        source: function (p) {
          return API.trending("movie", p);
        },
      },
      {
        key: "top-movies",
        label: "Top Rated Movies",
        type: "movie",
        source: function (p) {
          return API.topRated("movie", p);
        },
      },
      {
        key: "trending-tv",
        label: "Trending TV Shows",
        type: "tv",
        source: function (p) {
          return API.trending("tv", p);
        },
      },
      {
        key: "top-tv",
        label: "Top Rated TV Shows",
        type: "tv",
        source: function (p) {
          return API.topRated("tv", p);
        },
      },
    ];
    defs.forEach(function (def) {
      var sec = makeSection(def.key, def.label);
      var track = sec.querySelector(".row-track");
      rows[def.key] = {
        key: def.key,
        label: def.label,
        type: def.type,
        source: def.source,
        page: 0,
        done: false,
        loading: false,
        started: false,
        track: track,
      };
      rowOrder.push(def.key);
      viewRoot.appendChild(sec);
      track.addEventListener("scroll", handleRowScroll(def.key, track), {
        passive: true,
      });
    });
  }

  function openGrid(key, title, type, source) {
    rows = {};
    rowOrder = [];
    viewRoot.innerHTML =
      '<div class="page-head">' +
      '<h1 class="page-title">' +
      title +
      "</h1>" +
      "</div>" +
      '<div class="grid" data-grid></div>';
    var grid = viewRoot.querySelector("[data-grid]");
    viewState = {
      key: key,
      type: type,
      source: source,
      page: 0,
      done: false,
      loading: false,
    };
    loadGridPage(grid);
  }

  function loadGridPage(grid) {
    if (!viewState) return;
    var state = viewState;
    if (state.loading || state.done) return;
    state.loading = true;
    var page = state.page + 1;
    if (!grid) grid = viewRoot.querySelector("[data-grid]");
    var loadingCards = grid ? skeletons(4) : null;
    if (loadingCards) grid.appendChild(loadingCards);
    state
      .source(page)
      .then(function (data) {
        state.loading = false;
        state.page = page;
        state.done = !data.results || data.results.length === 0;
        var items = (data.results || []).filter(function (it) {
          return it.poster_path;
        });
        if (!items.length && page === 1) {
          grid.innerHTML = "";
          grid.appendChild(
            emptyState("No titles found. Try a different search."),
          );
          return;
        }
        if (page === 1) grid.innerHTML = "";
        if (loadingCards && loadingCards.parentNode)
          loadingCards.parentNode.removeChild(loadingCards);
        var frag = document.createDocumentFragment();
        items.forEach(function (item) {
          frag.appendChild(card(item, state.type));
        });
        grid.appendChild(frag);
        registerLazy(grid);
      })
      .catch(function () {
        state.loading = false;
        if (loadingCards && loadingCards.parentNode)
          loadingCards.parentNode.removeChild(loadingCards);
        if (page === 1) {
          grid.innerHTML = "";
          grid.appendChild(
            emptyState(
              "Could not load content. Check your network or TMDB API key.",
            ),
          );
        }
        UI.toast("Could not load more titles.");
      });
  }

  function emptyState(msg) {
    var el = document.createElement("div");
    el.className = "empty-state";
    el.innerHTML = '<i class="fas fa-film"></i><p>' + msg + "</p>";
    return el;
  }

  function renderSearch(query) {
    viewRoot.innerHTML =
      '<div class="page-head">' +
      '<h1 class="page-title">Results for "<span id="searchTerm"></span>"</h1>' +
      "</div>" +
      '<div class="grid" data-grid></div>';
    document.getElementById("searchTerm").textContent = query;
    var grid = viewRoot.querySelector("[data-grid]");
    viewState = {
      key: "search",
      type: null,
      source: function (p) {
        return API.searchMulti(query, p);
      },
      page: 0,
      done: false,
      loading: false,
    };
    loadGridPage(grid);
  }

  function renderWatch(type, id) {
    rows = {};
    rowOrder = [];
    viewState = null;
    viewRoot.innerHTML =
      '<div class="watch-top">' +
      '<button class="btn btn-ghost back-btn" id="backBtn"><i class="fas fa-chevron-left"></i> Back</button>' +
      '<h1 class="watch-title" id="watchTitle">Loading...</h1>' +
      "</div>" +
      '<div class="watch-controls" id="watchControls"></div>' +
      '<div class="player" id="player" hidden></div>';

    document.getElementById("backBtn").addEventListener("click", function () {
      if (history.length > 1) history.back();
      else location.hash = "#/";
    });

    API.details(type, id)
      .then(function (data) {
        document.getElementById("watchTitle").textContent =
          data.title || data.name || "Untitled";
        var controls = document.getElementById("watchControls");
        if (type === "tv") {
          var seasons = (data.seasons || []).filter(function (s) {
            return s.season_number > 0;
          });
          var defaultS = seasons.length ? seasons[0].season_number : 1;
          var defaultE = seasons.length
            ? Math.min(seasons[0].episode_count || 1, 1)
            : 1;
          controls.appendChild(tvControls(seasons, defaultS, defaultE));
          Player.load("tv", data.id, defaultS, defaultE);
        } else {
          Player.load("movie", data.id);
        }
      })
      .catch(function () {
        document.getElementById("watchTitle").textContent = "Title unavailable";
        Player.load(type === "tv" ? "tv" : "movie", id, 1, 1);
      });
  }

  function captureView() {
    return {
      html: viewRoot.innerHTML,
      viewState: viewState,
      rows: rowOrder.map(function (k) {
        var r = rows[k];
        return {
          key: r.key,
          label: r.label,
          type: r.type,
          source: r.source,
          page: r.page,
          done: r.done,
          loading: false,
          started: r.started,
        };
      }),
    };
  }

  function restoreView(data) {
    viewRoot.innerHTML = data.html;
    rows = {};
    rowOrder = [];
    data.rows.forEach(function (r) {
      var track = viewRoot.querySelector(
        '[data-row-key="' + r.key + '"] .row-track',
      );
      rows[r.key] = {
        key: r.key,
        label: r.label,
        type: r.type,
        source: r.source,
        page: r.page,
        done: r.done,
        loading: false,
        started: r.started,
        track: track,
      };
      rowOrder.push(r.key);
      if (track) {
        track.addEventListener("scroll", handleRowScroll(r.key, track), {
          passive: true,
        });
        var sec = track.closest(".row-section");
        if (sec && !r.started) revealObserver.observe(sec);
      }
    });
    viewState = data.viewState;
    registerLazy(viewRoot);
  }

  function makeSelect(label) {
    var span = document.createElement("span");
    span.className = "select-wrap";
    var sel = document.createElement("select");
    sel.className = "select";
    sel.setAttribute("aria-label", label);
    span.appendChild(sel);
    var arrow = document.createElement("i");
    arrow.className = "fas fa-chevron-down select-arrow";
    span.appendChild(arrow);
    return { wrap: span, sel: sel };
  }

  function tvControls(seasons, activeS, activeE) {
    var wrap = document.createElement("div");
    wrap.className = "tv-controls";
    var seasonWrap = makeSelect("Season");
    var seasonSel = seasonWrap.sel;
    seasons.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.season_number;
      opt.textContent = "Season " + s.season_number;
      if (s.season_number === activeS) opt.selected = true;
      seasonSel.appendChild(opt);
    });
    var episodeWrap = makeSelect("Episode");
    var episodeSel = episodeWrap.sel;
    var current =
      seasons.find(function (s) {
        return s.season_number === activeS;
      }) || seasons[0];
    var count = current ? Math.max(current.episode_count || 1, 1) : 1;
    for (var i = 1; i <= count; i++) {
      var optE = document.createElement("option");
      optE.value = i;
      optE.textContent = "Episode " + i;
      if (i === activeE) optE.selected = true;
      episodeSel.appendChild(optE);
    }
    function populateEpisodes(s) {
      var ep = seasons.find(function (x) {
        return x.season_number === s;
      });
      var n = ep ? Math.max(ep.episode_count || 1, 1) : 1;
      episodeSel.innerHTML = "";
      for (var k = 1; k <= n; k++) {
        var o = document.createElement("option");
        o.value = k;
        o.textContent = "Episode " + k;
        episodeSel.appendChild(o);
      }
    }
    function selectedEpisode() {
      return parseInt(episodeSel.value, 10) || 1;
    }
    seasonSel.addEventListener("change", function () {
      populateEpisodes(parseInt(seasonSel.value, 10));
      episodeSel.value = "1";
      Player.setEpisode(parseInt(seasonSel.value, 10), selectedEpisode());
    });
    episodeSel.addEventListener("change", function () {
      Player.setEpisode(parseInt(seasonSel.value, 10), selectedEpisode());
    });
    wrap.appendChild(seasonWrap.wrap);
    wrap.appendChild(episodeWrap.wrap);
    return wrap;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add("is-visible");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove("is-visible");
      setTimeout(function () {
        toastEl.hidden = true;
      }, 250);
    }, 3600);
  }

  init();

  return {
    renderHome: renderHome,
    openGrid: openGrid,
    renderSearch: renderSearch,
    renderWatch: renderWatch,
    captureView: captureView,
    restoreView: restoreView,
    toast: toast,
  };
})();
