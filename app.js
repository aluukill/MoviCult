(function () {
  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  var searchTimer = null;
  var lastQuery = "";
  var cache = {};

  function routeKey(route) {
    if (route.name === "home") return "home";
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
    if (parts[0] === "search" && parts[1])
      return {
        name: "search",
        query: decodeURIComponent(parts.slice(1).join("/")),
      };
    if (parts[0] === "movie" && parts[1])
      return { name: "watch", type: "movie", id: parts[1] };
    if (parts[0] === "tv" && parts[1])
      return { name: "watch", type: "tv", id: parts[1] };
    return { name: "home" };
  }

  function navName(route) {
    if (route.name === "home") return "home";
    if (route.name === "movies") return "movies";
    if (route.name === "series") return "series";
    return "";
  }

  function setActive(route) {
    var active = navName(route);
    document.querySelectorAll(".nav-link").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.view === active);
    });
  }

  function syncSearch(value) {
    searchInput.value = value || "";
    searchClear.classList.toggle("is-visible", (value || "").length > 0);
    lastQuery = value || "";
  }

  function render(route) {
    Player.stop();
    setActive(route);
    var key = routeKey(route);
    var cached =
      key &&
      cache[key] &&
      !(
        route.name === "home" && cache[key].html.indexOf('class="hero"') === -1
      );
    if (cached) {
      UI.restoreView(cache[key]);
    } else {
      if (route.name === "home") {
        UI.renderHome();
      } else if (route.name === "movies") {
        UI.openGrid("movies", "Movies", "movie", function (p) {
          return API.popular("movie", p);
        });
      } else if (route.name === "series") {
        UI.openGrid("series", "TV Shows", "tv", function (p) {
          return API.popular("tv", p);
        });
      } else if (route.name === "search") {
        UI.renderSearch(route.query);
      } else if (route.name === "watch") {
        UI.renderWatch(route.type, route.id);
      }
      if (key) cache[key] = UI.captureView();
    }
    syncSearch(route.name === "search" ? route.query : "");
    window.scrollTo(0, 0);
  }

  searchInput.addEventListener("input", function () {
    var q = searchInput.value;
    searchClear.classList.toggle("is-visible", q.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var trimmed = q.trim();
      if (trimmed && trimmed !== lastQuery) {
        lastQuery = trimmed;
        if (location.hash !== "#/search/" + encodeURIComponent(trimmed)) {
          location.hash = "#/search/" + encodeURIComponent(trimmed);
        }
      }
    }, 450);
  });

  searchClear.addEventListener("click", function () {
    syncSearch("");
    location.hash = "#/";
    searchInput.focus();
  });

  document.querySelectorAll(".nav-link").forEach(function (btn) {
    btn.addEventListener("click", function () {
      location.hash = "#/" + btn.dataset.view;
    });
  });

  document.getElementById("brandButton").addEventListener("click", function () {
    location.hash = "#/";
  });

  window.addEventListener("hashchange", function () {
    searchInput.blur();
    render(parseHash());
  });

  render(parseHash());
})();
