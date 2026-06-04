# 📺 XD-TV Minimalist IPTV Player

A sleek, modern, and highly performant web-based IPTV player built with Vanilla Web Technologies (HTML, CSS, JS). 

XD-TV is designed to be lightweight and fast, providing an elegant, distraction-free viewing experience for live TV channels across the globe.

---

## ✨ Features

- 🎨 **Premium Aesthetic**: Minimalist, glassmorphic dark-mode UI inspired by modern design trends.
- 📱 **Fully Responsive**: Carefully crafted layouts that look and feel native on both Desktop and Mobile devices.
- ⚡ **HLS Integration**: Natively plays `.m3u8` live streams using [hls.js](https://github.com/video-dev/hls.js) with robust error handling and stream fallbacks.
- ⭐️ **Favorites System**: Star your favorite channels to save them to your browser's local storage for instant access via a dedicated "Favorites" tab.
- 🔄 **Auto-Grouping & Multiple Streams**: Automatically detects duplicate channel names in the data source and merges them, providing a smart "Server Selector" button to switch backup streams if one goes offline.
- 🔊 **Smart Autoplay**: Automatically plays a default channel (e.g., *T Sports HD*) on load, intelligently falling back to muted playback if blocked by strict browser autoplay policies.

## 📡 Data Source

The channels displayed in this player are fetched live in JSON format from the [SHAJON-404/iptv](https://github.com/SHAJON-404/iptv) repository.

## 🚀 Deployment

XD-TV is a completely static application and requires no backend or build step. It can be instantly deployed for free on Vercel, Netlify, or GitHub Pages.

To deploy it yourself:
1. Fork or clone this repository.
2. Import the project into your Vercel Dashboard.
3. Deploy! (No build commands needed).

---
Developed with ❤️ by [Abdullah Al Noman](https://github.com/No-man1234)
