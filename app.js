(function () {
  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  var hamburger = document.getElementById("hamburger");
  var mobileNav = document.getElementById("mobileNav");
  var cache = {};

  function routeKey(route) {
    if (route.name === "movies") return "movies";
    if (route.name === "series") return "series";
    if (route.name === "search") return "search:" + route.query;
    return null;
  }

  function parseHash() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts.length === 0) return { name: "home" };
    if (parts[0] === "movies") return { name: "movies" };
    if (parts[0] === "series") return { name: "series" };
    if (parts[0] === "watchlist") return { name: "watchlist" };
    if (parts[0] === "history") return { name: "history" };
    if (parts[0] === "search" && parts[1]) return { name: "search", query: decodeURIComponent(parts.slice(1).join("/")) };
    if (parts[0] === "title" && parts[1] && parts[2]) return { name: "title", type: parts[1], id: parts[2] };
    if (parts[0] === "watch" && parts[1] && parts[2]) {
      return {
        name: "watch",
        type: parts[1],
        id: parts[2],
        season: parts[3] ? parseInt(parts[3], 10) : 1,
        episode: parts[4] ? parseInt(parts[4], 10) : 1
      };
    }
    return { name: "home" };
  }

  function navName(route) {
    if (route.name === "home") return "home";
    if (route.name === "movies") return "movies";
    if (route.name === "series") return "series";
    if (route.name === "watchlist") return "watchlist";
    if (route.name === "history") return "history";
    return "";
  }

  function setActive(route) {
    var active = navName(route);
    document.querySelectorAll(".nav-link, .mobile-link").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.view === active);
    });
  }

  function setMenu(open) {
    hamburger.classList.toggle("is-open", open);
    hamburger.setAttribute("aria-expanded", String(open));
    hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileNav.classList.toggle("is-open", open);
  }

  function render(route) {
    UI.closeSearch();
    setMenu(false);
    Player.stop();
    UI.teardown();
    setActive(route);
    var key = routeKey(route);
    if (key && cache[key]) {
      UI.restoreView(cache[key]);
    } else {
      if (route.name === "home") {
        UI.renderHome();
      } else if (route.name === "movies") {
        UI.openGrid("movies", "Movies", "movie", function (p) { return API.popular("movie", p); }, "Browse popular movies from around the world.");
      } else if (route.name === "series") {
        UI.openGrid("series", "TV Shows", "tv", function (p) { return API.popular("tv", p); }, "Browse popular TV shows and series.");
      } else if (route.name === "watchlist") {
        UI.renderWatchlist();
      } else if (route.name === "history") {
        UI.renderHistory();
      } else if (route.name === "search") {
        UI.renderSearch(route.query);
      } else if (route.name === "title") {
        UI.renderTitle(route.type, route.id);
      } else if (route.name === "watch") {
        UI.renderWatch(route.type, route.id, route.season, route.episode);
      }
      if (key) cache[key] = UI.captureView();
    }
    if (route.name === "search") {
      searchInput.value = route.query;
      searchClear.classList.add("is-visible");
    } else {
      searchInput.value = "";
      searchClear.classList.remove("is-visible");
    }
    window.scrollTo(0, 0);
    viewRoot.focus({ preventScroll: true });
  }

  hamburger.addEventListener("click", function () {
    setMenu(!mobileNav.classList.contains("is-open"));
  });

  document.addEventListener("click", function (ev) {
    if (!mobileNav.classList.contains("is-open")) return;
    if (!mobileNav.contains(ev.target) && !hamburger.contains(ev.target)) setMenu(false);
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      if (mobileNav.classList.contains("is-open")) setMenu(false);
      UI.closeSearch();
    }
  });

  document.querySelectorAll(".nav-link, .mobile-link").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setMenu(false);
      location.hash = "#/" + btn.dataset.view;
    });
  });

  document.getElementById("brandButton").addEventListener("click", function () {
    setMenu(false);
    location.hash = "#/";
  });

  window.addEventListener("hashchange", function () {
    searchInput.blur();
    render(parseHash());
  });

  UI.initSearch();
  render(parseHash());
})();