# MoviCult

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/MoviCult/releases)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![TMDB API](https://img.shields.io/badge/TMDB_API-01B4E4?logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org/documentation/api)
[![Font Awesome](https://img.shields.io/badge/Font_Awesome-339AF0?logo=fontawesome&logoColor=white)](https://fontawesome.com/)
[![Google Fonts](https://img.shields.io/badge/Google_Fonts-4285F4?logo=googlefonts&logoColor=white)](https://fonts.google.com/)

> **MoviCult** — A modern, responsive movie and TV show streaming web application built with vanilla JavaScript. Browse trending titles, search content, watch trailers, and stream with reliable multi-server playback.

---

## 📸 Screenshot

![MoviCult Screenshot](screenshot.png)

---

## ✨ Features

- **🏠 Home Dashboard** — Trending movies & TV shows with interactive hero carousel
- **🎬 Browse Movies & TV Shows** — Paginated grids with infinite scroll, sorted by popularity and ratings
- **🔍 Real-time Search** — Instant suggestions with debounced TMDB multi-search
- **📺 Title Details** — Comprehensive info: cast, genres, runtime, trailers, similar titles, collections
- **▶️ Multi-Server Player** — Automatic fallback across 4+ streaming providers (2embed, apiplayer, multiembed, vidsrc)
- **📱 Fully Responsive** — Mobile-first design: 3-column grid on mobile, adaptive layouts up to 1440px
- **⌨️ Keyboard Accessible** — Full keyboard navigation, ARIA labels, focus management
- **🎨 Modern UI** — Dark theme, smooth animations, skeleton loaders, shimmer effects
- **⚡ Performance** — Lazy-loaded images, intersection observers, view caching, DNS prefetch
- **🔗 SEO Ready** — Semantic HTML, Open Graph/Twitter cards, JSON-LD structured data, sitemap.xml

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Core** | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| **Styling** | CSS Custom Properties, Flexbox, CSS Grid, Inter font |
| **Icons** | Font Awesome 6.5 |
| **API** | [TMDB (The Movie Database)](https://www.themoviedb.org/documentation/api) |
| **Streaming Providers** | 2embed, apiplayer, multiembed, vidsrc |
| **Deployment** | Vercel / Netlify / GitHub Pages (static hosting) |

---

## 📦 Installation

### Prerequisites

- A modern web browser (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+)
- **TMDB API Key** — Get one free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/MoviCult.git
cd MoviCult

# Configure your TMDB API key
# Edit config.js and replace the tmdbKey value
```

**config.js**
```javascript
var CONFIG = {
  tmdbKey: "YOUR_TMDB_API_KEY_HERE",  // ← Replace with your key
  tmdbBase: "https://api.themoviedb.org/3",
  imageBase: "https://image.tmdb.org/t/p",
  posterWidth: "w500",
  backdropWidth: "w1280",
  language: "en-US",
  pageSize: 20,
  providerCheckTimeout: 6000,
  providerLoadTimeout: 10000,
  providers: { /* ... */ }
};
```

### Run Locally

Since this is a static site, serve it with any HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (http-server)
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

---

## 🚀 Usage

### Navigation

| Route | Description |
|-------|-------------|
| `#/` | Home — Trending carousel + categorized rows |
| `#/movies` | All movies grid (popular) |
| `#/series` | All TV shows grid (popular) |
| `#/search/{query}` | Search results |
| `#/title/{type}/{id}` | Title details (cast, trailer, similar) |
| `#/watch/{type}/{id}[/{season}/{episode}]` | Video player |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close mobile menu / search panel |
| `Tab` | Navigate focusable elements |
| `Enter` / `Space` | Activate focused card/button |
| `←` / `→` | Hero carousel navigation |
| `↑` / `↓` | Search suggestions / dropdown navigation |

---

## 📁 Project Structure

```
MoviCult/
├── index.html          # Main HTML entry point
├── app.js              # Routing, navigation, app bootstrap
├── views.js            # UI rendering, components, state management
├── player.js           # Video player, provider management, fallback logic
├── api.js              # TMDB API wrapper, image helpers
├── config.js           # Configuration (API keys, providers, constants)
├── styles.css          # Complete stylesheet (CSS custom properties, responsive)
├── logo.png            # App logo / favicon
├── screenshot.png      # Preview screenshot
├── sitemap.xml         # SEO sitemap
├── robots.txt          # Crawler directives
└── README.md           # This file
```

---

## ⚙️ Configuration

### Streaming Providers (`config.js`)

Add, remove, or reorder providers in the `providers` object. Each provider needs a `name` and a `build` function returning the embed URL.

```javascript
providers: {
  movie: [
    { name: "Custom", build: (id) => `https://custom.com/movie/${id}` }
  ],
  tv: [
    { name: "Custom", build: (id, s, e) => `https://custom.com/tv/${id}/${s}/${e}` }
  ]
}
```

### Timeouts

| Constant | Default | Description |
|----------|---------|-------------|
| `providerCheckTimeout` | 6000ms | Max time to verify provider reachability |
| `providerLoadTimeout` | 10000ms | Max time to wait for iframe load before fallback |

---

## 🔒 Security & Privacy

- **No user data collected** — No authentication, no tracking, no cookies
- **Client-side only** — All API calls made directly from browser to TMDB
- **Referrer policy** — `origin` on player iframes
- **CSP compatible** — No inline scripts/styles (except JSON-LD)
- **HTTPS enforced** — All external resources loaded over HTTPS

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

```
MIT License

Copyright (c) 2024 MoviCult

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 🙏 Acknowledgments

- [The Movie Database (TMDB)](https://www.themoviedb.org/) for the comprehensive movie/TV API
- [Font Awesome](https://fontawesome.com/) for the icon set
- [Inter Font](https://rsms.me/inter/) by Rasmus Andersson
- Streaming providers: 2embed, apiplayer, multiembed, vidsrc

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/MoviCult/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/MoviCult/discussions)

---

<p align="center">Made with ❤️ for movie lovers everywhere</p>