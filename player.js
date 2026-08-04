var Player = (function () {
  var type = null;
  var id = null;
  var season = null;
  var episode = null;
  var providers = [];
  var index = -1;
  var frame = null;
  var wrap = null;
  var timer = null;
  var onChange = null;
  var onStatus = null;

  function setStatus(msg, isError) {
    if (onStatus) onStatus(msg, isError);
  }

  function stopWait() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function buildUrls(t, id2, s, e) {
    var list = CONFIG.providers[t === "tv" ? "tv" : "movie"];
    return list.map(function (p) {
      return {
        name: p.name,
        url: t === "tv" ? p.build(id2, s, e) : p.build(id2),
      };
    });
  }

  function check(url) {
    var ctrl = new AbortController();
    var t = setTimeout(function () {
      ctrl.abort();
    }, CONFIG.providerCheckTimeout);
    return fetch(url, { mode: "no-cors", signal: ctrl.signal })
      .then(function () {
        clearTimeout(t);
        return true;
      })
      .catch(function () {
        clearTimeout(t);
        return false;
      });
  }

  function build() {
    var el = document.getElementById("player");
    if (!el) return;
    el.innerHTML =
      '<div class="player-frame-wrap">' +
      '<iframe class="player-frame" id="playerFrame" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen title="Video player" referrerpolicy="origin"></iframe>' +
      '<div class="player-spinner"><i class="fas fa-spinner fa-spin"></i><span>Loading video...</span></div>' +
      "</div>";
    frame = el.querySelector("#playerFrame");
    wrap = el.querySelector(".player-frame-wrap");
  }

  function attempt(i) {
    if (!frame || i < 0 || i >= providers.length) return;
    stopWait();
    index = i;
    var p = providers[i];
    wrap.classList.remove("has-frame");
    if (onChange) onChange(index);
    setStatus("Loading from " + p.name + "...");
    frame.src = p.url;
    var claimed = false;
    timer = setTimeout(function () {
      if (!claimed) next(p);
    }, CONFIG.providerLoadTimeout);
    frame.onload = function () {
      if (!claimed) {
        claimed = true;
        stopWait();
        setStatus("");
        wrap.classList.add("has-frame");
        if (onChange) onChange(index);
      }
    };
    frame.onerror = function () {
      if (!claimed) {
        claimed = true;
        stopWait();
        next(p);
      }
    };
  }

  function next(p) {
    var n = -1;
    for (var k = index + 1; k < providers.length; k++) {
      if (providers[k].reachable) {
        n = k;
        break;
      }
    }
    if (n !== -1) {
      setStatus(p.name + " unavailable. Trying " + providers[n].name + "...");
      attempt(n);
    } else {
      setStatus(
        "No server could load this title. Please try again later.",
        true,
      );
      if (onChange) onChange(index);
    }
  }

  function load(t, id2, s, e) {
    stopWait();
    type = t;
    id = id2;
    season = s;
    episode = e;
    providers = buildUrls(t, id2, s, e);
    index = -1;
    build();
    setStatus("Checking servers...");
    Promise.all(
      providers.map(function (p) {
        return check(p.url).then(function (ok) {
          p.reachable = ok;
        });
      }),
    ).then(function () {
      var start = 0;
      for (var k = 0; k < providers.length; k++) {
        if (providers[k].reachable) {
          start = k;
          break;
        }
      }
      if (onChange) onChange(-1);
      attempt(start);
    });
  }

  function switchTo(i) {
    if (i >= 0 && i < providers.length && providers[i].reachable) {
      attempt(i);
    }
  }

  function setEpisode(s, e) {
    season = s;
    episode = e;
    if (frame) load(type, id, s, e);
  }

  function stop() {
    stopWait();
    if (frame) frame.src = "about:blank";
    var el = document.getElementById("player");
    if (el) el.innerHTML = "";
    frame = null;
    wrap = null;
    providers = [];
    index = -1;
  }

  return {
    load: load,
    switchTo: switchTo,
    setEpisode: setEpisode,
    stop: stop,
    onChange: function (fn) {
      onChange = fn;
    },
    onStatus: function (fn) {
      onStatus = fn;
    },
    providers: function () {
      return providers;
    },
    currentIndex: function () {
      return index;
    },
  };
})();
