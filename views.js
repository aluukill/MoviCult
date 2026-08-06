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
  var slideshow = null;
  var episodeCache = {};
  var genreCache = {};
  var watchState = { s: 1, e: 1 };
  var watchMetaBase = "";
  var watchTitle = "";
  var watchPoster = "";
  var ldEl = null;
  var closeSearchFn = null;
  var BACK =
    '<button class="btn btn-ghost back-btn" id="backBtn"><i class="fas fa-chevron-left"></i> Back</button>';

  var STORAGE_KEYS = {
    watchlist: "movicult_watchlist",
    history: "movicult_history",
  };

  function getWatchlist() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.watchlist) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveWatchlist(list) {
    localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(list));
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list));
  }

  function isInWatchlist(type, id) {
    var list = getWatchlist();
    return list.some(function (item) {
      return item.type === type && item.id === id;
    });
  }

  function toggleWatchlist(type, id, title, poster) {
    var list = getWatchlist();
    var idx = list.findIndex(function (item) {
      return item.type === type && item.id === id;
    });
    if (idx >= 0) {
      list.splice(idx, 1);
      saveWatchlist(list);
      return false;
    } else {
      list.unshift({
        type: type,
        id: id,
        title: title,
        poster: poster,
        addedAt: Date.now(),
      });
      saveWatchlist(list);
      return true;
    }
  }

  function addToHistory(type, id, title, poster, season, episode) {
    var list = getHistory();
    var key = type + ":" + id + (season ? ":" + season + ":" + episode : "");
    list = list.filter(function (item) {
      return item.key !== key;
    });
    list.unshift({
      key: key,
      type: type,
      id: id,
      title: title,
      poster: poster,
      season: season || null,
      episode: episode || null,
      watchedAt: Date.now(),
    });
    if (list.length > 50) list = list.slice(0, 50);
    saveHistory(list);
  }

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
        if (
          entries[0].isIntersecting &&
          viewState &&
          !viewState.done &&
          !viewState.loading
        )
          loadGridPage();
      },
      { rootMargin: "600px" },
    );
    sentinelObserver.observe(sentinel);

    function syncSiteHeaderH() {
      var h = document.querySelector(".site-header");
      if (h) {
        document.documentElement.style.setProperty(
          "--site-header-h",
          h.getBoundingClientRect().height + "px",
        );
      }
    }
    syncSiteHeaderH();
    window.addEventListener("resize", syncSiteHeaderH);

    window.addEventListener(
      "scroll",
      function () {
        var scrollY = window.scrollY || window.pageYOffset;
        var clientHeight = document.documentElement.clientHeight;
        var scrollHeight = document.documentElement.scrollHeight;
        if (scrollY + clientHeight >= scrollHeight - 400) {
          if (viewState && !viewState.done && !viewState.loading)
            loadGridPage();
          rowOrder.forEach(function (key) {
            var row = rows[key];
            if (row && !row.done && !row.loading && row.started) {
              var rect = row.track.getBoundingClientRect();
              if (rect.bottom <= window.innerHeight + 600) loadRowPage(key);
            }
          });
        }
      },
      { passive: true },
    );

  }

  function setPageTitle(title) {
    document.title = title
      ? title + " | MoviCult"
      : "MoviCult — Stream Movies & TV Shows Online";
  }

  function teardown() {
    if (slideshow) {
      slideshow.destroy();
      slideshow = null;
    }
    rows = {};
    rowOrder = [];
    viewState = null;
  }

  function esc(text) {
    var d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function observeLazy(el) {
    lazyObserver.observe(el);
  }

  function registerLazy(root) {
    root.querySelectorAll("img[data-src]").forEach(function (img) {
      observeLazy(img);
    });
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

  function mediaTypeOf(item) {
    return item.media_type === "tv" ? "tv" : "movie";
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
    var wrap = document.createElement("div");
    wrap.className = "skeleton-wrap";
    for (var i = 0; i < n; i++) wrap.appendChild(skeletonCard());
    return wrap;
  }

  function episodeSkeleton() {
    var el = document.createElement("div");
    el.className = "episode-card";
    el.innerHTML =
      '<div class="episode-thumb-wrap"><div class="skeleton" style="position:absolute;inset:0"></div></div>' +
      '<div class="episode-body">' +
      '<div class="skeleton skeleton-line w60"></div>' +
      '<div class="skeleton skeleton-line w40"></div>' +
      "</div>";
    return el;
  }

  function card(item, mediaType) {
    var type = mediaType || mediaTypeOf(item);
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
      esc(shortTitle(item)) +
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
      esc(shortTitle(item)) +
      "</h3>" +
      '<div class="card-sub">' +
      esc(shortYear(item)) +
      "</div>" +
      "</div>";
    el.addEventListener("click", function () {
      location.hash = "#/title/" + type + "/" + item.id;
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        location.hash = "#/title/" + type + "/" + item.id;
      }
    });
    return el;
  }

  function heroSlideshow(items, container, opts) {
    var current = 0;
    var slides = [];
    var dots = [];
    var heroEl = null;
    var timer = null;
    var interval = opts && opts.interval > 0 ? opts.interval : 6000;
    var reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    var userPlayed = false;
    var explicitPause = false;

    container.innerHTML =
      '<div class="hero" role="region" aria-roledescription="carousel" aria-label="Trending slides">' +
      '<div class="hero-slides" aria-live="off"></div>' +
      '<button class="hero-arrow prev" aria-label="Previous slide"><i class="fas fa-chevron-left"></i></button>' +
      '<button class="hero-arrow next" aria-label="Next slide"><i class="fas fa-chevron-right"></i></button>' +
      '<div class="hero-dots"></div>' +
      '<button class="hero-toggle" type="button" aria-pressed="false" aria-label="Pause slideshow"><i class="fas fa-pause" aria-hidden="true"></i></button>' +
      "</div>";

    heroEl = container.querySelector(".hero");
    var slidesEl = container.querySelector(".hero-slides");
    var dotsEl = container.querySelector(".hero-dots");
    var prevBtn = container.querySelector(".prev");
    var nextBtn = container.querySelector(".next");
    var toggleBtn = container.querySelector(".hero-toggle");

    items.forEach(function (item, i) {
      var slide = document.createElement("div");
      slide.className = "hero-slide" + (i === 0 ? " is-active" : "");
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", i + 1 + " of " + items.length);
      var type = mediaTypeOf(item);
      slide.innerHTML =
        '<img class="hero-bg" data-src="' +
        API.backdrop(item.backdrop_path) +
        '" alt="" loading="lazy">' +
        '<div class="hero-content">' +
        '<span class="hero-badge"><i class="fas fa-fire"></i> Trending #' +
        (i + 1) +
        "</span>" +
        '<h2 class="hero-title">' +
        esc(shortTitle(item)) +
        "</h2>" +
        '<div class="hero-meta">' +
        '<span class="hero-rating"><i class="fas fa-star"></i> ' +
        ratingText(item.vote_average) +
        "</span>" +
        "<span>" +
        esc(shortYear(item)) +
        "</span>" +
        "<span>" +
        (type === "tv" ? "TV Show" : "Movie") +
        "</span>" +
        "</div>" +
        '<p class="hero-overview">' +
        esc(item.overview || "") +
        "</p>" +
        '<div class="hero-actions">' +
        '<button class="btn btn-primary" data-open><i class="fas fa-play"></i> Watch Now</button>' +
        "</div>" +
        "</div>" +
        '<span class="hero-rank">' +
        pad(i + 1) +
        "</span>";
      slide.querySelector("[data-open]").addEventListener("click", function () {
        location.hash = "#/title/" + type + "/" + item.id;
      });
      slides.push(slide);
      slidesEl.appendChild(slide);

      var dot = document.createElement("button");
      dot.className = "hero-dot" + (i === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "Go to slide " + (i + 1));
      dot.addEventListener("click", function () {
        go(i);
        restart();
      });
      dots.push(dot);
      dotsEl.appendChild(dot);
    });

    registerLazy(slidesEl);

    function go(i) {
      current = (i + items.length) % items.length;
      slides.forEach(function (s, k) {
        s.classList.toggle("is-active", k === current);
      });
      dots.forEach(function (d, k) {
        d.classList.toggle("is-active", k === current);
      });
    }

    prevBtn.addEventListener("click", function () {
      go(current - 1);
      restart();
    });
    nextBtn.addEventListener("click", function () {
      go(current + 1);
      restart();
    });

    var touchX = null;
    heroEl.addEventListener(
      "touchstart",
      function (ev) {
        touchX = ev.touches[0].clientX;
      },
      { passive: true },
    );
    heroEl.addEventListener(
      "touchend",
      function (ev) {
        if (touchX === null) return;
        var dx = ev.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 48) {
          go(current + (dx < 0 ? 1 : -1));
          restart();
        }
      },
      { passive: true },
    );

    function advance() {
      if (!heroEl.isConnected) {
        pause();
        return;
      }
      go(current + 1);
    }

    function syncToggle() {
      var paused = !timer;
      toggleBtn.setAttribute("aria-pressed", paused ? "true" : "false");
      toggleBtn.setAttribute(
        "aria-label",
        paused ? "Play slideshow" : "Pause slideshow",
      );
      toggleBtn.querySelector("i").className = paused
        ? "fas fa-play"
        : "fas fa-pause";
    }

    function pause() {
      clearInterval(timer);
      timer = null;
      syncToggle();
    }

    function resume() {
      if (items.length < 2 || timer) return;
      // An explicit pause from the button sticks until the user plays again;
      // hover/focus leaving must not silently restart it.
      if (explicitPause) return;
      if (reduceMotion && !userPlayed) return;
      timer = setInterval(advance, interval);
      syncToggle();
    }

    function restart() {
      pause();
      resume();
    }

    toggleBtn.addEventListener("click", function () {
      if (timer) {
        userPlayed = false;
        explicitPause = true;
        pause();
      } else {
        explicitPause = false;
        userPlayed = true;
        resume();
      }
    });

    if (window.matchMedia("(hover: hover)").matches) {
      heroEl.addEventListener("mouseenter", pause);
      heroEl.addEventListener("mouseleave", resume);
    }
    // Focusing the pause/play control itself must not trigger the focus-pause
    // (a real click/tab fires focusin on the hero before the button's click,
    // which would flip the button's state and invert the pause action).
    heroEl.addEventListener("focusin", function (ev) {
      if (ev.target === toggleBtn) return;
      pause();
    });
    heroEl.addEventListener("focusout", function (ev) {
      if (ev.target === toggleBtn) return;
      resume();
    });

    if (items.length > 1) resume();
    syncToggle();

    return {
      destroy: function () {
        pause();
        container.innerHTML = "";
      },
    };
  }

  function renderHome() {
    teardown();
    setPageTitle("");
    viewRoot.innerHTML =
      '<h1 class="visually-hidden">MoviCult — Stream Movies & TV Shows Online</h1>' +
      '<div class="hero-slot" id="heroSlot"><div class="skeleton" style="height:clamp(340px,46vw,500px);border-radius:12px"></div></div>';
    var heroSlot = document.getElementById("heroSlot");

    Promise.all([API.trending("movie", 1), API.trending("tv", 1)])
      .then(function (res) {
        var all = res[0].results
          .concat(res[1].results)
          .filter(function (r) {
            return r.backdrop_path && r.overview;
          })
          .sort(function (a, b) {
            return b.popularity - a.popularity;
          })
          .slice(0, 10);
        if (all.length) slideshow = heroSlideshow(all, heroSlot);
        else heroSlot.innerHTML = "";
      })
      .catch(function () {
        heroSlot.innerHTML = "";
      });

    var staticDefs = [
      {
        label: "Trending Movies",
        type: "movie",
        source: function (p) {
          return API.trending("movie", p);
        },
        link: "#/movies/trending",
      },
      {
        label: "Top Rated Movies",
        type: "movie",
        source: function (p) {
          return API.topRated("movie", p);
        },
        link: "#/movies/top-rated",
      },
      {
        label: "Trending TV Shows",
        type: "tv",
        source: function (p) {
          return API.trending("tv", p);
        },
        link: "#/series/trending",
      },
      {
        label: "Top Rated TV Shows",
        type: "tv",
        source: function (p) {
          return API.topRated("tv", p);
        },
        link: "#/series/top-rated",
      },
    ];
    staticDefs.forEach(function (def) {
      var sec = makeStaticSection(def.label, def.source, def.type, def.link);
      viewRoot.appendChild(sec);
    });

    var popularSec = makeSection("popular-all", "All Time Popular");
    var popularTrack = popularSec.querySelector(".row-track");
    rows["popular-all"] = {
      key: "popular-all",
      label: "All Time Popular",
      type: null,
      source: function (p) {
        return API.trending("all", p);
      },
      page: 0,
      done: false,
      loading: false,
      started: false,
      track: popularTrack,
    };
    rowOrder.push("popular-all");
    viewRoot.appendChild(popularSec);
    popularTrack.addEventListener(
      "scroll",
      handleRowScroll("popular-all", popularTrack),
      { passive: true },
    );
    loadRowPage("popular-all");
  }

  function makeStaticSection(label, source, type, link) {
    var sec = document.createElement("section");
    sec.className = "row-section";
    sec.innerHTML =
      '<div class="row-head">' +
      '<h2 class="row-title">' +
      label +
      "</h2>" +
      '<a class="btn btn-ghost btn-small" href="' +
      link +
      '">View More <i class="fas fa-arrow-right"></i></a>' +
      "</div>" +
      '<div class="row-track"></div>';
    var track = sec.querySelector(".row-track");
    track.appendChild(skeletons(10));
    source(1)
      .then(function (data) {
        track.innerHTML = "";
        var frag = document.createDocumentFragment();
        (data.results || []).forEach(function (item) {
          frag.appendChild(card(item, type));
        });
        track.appendChild(frag);
        registerLazy(track);
      })
      .catch(function () {
        track.innerHTML = "";
      });
    return sec;
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
    var firstLoad = !row.started;
    if (firstLoad) {
      row.started = true;
      row.track.innerHTML = "";
      row.track.appendChild(skeletons(CONFIG.pageSize));
    }
    row.loading = true;
    var page = row.page + 1;
    row
      .source(page)
      .then(function (data) {
        row.loading = false;
        row.page = page;
        row.done = !data.results || data.results.length === 0;
        if (firstLoad) row.track.innerHTML = "";
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
        UI.toast("Could not load " + row.label + ".");
      });
  }

  function handleRowScroll(key, track) {
    return function () {
      var row = rows[key];
      if (row && row.done) return;
      var rect = track.getBoundingClientRect();
      if (rect.bottom <= window.innerHeight + 400) {
        loadRowPage(key);
      }
    };
  }

  function openGrid(key, title, type, source, subtitle) {
    teardown();
    setPageTitle(title);
    viewRoot.innerHTML =
      '<div class="page-head">' +
      '<h1 class="page-title">' +
      title +
      "</h1>" +
      (subtitle ? '<div class="page-sub">' + subtitle + "</div>" : "") +
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

  function renderSearch(query) {
    teardown();
    setPageTitle("Search: " + query);
    viewRoot.innerHTML =
      '<div class="page-head">' +
      '<h1 class="page-title">Results for "' +
      esc(query) +
      '"</h1>' +
      "</div>" +
      '<div class="grid" data-grid></div>';
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

  function renderWatchlist() {
    teardown();
    setPageTitle("Watchlist");
    var list = getWatchlist();
    viewRoot.innerHTML =
      '<div class="page-head">' +
      '<h1 class="page-title">Watchlist</h1>' +
      '<div class="page-sub">' +
      list.length +
      " title" +
      (list.length !== 1 ? "s" : "") +
      " saved</div>" +
      "</div>" +
      '<div class="grid" data-grid></div>';
    var grid = viewRoot.querySelector("[data-grid]");
    if (!list.length) {
      grid.appendChild(
        emptyState(
          "Your watchlist is empty. Add titles from their detail pages.",
        ),
      );
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (item) {
      frag.appendChild(watchlistCard(item));
    });
    grid.appendChild(frag);
    registerLazy(grid);
  }

  function renderHistory() {
    teardown();
    setPageTitle("History");
    var list = getHistory();
    viewRoot.innerHTML =
      '<div class="page-head">' +
      '<h1 class="page-title">Watch History</h1>' +
      '<div class="page-sub">' +
      list.length +
      " title" +
      (list.length !== 1 ? "s" : "") +
      " watched</div>" +
      (list.length
        ? '<button class="btn btn-ghost btn-small" id="clearHistoryBtn"><i class="fas fa-trash"></i> Clear History</button>'
        : "") +
      "</div>" +
      '<div class="grid" data-grid></div>';
    var grid = viewRoot.querySelector("[data-grid]");
    if (!list.length) {
      grid.appendChild(
        emptyState(
          "No watch history yet. Start watching to build your history.",
        ),
      );
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (item) {
      frag.appendChild(historyCard(item));
    });
    grid.appendChild(frag);
    registerLazy(grid);
    var clearBtn = document.getElementById("clearHistoryBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        saveHistory([]);
        UI.toast("History cleared");
        UI.renderHistory();
      });
    }
  }

  function watchlistCard(item) {
    var el = document.createElement("div");
    el.className = "card";
    el.dataset.type = item.type;
    el.dataset.id = item.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    var posterUrl = item.poster
      ? API.poster(item.poster)
      : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    el.innerHTML =
      '<div class="card-media">' +
      '<img class="card-img" data-src="' +
      posterUrl +
      '" alt="' +
      esc(item.title) +
      '" loading="lazy">' +
      '<div class="card-shade"></div>' +
      '<span class="card-play"><i class="fas fa-play"></i></span>' +
      '<span class="card-type">' +
      (item.type === "tv" ? "TV" : "Movie") +
      "</span>" +
      "</div>" +
      '<div class="card-body">' +
      '<h3 class="card-title">' +
      esc(item.title) +
      "</h3>" +
      '<div class="card-sub"><button class="btn btn-ghost btn-small remove-watchlist" data-type="' +
      item.type +
      '" data-id="' +
      item.id +
      '"><i class="fas fa-bookmark"></i> Remove</button></div>' +
      "</div>";
    el.addEventListener("click", function (ev) {
      if (ev.target.closest(".remove-watchlist")) return;
      location.hash = "#/title/" + item.type + "/" + item.id;
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        location.hash = "#/title/" + item.type + "/" + item.id;
      }
    });
    el.querySelector(".remove-watchlist").addEventListener(
      "click",
      function (ev) {
        ev.stopPropagation();
        toggleWatchlist(item.type, item.id);
        UI.toast("Removed from watchlist");
        UI.renderWatchlist();
      },
    );
    return el;
  }

  function historyCard(item) {
    var el = document.createElement("div");
    el.className = "card";
    el.dataset.type = item.type;
    el.dataset.id = item.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    var posterUrl = item.poster
      ? API.poster(item.poster)
      : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    var label =
      item.type === "tv" && item.season && item.episode
        ? "Season " + item.season + " Episode " + item.episode
        : item.type === "tv"
          ? "TV"
          : "Movie";
    el.innerHTML =
      '<div class="card-media">' +
      '<img class="card-img" data-src="' +
      posterUrl +
      '" alt="' +
      esc(item.title) +
      '" loading="lazy">' +
      '<div class="card-shade"></div>' +
      '<span class="card-play"><i class="fas fa-play"></i></span>' +
      '<span class="card-type">' +
      label +
      "</span>" +
      "</div>" +
      '<div class="card-body">' +
      '<h3 class="card-title">' +
      esc(item.title) +
      "</h3>" +
      '<div class="card-sub"><span class="chip">' +
      new Date(item.watchedAt).toLocaleDateString() +
      "</span></div>" +
      "</div>";
    el.addEventListener("click", function () {
      if (item.type === "tv" && item.season && item.episode) {
        location.hash =
          "#/watch/" +
          item.type +
          "/" +
          item.id +
          "/" +
          item.season +
          "/" +
          item.episode;
      } else {
        location.hash = "#/title/" + item.type + "/" + item.id;
      }
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (item.type === "tv" && item.season && item.episode) {
          location.hash =
            "#/watch/" +
            item.type +
            "/" +
            item.id +
            "/" +
            item.season +
            "/" +
            item.episode;
        } else {
          location.hash = "#/title/" + item.type + "/" + item.id;
        }
      }
    });
    return el;
  }

  function emptyState(msg) {
    var el = document.createElement("div");
    el.className = "empty-state";
    el.innerHTML = '<i class="fas fa-film"></i><p>' + msg + "</p>";
    return el;
  }

  function genresFor(type) {
    if (genreCache[type]) return Promise.resolve(genreCache[type]);
    return API.genres(type)
      .then(function (data) {
        genreCache[type] = API.genreMap(data.genres);
        return genreCache[type];
      })
      .catch(function () {
        genreCache[type] = {};
        return {};
      });
  }

  function setStructuredData(obj) {
    if (!ldEl) {
      ldEl = document.createElement("script");
      ldEl.type = "application/ld+json";
      ldEl.id = "page-jsonld";
      document.head.appendChild(ldEl);
    }
    ldEl.textContent = obj ? JSON.stringify(obj) : "";
  }

  function structuredFor(type, data) {
    var genres = (data.genres || []).map(function (g) {
      return g.name;
    });
    var obj = {
      "@context": "https://schema.org",
      "@type": type === "tv" ? "TVSeries" : "Movie",
      name: data.title || data.name,
      description: data.overview || "",
      genre: genres,
      datePublished: data.release_date || data.first_air_date,
      url: "https://movicult.vercel.app/#/title/" + type + "/" + data.id,
    };
    var img =
      API.backdrop(data.backdrop_path) || API.poster(data.poster_path, "w500");
    if (img) obj.image = img;
    if (typeof data.vote_average === "number") {
      obj.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: data.vote_average,
        bestRating: "10",
        ratingCount: data.vote_count || 1,
      };
    }
    return obj;
  }

  function renderTitle(type, id) {
    teardown();
    setPageTitle("Loading title");
    viewRoot.innerHTML =
      '<div class="watch-top">' +
      BACK +
      "</div>" +
      '<section class="title-hero">' +
      '<div class="title-hero-content">' +
      '<div class="title-poster"><div class="skeleton" style="position:absolute;inset:0"></div></div>' +
      '<div class="title-info">' +
      '<div class="skeleton skeleton-line w70"></div>' +
      '<div class="skeleton skeleton-line w40"></div>' +
      '<div class="skeleton skeleton-line w90"></div>' +
      "</div>" +
      "</div>" +
      "</section>" +
      '<div id="titleBody"></div>';
    bindBack();

    Promise.all([API.details(type, id), genresFor(type)])
      .then(function (res) {
        var data = res[0];
        var map = res[1];
        setPageTitle(shortTitle(data));
        setStructuredData(structuredFor(type, data));

        var hero = viewRoot.querySelector(".title-hero");
        var bg = API.backdrop(data.backdrop_path);
        hero.innerHTML =
          (bg
            ? '<img class="title-backdrop" data-src="' +
              bg +
              '" alt="" loading="lazy">'
            : "") +
          '<div class="title-hero-content">' +
          '<img class="title-poster" src="' +
          API.poster(data.poster_path) +
          '" alt="' +
          esc(shortTitle(data)) +
          '">' +
          '<div class="title-info">' +
          '<h1 class="title-name">' +
          esc(shortTitle(data)) +
          "</h1>" +
          '<div class="title-meta">' +
          '<span class="title-rating"><i class="fas fa-star"></i> ' +
          ratingText(data.vote_average) +
          "</span>" +
          (shortYear(data) ? "<span>" + esc(shortYear(data)) + "</span>" : "") +
          (runtimeOf(data) ? "<span>" + runtimeOf(data) + "</span>" : "") +
          '<span class="chip">' +
          (type === "tv" ? "TV Show" : "Movie") +
          "</span>" +
          "</div>" +
          '<p class="title-overview">' +
          esc(data.overview || "No overview available.") +
          "</p>" +
          genreChips(API.genreNames(data.genres, map)) +
          directorLine(data) +
          '<div class="title-actions">' +
          '<button class="btn btn-primary" data-watch><i class="fas fa-play"></i> Watch Now</button>' +
          (trailerOf(data)
            ? '<button class="btn btn-ghost" data-trailer><i class="fas fa-circle-play"></i> Trailer</button>'
            : "") +
          '<button class="btn btn-ghost" data-watchlist><i class="fas fa-bookmark"></i> <span class="watchlist-text">' +
          (isInWatchlist(type, id)
            ? "Remove from Watchlist"
            : "Add to Watchlist") +
          "</span></button>" +
          "</div>" +
          "</div>" +
          "</div>";
        registerLazy(hero);
        hero
          .querySelector("[data-watch]")
          .addEventListener("click", function () {
            location.hash = "#/watch/" + type + "/" + data.id;
          });
        var trailerBtn = hero.querySelector("[data-trailer]");
        if (trailerBtn) {
          trailerBtn.addEventListener("click", function () {
            var tb = document.getElementById("trailerSection");
            if (tb) tb.scrollIntoView({ block: "center" });
          });
        }

        var watchlistBtn = hero.querySelector("[data-watchlist]");
        if (watchlistBtn) {
          watchlistBtn.addEventListener("click", function () {
            var added = toggleWatchlist(
              type,
              id,
              shortTitle(data),
              data.poster_path,
            );
            var textEl = watchlistBtn.querySelector(".watchlist-text");
            if (textEl)
              textEl.textContent = added
                ? "Remove from Watchlist"
                : "Add to Watchlist";
            watchlistBtn.querySelector("i").className = added
              ? "fas fa-bookmark"
              : "fas fa-bookmark";
            UI.toast(added ? "Added to watchlist" : "Removed from watchlist");
          });
        }

        var body = document.getElementById("titleBody");
        body.innerHTML = "";
        var cast = ((data.credits && data.credits.cast) || []).slice(0, 12);
        if (cast.length) {
          body.appendChild(castSection(cast));
        }
        if (trailerOf(data)) {
          body.appendChild(trailerSection(trailerOf(data), shortTitle(data)));
        }
        if (type === "movie" && data.belongs_to_collection) {
          body.appendChild(collectionSection(data.belongs_to_collection));
        }
        body.appendChild(similarSection(type, id));
      })
      .catch(function () {
        viewRoot.querySelector(".title-hero").outerHTML =
          '<div class="empty-state" style="padding:80px 20px"><i class="fas fa-triangle-exclamation"></i><p>This title could not be loaded. Please try again.</p></div>';
      });
  }

  function runtimeOf(data) {
    var r = data.runtime || (data.episode_run_time && data.episode_run_time[0]);
    return r ? r + " min" : "";
  }

  function genreChips(names) {
    if (!names.length) return "";
    return (
      '<div class="title-genres">' +
      names
        .map(function (g) {
          return '<span class="chip">' + esc(g) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function directorLine(data) {
    var dirs = ((data.credits && data.credits.crew) || [])
      .filter(function (c) {
        return c.job === "Director";
      })
      .slice(0, 3)
      .map(function (c) {
        return c.name;
      });
    if (!dirs.length) return "";
    return (
      '<p class="title-overview" style="margin-top:2px">Directed by ' +
      esc(dirs.join(", ")) +
      "</p>"
    );
  }

  function trailerOf(data) {
    var vids = (data.videos && data.videos.results) || [];
    var t = vids.find(function (v) {
      return v.site === "YouTube" && v.type === "Trailer";
    });
    if (!t)
      t = vids.find(function (v) {
        return v.site === "YouTube";
      });
    return t && t.key ? t.key : null;
  }

  function castSection(cast) {
    var sec = document.createElement("section");
    sec.className = "detail-section";
    sec.innerHTML = '<h2 class="section-title">Cast</h2>';
    var row = document.createElement("div");
    row.className = "cast-row";
    cast.forEach(function (c) {
      var el = document.createElement("div");
      el.className = "cast-card";
      var photo = API.profile(c.profile_path);
      el.innerHTML =
        (photo
          ? '<img class="cast-photo" data-src="' +
            photo +
            '" alt="' +
            esc(c.name) +
            '" loading="lazy">'
          : '<div class="cast-photo cast-ph"><i class="fas fa-user"></i></div>') +
        '<div class="cast-name">' +
        esc(c.name) +
        "</div>" +
        '<div class="cast-role">' +
        esc(c.character || "—") +
        "</div>";
      row.appendChild(el);
    });
    sec.appendChild(row);
    registerLazy(sec);
    return sec;
  }

  function trailerSection(key, title) {
    var sec = document.createElement("section");
    sec.className = "detail-section";
    sec.id = "trailerSection";
    sec.innerHTML =
      '<h2 class="section-title">Trailer</h2>' +
      '<div class="trailer-box"><iframe src="https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(key) +
      '?rel=0" title="Trailer for ' +
      esc(title) +
      '" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>';
    return sec;
  }

  function collectionSection(col) {
    var sec = document.createElement("section");
    sec.className = "detail-section";
    sec.id = "collectionSection";
    sec.innerHTML =
      '<h2 class="section-title">Part of <span id="colName">' +
      esc(col.name) +
      '</span></h2><div class="row-track" id="colTrack"></div>';
    var track = sec.querySelector("#colTrack");
    track.appendChild(skeletons(6));
    API.collection(col.id)
      .then(function (data) {
        document.getElementById("colName").textContent = data.name || col.name;
        var parts = (data.parts || [])
          .filter(function (p) {
            return p.poster_path;
          })
          .sort(function (a, b) {
            return (a.release_date || "").localeCompare(b.release_date || "");
          });
        track.innerHTML = "";
        var frag = document.createDocumentFragment();
        parts.forEach(function (p) {
          frag.appendChild(card(p, p.media_type === "tv" ? "tv" : "movie"));
        });
        track.appendChild(frag);
        registerLazy(track);
      })
      .catch(function () {
        track.innerHTML = "";
      });
    return sec;
  }

  function similarSection(type, id) {
    var sec = makeSection("similar", "More Like This");
    var track = sec.querySelector(".row-track");
    rows.similar = {
      key: "similar",
      label: "More Like This",
      type: type,
      source: function (p) {
        return API.similar(type, id, p);
      },
      page: 0,
      done: false,
      loading: false,
      started: false,
      track: track,
    };
    rowOrder.push("similar");
    track.addEventListener("scroll", handleRowScroll("similar", track), {
      passive: true,
    });
    loadRowPage("similar");
    return sec;
  }

  function bindBack() {
    var btn = document.getElementById("backBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        if (history.length > 1) history.back();
        else location.hash = "#/";
      });
    }
  }

  function renderWatch(type, id, s, e) {
    teardown();
    setPageTitle("Loading player");
    watchState = { s: s || 1, e: e || 1 };
    viewRoot.innerHTML =
      '<div class="watch-top">' +
      BACK +
      "</div>" +
      '<div class="watch-layout">' +
      '<div class="watch-player-col">' +
      '<h1 class="watch-title" id="watchTitle">Loading...</h1>' +
      '<div class="watch-meta" id="watchMeta"></div>' +
      '<div class="player" id="player">' +
      '<div class="player-frame-wrap"><div class="player-spinner"><i class="fas fa-spinner"></i><span>Loading video...</span></div></div>' +
      "</div>" +
      '<div class="status-line" id="statusLine"><i class="fas fa-circle-info"></i><span id="statusText">Loading video...</span></div>' +
      '<section class="servers" id="serversSection"></section>' +
      "</div>" +
      '<div class="watch-episodes-col" id="episodesSection"></div>' +
      "</div>";
    bindBack();

    Player.onStatus(function (msg, isError) {
      var st = document.getElementById("statusText");
      if (!st) return;
      st.textContent = msg;
      document
        .getElementById("statusLine")
        .classList.toggle("is-error", !!isError);
    });
    Player.onChange(renderServers);

    API.details(type, id)
      .then(function (data) {
        setPageTitle(shortTitle(data));
        document.getElementById("watchTitle").textContent = shortTitle(data);
        var ratingHtml =
          '<span class="title-rating"><i class="fas fa-star"></i> ' +
          ratingText(data.vote_average) +
          "</span>";
        var meta = [
          ratingHtml,
          shortYear(data),
          type === "tv" ? "TV Show" : "Movie",
        ];
        watchTitle = shortTitle(data);
        watchPoster = data.poster_path;
        if (type === "tv") {
          watchMetaBase =
            "<span>" +
            ratingHtml +
            "</span>" +
            (shortYear(data)
              ? "<span>" + esc(shortYear(data)) + "</span>"
              : "") +
            "<span>" +
            esc(type === "tv" ? "TV Show" : "Movie") +
            "</span>";
          meta.push("Season " + watchState.s + " · Episode " + watchState.e);
        }
        document.getElementById("watchMeta").innerHTML = meta
          .map(function (m, i) {
            if (i === 0) return "<span>" + m + "</span>";
            return m ? "<span>" + esc(m) + "</span>" : "";
          })
          .join("");
        var watchLayout = viewRoot.querySelector(".watch-layout");
        var solo = type === "movie" || data.number_of_episodes === 1;
        if (watchLayout) watchLayout.classList.toggle("is-solo", solo);
        if (type === "tv" && !solo) {
          var seasons = (data.seasons || []).filter(function (x) {
            return x.season_number > 0;
          });
          if (seasons.length) {
            var wanted = seasons.some(function (x) {
              return x.season_number === watchState.s;
            })
              ? watchState.s
              : seasons[0].season_number;
            if (wanted !== watchState.s) {
              // Season from the URL was invalid: keep the meta line in sync
              // with the corrected season the chips now show.
              watchState.s = wanted;
              var metaEl = document.getElementById("watchMeta");
              if (metaEl)
                metaEl.innerHTML =
                  watchMetaBase +
                  "<span>Season " +
                  wanted +
                  " · Episode " +
                  watchState.e +
                  "</span>";
            }
            buildEpisodesSection(type, id, seasons);
          } else {
            document.getElementById("episodesSection").innerHTML = "";
          }
        } else {
          document.getElementById("episodesSection").innerHTML = "";
        }
        Player.load(type, id, watchState.s, watchState.e);
        addToHistory(
          type,
          id,
          shortTitle(data),
          data.poster_path,
          watchState.s,
          watchState.e,
        );
      })
      .catch(function () {
        document.getElementById("watchTitle").textContent = "Title unavailable";
        Player.load(
          type === "tv" ? "tv" : "movie",
          id,
          watchState.s,
          watchState.e,
        );
      });
  }

  function buildEpisodesSection(type, id, seasons) {
    var sec = document.getElementById("episodesSection");
    var chips = seasons
      .map(function (x) {
        var s = x.season_number;
        var active = s === watchState.s;
        return (
          '<button type="button" class="season-chip' +
          (active ? " is-active" : "") +
          '" role="tab" aria-selected="' +
          (active ? "true" : "false") +
          '" data-season="' +
          s +
          '">S' +
          s +
          "</button>"
        );
      })
      .join("");
    sec.innerHTML =
      '<div class="episodes-header" id="episodesHeader">' +
      '<span class="seasons-label">Episodes</span>' +
      '<div class="season-chips" role="tablist" aria-label="Seasons">' +
      chips +
      "</div>" +
      "</div>" +
      '<div class="episode-list-wrap" id="episodeGrid"></div>';
    Array.prototype.forEach.call(
      sec.querySelectorAll(".season-chip"),
      function (chip) {
        chip.addEventListener("click", function () {
          var s = parseInt(chip.dataset.season, 10);
          if (s === watchState.s) return;
          watchState.s = s;
          watchState.e = 1;
          Array.prototype.forEach.call(
            sec.querySelectorAll(".season-chip"),
            function (c) {
              var on = c === chip;
              c.classList.toggle("is-active", on);
              c.setAttribute("aria-selected", on ? "true" : "false");
            },
          );
          loadEpisodes(type, id, s);
          var meta = document.getElementById("watchMeta");
          if (meta) {
            meta.innerHTML =
              watchMetaBase + "<span>Season " + s + " · Episode 1</span>";
          }
        });
      },
    );
    loadEpisodes(type, id, watchState.s);
  }

  function loadEpisodes(type, id, s) {
    var grid = document.getElementById("episodeGrid");
    if (!grid) return;
    grid.innerHTML = "";
    for (var i = 0; i < 4; i++) grid.appendChild(episodeSkeleton());
    if (episodeCache[s]) {
      renderEpisodes(type, id, s, episodeCache[s]);
      return;
    }
    API.seasonEpisodes(type, id, s)
      .then(function (data) {
        var eps = (data.episodes || []).sort(function (a, b) {
          return a.episode_number - b.episode_number;
        });
        episodeCache[s] = eps;
        // Guard against a stale response: the user may have switched seasons
        // while this fetch was in flight.
        if (s === watchState.s) renderEpisodes(type, id, s, eps);
      })
      .catch(function () {
        // Don't clobber the grid if the user has already switched seasons.
        if (s !== watchState.s) return;
        grid.innerHTML = "";
        grid.appendChild(emptyState("Episodes could not be loaded."));
      });
  }

  function renderEpisodes(type, id, s, eps) {
    var grid = document.getElementById("episodeGrid");
    if (!grid || s !== watchState.s) return;
    grid.innerHTML = "";
    eps.forEach(function (ep) {
      grid.appendChild(episodeCard(type, id, s, ep));
    });
    registerLazy(grid);
  }

  function episodeCard(type, id, s, ep) {
    var el = document.createElement("button");
    el.type = "button";
    el.className =
      "episode-card" +
      (watchState.s === s && watchState.e === ep.episode_number
        ? " is-active"
        : "");
    el.dataset.ep = ep.episode_number + "|" + s;
    var still = API.still(ep.still_path);
    el.innerHTML =
      '<div class="episode-thumb-wrap">' +
      (still
        ? '<img class="episode-thumb" data-src="' +
          still +
          '" alt="" loading="lazy">'
        : '<div class="episode-thumb episode-ph"><i class="fas fa-film"></i></div>') +
      '<span class="episode-num">E' +
      ep.episode_number +
      "</span>" +
      "</div>" +
      '<div class="episode-body">' +
      '<h3 class="episode-name">' +
      esc(ep.name || "Episode " + ep.episode_number) +
      "</h3>" +
      '<div class="episode-meta">' +
      (ep.runtime ? ep.runtime + " min" : "—") +
      (ep.air_date ? " · " + esc(String(ep.air_date).slice(0, 4)) : "") +
      "</div>" +
      '<p class="episode-overview">' +
      esc(ep.overview || "No overview available.") +
      "</p>" +
      "</div>";
    el.addEventListener("click", function () {
      watchState.s = s;
      watchState.e = ep.episode_number;
      Player.setEpisode(s, ep.episode_number);
      gridActive();
      document.getElementById("watchMeta").innerHTML =
        watchMetaBase +
        "<span>Season " +
        s +
        " · Episode " +
        ep.episode_number +
        "</span>";
      addToHistory(type, id, watchTitle, watchPoster, s, ep.episode_number);
    });
    return el;
  }

  function gridActive() {
    var grid = document.getElementById("episodeGrid");
    if (!grid) return;
    Array.prototype.forEach.call(
      grid.querySelectorAll(".episode-card"),
      function (el) {
        var s = watchState.s;
        var e = watchState.e;
        el.classList.toggle("is-active", el.dataset.ep === e + "|" + s);
      },
    );
  }

  function renderServers() {
    var sec = document.getElementById("serversSection");
    if (!sec) return;
    var providers = Player.providers();
    var current = Player.currentIndex();
    sec.innerHTML = '<h2 class="servers-title">Available Servers</h2>';
    var list = document.createElement("div");
    list.className = "server-list";
    if (!providers.length) {
      var note = document.createElement("span");
      note.className = "panel-note";
      note.innerHTML =
        '<i class="fas fa-circle-info"></i><span>Checking servers...</span>';
      sec.appendChild(note);
      return;
    }
    providers.forEach(function (p, i) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "server-chip" +
        (i === current ? " is-active" : "") +
        (!p.reachable ? " is-offline" : "");
      var icon =
        i === current ? "fa-check" : p.reachable ? "fa-circle-play" : "fa-ban";
      chip.innerHTML = '<i class="fas ' + icon + '"></i>' + esc(p.name);
      if (p.reachable) {
        chip.addEventListener("click", function () {
          Player.switchTo(i);
        });
      }
      list.appendChild(chip);
    });
    sec.appendChild(list);
  }

  function initSearch() {
    var input = document.getElementById("searchInput");
    var panel = document.getElementById("searchPanel");
    var clearBtn = document.getElementById("searchClear");
    var wrap = document.getElementById("searchWrap");
    var debounce = null;
    var items = [];
    var activeIndex = -1;

    function closePanel() {
      panel.hidden = true;
      panel.innerHTML = "";
      items = [];
      activeIndex = -1;
      input.setAttribute("aria-expanded", "false");
    }

    closeSearchFn = closePanel;

    function openPanel() {
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function setActive(i) {
      if (!items.length) return;
      activeIndex = (i + items.length) % items.length;
      items.forEach(function (it, k) {
        it.classList.toggle("is-active", k === activeIndex);
      });
      items[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function footerEl(q) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "panel-footer";
      btn.innerHTML =
        '<span>View all results for "' +
        esc(q) +
        '"</span><i class="fas fa-arrow-right"></i>';
      btn.addEventListener("click", function () {
        closePanel();
        location.hash = "#/search/" + encodeURIComponent(q);
      });
      return btn;
    }

    function renderSuggestions(data, q) {
      if (input.value.trim() !== q) return;
      var results = (data.results || [])
        .filter(function (r) {
          return (
            (r.media_type === "movie" || r.media_type === "tv") &&
            (r.poster_path || r.backdrop_path)
          );
        })
        .slice(0, 6);
      items = [];
      openPanel();
      panel.innerHTML = "";
      if (!results.length) {
        var note = document.createElement("div");
        note.className = "panel-note";
        note.innerHTML =
          '<i class="fas fa-magnifying-glass"></i><span>No matches for "' +
          esc(q) +
          '"</span>';
        panel.appendChild(note);
        panel.appendChild(footerEl(q));
        return;
      }
      var list = document.createElement("div");
      list.className = "search-panel-list";
      results.forEach(function (r) {
        var type = mediaTypeOf(r);
        var img = r.poster_path
          ? API.poster(r.poster_path, "w92")
          : API.backdrop(r.backdrop_path);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suggestion";
        btn.setAttribute("role", "option");
        btn.innerHTML =
          (img
            ? '<img class="suggestion-poster" src="' +
              img +
              '" alt="" loading="lazy">'
            : '<div class="suggestion-poster suggestion-ph"><i class="fas fa-film"></i></div>') +
          '<div class="suggestion-info">' +
          '<span class="suggestion-title">' +
          esc(shortTitle(r)) +
          "</span>" +
          '<span class="suggestion-meta"><span class="suggestion-type">' +
          (type === "tv" ? "TV" : "Movie") +
          "</span><span>" +
          esc(shortYear(r)) +
          "</span></span>" +
          "</div>";
        btn.addEventListener("click", function () {
          closePanel();
          location.hash = "#/title/" + type + "/" + r.id;
        });
        items.push(btn);
        list.appendChild(btn);
      });
      panel.appendChild(list);
      panel.appendChild(footerEl(q));
    }

    input.addEventListener("input", function () {
      var q = input.value.trim();
      clearBtn.classList.toggle("is-visible", q.length > 0);
      clearTimeout(debounce);
      if (q.length < 2) {
        closePanel();
        return;
      }
      debounce = setTimeout(function () {
        openPanel();
        panel.innerHTML =
          '<div class="panel-note"><i class="fas fa-spinner"></i><span>Searching...</span></div>';
        API.searchMulti(q, 1)
          .then(function (data) {
            renderSuggestions(data, q);
          })
          .catch(function () {
            if (input.value.trim() !== q) return;
            panel.innerHTML =
              '<div class="panel-note"><i class="fas fa-triangle-exclamation"></i><span>Search is unavailable right now.</span></div>';
          });
      }, 250);
    });

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (panel.hidden) return;
        setActive(activeIndex + 1);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (panel.hidden) return;
        setActive(activeIndex - 1);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        var q = input.value.trim();
        if (!q) return;
        if (activeIndex >= 0 && items[activeIndex]) {
          items[activeIndex].click();
        } else {
          closePanel();
          location.hash = "#/search/" + encodeURIComponent(q);
        }
      } else if (ev.key === "Escape") {
        closePanel();
      }
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      clearBtn.classList.remove("is-visible");
      closePanel();
      input.focus();
    });

    document.addEventListener("click", function (ev) {
      if (!wrap.contains(ev.target)) closePanel();
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
    renderTitle: renderTitle,
    renderWatch: renderWatch,
    renderWatchlist: renderWatchlist,
    renderHistory: renderHistory,
    captureView: captureView,
    restoreView: restoreView,
    teardown: teardown,
    initSearch: initSearch,
    closeSearch: function () {
      if (closeSearchFn) closeSearchFn();
    },
    toast: toast,
  };
})();
