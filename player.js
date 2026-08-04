var Player = (function () {
  var providerIndex = 0;
  var reachable = [];
  var currentType = null;
  var currentId = null;
  var currentSeason = null;
  var currentEpisode = null;
  var timer = null;
  var frame = null;
  var statusEl = null;
  var label = null;
  var container = null;

  function buildUrls(type, id, s, e) {
    var list = CONFIG.providers[type === "tv" ? "tv" : "movie"];
    return list.map(function (p) {
      return {
        name: p.name,
        url: type === "tv" ? p.build(id, s, e) : p.build(id),
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

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function stopWait() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function tryProvider() {
    if (!frame || providerIndex >= reachable.length) return;
    stopWait();
    var entry = reachable[providerIndex];
    providerIndex += 1;
    setStatus("Loading from " + entry.name + "...");
    frame.src = entry.url;
    if (label) label.textContent = entry.name;
    var claimed = false;
    timer = setTimeout(function () {
      if (!claimed) {
        claimNext(
          "Server " + entry.name + " did not respond. Trying another...",
        );
      }
    }, CONFIG.providerLoadTimeout);
    frame.onload = function () {
      if (!claimed) {
        claimed = true;
        stopWait();
        setStatus("");
        container.classList.add("has-frame");
        if (label) label.classList.remove("is-switching");
      }
    };
    function claimNext(msg) {
      if (claimed) return;
      claimed = true;
      stopWait();
      if (providerIndex < reachable.length) {
        setStatus(msg);
        tryProvider();
      } else {
        setStatus("All servers are unavailable right now.");
        UI.toast("No server could load this title. Please try again later.");
      }
    }
    frame.onerror = function () {
      claimNext("Server " + entry.name + " failed. Trying another...");
    };
  }

  function load(type, id, s, e) {
    currentType = type;
    currentId = id;
    currentSeason = s;
    currentEpisode = e;
    providerIndex = 0;
    reachable = [];
    container = document.getElementById("player");
    if (!container) return;
    container.hidden = false;
    container.innerHTML =
      '<div class="player-bar">' +
      '<span class="player-status" id="playerStatus">Checking servers...</span>' +
      '<div class="player-server">' +
      "<span>Server</span>" +
      '<span class="player-server-name" id="serverName">-</span>' +
      '<button class="btn btn-small" id="switchServer" title="Switch server"><i class="fas fa-repeat"></i> Switch</button>' +
      "</div>" +
      "</div>" +
      '<div class="player-frame-wrap">' +
      '<iframe class="player-frame" id="playerFrame" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen title="Video player"></iframe>' +
      '<div class="player-spinner" id="playerSpinner"><i class="fas fa-spinner fa-spin"></i><span>Contacting servers...</span></div>' +
      "</div>";
    frame = document.getElementById("playerFrame");
    statusEl = document.getElementById("playerStatus");
    label = document.getElementById("serverName");
    document
      .getElementById("switchServer")
      .addEventListener("click", function () {
        if (providerIndex < reachable.length) {
          setStatus("Switching server...");
          label.classList.add("is-switching");
          tryProvider();
        } else {
          setStatus("No more servers to try.");
        }
      });

    var urls = buildUrls(type, id, s, e);
    setStatus("Checking server availability...");
    Promise.all(
      urls.map(function (u) {
        return check(u.url).then(function (ok) {
          return ok ? u : null;
        });
      }),
    ).then(function (results) {
      reachable = results.filter(Boolean);
      if (reachable.length === 0) {
        setStatus("Rechecking servers...");
        reachable = urls;
      }
      tryProvider();
    });
  }

  function setEpisode(s, e) {
    currentSeason = s;
    currentEpisode = e;
    if (container && !container.hidden) {
      load(currentType, currentId, s, e);
    }
  }

  function stop() {
    stopWait();
    if (frame) frame.src = "about:blank";
    if (container) {
      container.hidden = true;
      container.innerHTML = "";
    }
    frame = null;
    container = null;
    statusEl = null;
    label = null;
    providerIndex = 0;
    reachable = [];
  }

  return {
    load: load,
    setEpisode: setEpisode,
    stop: stop,
  };
})();
