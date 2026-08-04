var API = (function () {
  var key = CONFIG.tmdbKey;
  var base = CONFIG.tmdbBase;

  function fetchJson(path, params) {
    var query = new URLSearchParams(params || {});
    query.set("api_key", key);
    query.set("language", CONFIG.language);
    var url = base + path + "?" + query.toString();
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("TMDB error " + res.status);
      return res.json();
    });
  }

  function poster(p, size) {
    if (!p)
      return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    return CONFIG.imageBase + "/" + (size || CONFIG.posterWidth) + p;
  }

  function backdrop(p) {
    if (!p) return null;
    return CONFIG.imageBase + "/" + CONFIG.backdropWidth + p;
  }

  function profile(p) {
    if (!p) return null;
    return CONFIG.imageBase + "/w185" + p;
  }

  function still(p) {
    if (!p) return null;
    return CONFIG.imageBase + "/w300" + p;
  }

  function genreMap(list) {
    var map = {};
    (list || []).forEach(function (g) {
      map[g.id] = g.name;
    });
    return map;
  }

  function genreNames(ids, map) {
    return (ids || [])
      .map(function (id) {
        return map[id];
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  function genres(mediaType) {
    return fetchJson("/genre/" + mediaType + "/list");
  }

  function trending(mediaType, page) {
    return fetchJson("/trending/" + mediaType + "/week", { page: page || 1 });
  }

  function popular(mediaType, page) {
    return fetchJson("/" + mediaType + "/popular", { page: page || 1 });
  }

  function topRated(mediaType, page) {
    return fetchJson("/" + mediaType + "/top_rated", { page: page || 1 });
  }

  function searchMulti(query, page) {
    return fetchJson("/search/multi", { query: query, page: page || 1 });
  }

  function details(mediaType, id) {
    return fetchJson("/" + mediaType + "/" + id, {
      append_to_response: "videos,credits",
    });
  }

  function similar(mediaType, id, page) {
    return fetchJson("/" + mediaType + "/" + id + "/similar", {
      page: page || 1,
    });
  }

  function collection(id, page) {
    return fetchJson("/collection/" + id, { page: page || 1 });
  }

  function seasonEpisodes(mediaType, id, season) {
    return fetchJson("/" + mediaType + "/" + id + "/season/" + season);
  }

  return {
    fetchJson: fetchJson,
    poster: poster,
    backdrop: backdrop,
    profile: profile,
    still: still,
    genreMap: genreMap,
    genreNames: genreNames,
    genres: genres,
    trending: trending,
    popular: popular,
    topRated: topRated,
    searchMulti: searchMulti,
    details: details,
    similar: similar,
    collection: collection,
    seasonEpisodes: seasonEpisodes,
  };
})();
