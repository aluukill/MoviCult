var CONFIG = {
  tmdbKey: "42af8b2606665c01eef3d8f1b9d79840",
  tmdbBase: "https://api.themoviedb.org/3",
  imageBase: "https://image.tmdb.org/t/p",
  posterWidth: "w500",
  backdropWidth: "w1280",
  language: "en-US",
  pageSize: 20,
  providerCheckTimeout: 6000,
  providerLoadTimeout: 10000,
  providers: {
    movie: [
      {
        name: "2embed",
        build: function (id) {
          return "https://www.2embed.stream/embed/movie/" + id;
        },
      },
      {
        name: "apiplayer",
        build: function (id) {
          return "https://apiplayer.ru/embed/movie/" + id;
        },
      },
      {
        name: "multiembed",
        build: function (id) {
          return "https://multiembed.mov/?video_id=" + id + "&tmdb=1";
        },
      },
      {
        name: "vidsrc",
        build: function (id) {
          return "https://vidsrc.xyz/embed/movie/" + id;
        },
      },
    ],
    tv: [
      {
        name: "2embed",
        build: function (id, s, e) {
          return "https://www.2embed.stream/embed/tv/" + id + "/" + s + "/" + e;
        },
      },
      {
        name: "apiplayer",
        build: function (id, s, e) {
          return "https://apiplayer.ru/embed/tv/" + id + "/" + s + "/" + e;
        },
      },
      {
        name: "multiembed",
        build: function (id, s, e) {
          return (
            "https://multiembed.mov/?video_id=" +
            id +
            "&tmdb=1&s=" +
            s +
            "&e=" +
            e
          );
        },
      },
      {
        name: "vidsrc",
        build: function (id, s, e) {
          return "https://vidsrc.xyz/embed/tv/" + id + "/" + s + "/" + e;
        },
      },
    ],
  },
};
