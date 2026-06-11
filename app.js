let APP_CONFIG = {
    defaultChannel: "T Sports HD",
    shajonUrl: "https://raw.githubusercontent.com/SHAJON-404/iptv/refs/heads/main/app/data/channels.json",
    iptvOrgChannelsUrl: "https://iptv-org.github.io/api/channels.json",
    iptvOrgStreamsUrl: "https://iptv-org.github.io/api/streams.json"
};

let allChannels = [];
let currentHls = null;
let activeGroup = 'All';
let favorites = JSON.parse(localStorage.getItem('xdtv_favorites') || '[]');
let customChannels = JSON.parse(localStorage.getItem('xdtv_custom_channels') || '[]');

// DOM Elements
const channelsListEl = document.getElementById('channelsList');
const categoryFiltersEl = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');
const videoPlayer = document.getElementById('videoPlayer');
const playerOverlay = document.getElementById('playerOverlay');
const channelInfo = document.getElementById('channelInfo');
const currentChannelLogo = document.getElementById('currentChannelLogo');
const currentChannelName = document.getElementById('currentChannelName');
const currentChannelGroup = document.getElementById('currentChannelGroup');
const mainStarBtn = document.getElementById('mainStarBtn');

let currentPlayingChannelId = null;

async function fetchWithTimeout(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function fetchIptvOrgData() {
    try {
        const [channelsRes, streamsRes] = await Promise.all([
            fetchWithTimeout(APP_CONFIG.iptvOrgChannelsUrl),
            fetchWithTimeout(APP_CONFIG.iptvOrgStreamsUrl)
        ]);
        const channelsData = await channelsRes.json();
        const streamsData = await streamsRes.json();
        
        const channelMap = {};
        channelsData.forEach(c => { channelMap[c.id] = c; });
        
        const merged = [];
        streamsData.forEach(stream => {
            const channel = channelMap[stream.channel];
            if (channel && stream.url) {
                let group = 'Uncategorized';
                if (channel.categories && channel.categories.length > 0) {
                    group = channel.categories[0].charAt(0).toUpperCase() + channel.categories[0].slice(1);
                }
                merged.push({
                    name: channel.name,
                    logo: channel.logo,
                    group: group,
                    url: stream.url
                });
            }
        });
        return merged;
    } catch (e) {
        console.error('Error fetching iptv-org data:', e);
        return [];
    }
}

// Initialize App
async function init() {
    try {
        // Fetch config.json first
        try {
            const configRes = await fetch('config.json');
            if (configRes.ok) {
                APP_CONFIG = await configRes.json();
            }
        } catch (e) {
            console.warn('Failed to load config.json, using defaults.');
        }

        const [shajonRes, iptvOrgData] = await Promise.all([
            fetchWithTimeout(APP_CONFIG.shajonUrl).catch(() => ({ ok: false })),
            fetchIptvOrgData()
        ]);
        
        let shajonData = [];
        if (shajonRes && shajonRes.ok) {
            shajonData = await shajonRes.json();
        }
        
        const combinedData = [...shajonData, ...iptvOrgData];
        
        const grouped = {};
        combinedData.forEach(c => {
            if (!c.url) return;
            const key = c.name.trim().toLowerCase();
            if (!grouped[key]) {
                grouped[key] = {
                    id: key,
                    name: c.name.trim(),
                    logo: c.logo,
                    group: c.group || 'Uncategorized',
                    urls: []
                };
            }
            if (!grouped[key].urls.includes(c.url)) {
                grouped[key].urls.push(c.url);
            }
        });
        
        allChannels = [...customChannels, ...Object.values(grouped)];
        
        allChannels.sort((a, b) => {
            const aGroup = (a.group || '').toLowerCase();
            const bGroup = (b.group || '').toLowerCase();
            
            const aIsBD = aGroup.includes('bangla') || aGroup.includes('bangladeshi');
            const bIsBD = bGroup.includes('bangla') || bGroup.includes('bangladeshi');
            
            const aIsSports = aGroup.includes('sports');
            const bIsSports = bGroup.includes('sports');
            
            const getRank = (isBD, isSports) => {
                if (isBD) return 1;
                if (isSports) return 2;
                return 3;
            };
            
            const aRank = getRank(aIsBD, aIsSports);
            const bRank = getRank(bIsBD, bIsSports);
            
            if (aRank !== bRank) {
                return aRank - bRank;
            }
            
            return a.name.localeCompare(b.name);
        });
        
        setupCategories();
        renderChannels(allChannels);
        setupSearch();
        
        // Autoplay default channel on load
        const targetName = APP_CONFIG.defaultChannel.toLowerCase();
        let defaultChannel = allChannels.find(c => c.name.toLowerCase() === targetName);
        if (!defaultChannel) {
            defaultChannel = allChannels.find(c => c.name.toLowerCase().includes(targetName.split(' ')[0]));
        }
        if (defaultChannel) {
            // true means autoplay will attempt, and fallback to mute if blocked
            playChannel(defaultChannel, null, true);
        }
    } catch (error) {
        console.error('Initialization error:', error);
        channelsListEl.innerHTML = `
            <div class="loading-state">
                <i data-lucide="alert-triangle" style="color: var(--danger); width: 32px; height: 32px;"></i>
                <p style="color: var(--danger)">Failed to load channels.</p>
                <button class="filter-btn" onclick="location.reload()" style="margin-top: 10px;">Retry</button>
            </div>
        `;
        lucide.createIcons();
    }
}

function getCategoryIcon(group) {
    const g = group.toLowerCase();
    if (g === 'all') return 'globe';
    if (g === 'favorites') return 'star';
    if (g.includes('sport')) return 'trophy';
    if (g.includes('news')) return 'newspaper';
    if (g.includes('movie') || g.includes('cinema') || g.includes('film')) return 'film';
    if (g.includes('music')) return 'music';
    if (g.includes('kid') || g.includes('child')) return 'smile';
    if (g.includes('auto') || g.includes('motor')) return 'car';
    if (g.includes('education') || g.includes('science') || g.includes('doc')) return 'book-open';
    if (g.includes('comedy')) return 'laugh';
    if (g.includes('custom')) return 'pen-tool';
    return 'tv';
}

function setupCategories() {
    const groups = new Set(['All', 'Favorites']);
    allChannels.forEach(c => {
        if (c.group) groups.add(c.group);
    });
    
    categoryFiltersEl.innerHTML = '';
    groups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${group === activeGroup ? 'active' : ''}`;
        
        const iconName = getCategoryIcon(group);
        btn.innerHTML = `<i data-lucide="${iconName}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: text-bottom;"></i>${group}`;
        
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeGroup = group;
            filterAndRender();
        };
        categoryFiltersEl.appendChild(btn);
    });
    lucide.createIcons();
}

function setupSearch() {
    // Search
    searchInput.addEventListener('input', () => {
        filterAndRender();
    });

    // Blur search box when interacting with video player to dismiss mobile keyboard
    const blurSearch = () => {
        if (document.activeElement === searchInput) {
            searchInput.blur();
        }
    };
    videoPlayer.addEventListener('touchstart', blurSearch);
    videoPlayer.addEventListener('click', blurSearch);
    videoPlayer.addEventListener('play', blurSearch);

    // Custom Stream Button
    const customStreamBtn = document.getElementById('customStreamBtn');
    if (customStreamBtn) {
        customStreamBtn.onclick = () => {
            const url = prompt("Enter a custom .m3u8 live stream link:");
            if (url && url.trim() !== '') {
                const name = prompt("Enter a name for this channel:", "Custom Stream") || "Custom Stream";
                const customChannel = {
                    id: 'custom-' + Date.now(),
                    name: name,
                    group: 'Custom',
                    logo: '',
                    urls: [url.trim()]
                };
                
                // Save persistently
                customChannels.unshift(customChannel);
                localStorage.setItem('xdtv_custom_channels', JSON.stringify(customChannels));
                
                // Add to current session and play
                allChannels.unshift(customChannel);
                videoPlayer.muted = false; // Reset mute on explicit user interaction
                playChannel(customChannel, null, true);
                filterAndRender();
            }
        };
    }
}

function filterAndRender() {
    const q = searchInput.value.toLowerCase().trim();
    
    let filtered = allChannels;
    
    if (activeGroup === 'Favorites') {
        filtered = filtered.filter(c => favorites.includes(c.id));
    } else if (activeGroup !== 'All') {
        filtered = filtered.filter(c => (c.group || 'Uncategorized') === activeGroup);
    }
    
    if (q) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(q) || 
            (c.group && c.group.toLowerCase().includes(q))
        );
        
        // Custom search sorting: Exact Match > Starts With > Substring
        filtered.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            
            const aExact = nameA === q;
            const bExact = nameB === q;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            const aStarts = nameA.startsWith(q);
            const bStarts = nameB.startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            return 0; // maintain original sorting for ties
        });
    }
    
    renderChannels(filtered);
}

function renderChannels(channels) {
    channelsListEl.innerHTML = '';
    
    if (channels.length === 0) {
        channelsListEl.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                <i data-lucide="frown" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>No channels found.</p>
                <p style="font-size: 0.75rem; margin-top: 8px;">Try adjusting your search or category.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    const fragment = document.createDocumentFragment();
    
    // Hard limit to 200 channels to prevent browser crashing from iptv-org's massive dataset
    const limit = Math.min(channels.length, 200);
    
    for (let i = 0; i < limit; i++) {
        const channel = channels[i];
        
        const card = document.createElement('div');
        card.className = `channel-card ${channel.id === currentPlayingChannelId ? 'active' : ''}`;
        card.dataset.id = channel.id;
        card.onclick = () => {
            videoPlayer.muted = false; // Reset mute on explicit user interaction
            playChannel(channel, card);
        };
        
        const fallbackLogo = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhMWExYWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSI3IiB3aWR0aD0iMjAiIGhlaWdodD0iMTUiIHJ4PSIyIiByeT0iMiI+PC9yZWN0Pjxwb2x5bGluZSBwb2ludHM9IjE3IDIgMTIgNyA3IDIiPjwvcG9seWxpbmU+PC9zdmc+";
        
        const isStarred = favorites.includes(channel.id);
        card.innerHTML = `
            <div class="channel-logo-container">
                <img class="channel-logo" src="${channel.logo || fallbackLogo}" alt="${channel.name}" onerror="this.src='${fallbackLogo}'" loading="lazy">
            </div>
            <div class="channel-info-mini">
                <span class="channel-name">${channel.name}</span>
                <span class="channel-group">${channel.group || 'Uncategorized'}</span>
            </div>
            <button class="star-btn ${isStarred ? 'starred' : ''}" title="Toggle Favorite">
                <i data-lucide="star" style="width: 16px; height: 16px;"></i>
            </button>
        `;
        
        const starBtn = card.querySelector('.star-btn');
        starBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(channel.id);
        };
        
        fragment.appendChild(card);
    }
    
    channelsListEl.appendChild(fragment);
    lucide.createIcons();
}

function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(i => i !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem('xdtv_favorites', JSON.stringify(favorites));
    updateMainStarBtn();
    
    if (activeGroup === 'Favorites') {
        filterAndRender();
    } else {
        // Update DOM without full re-render to preserve scroll position
        document.querySelectorAll(`.channel-card[data-id="${id}"] .star-btn`).forEach(btn => {
            if (favorites.includes(id)) {
                btn.classList.add('starred');
            } else {
                btn.classList.remove('starred');
            }
        });
    }
}

function updateMainStarBtn() {
    if (!currentPlayingChannelId) return;
    if (favorites.includes(currentPlayingChannelId)) {
        mainStarBtn.classList.add('starred');
    } else {
        mainStarBtn.classList.remove('starred');
    }
}

mainStarBtn.onclick = () => {
    if (currentPlayingChannelId) {
        toggleFavorite(currentPlayingChannelId);
    }
};

function playChannel(channel, cardElement, autoPlay = true) {
    currentPlayingChannelId = channel.id;
    updateMainStarBtn();
    
    // Scroll to top on mobile so the player is visible
    if (window.innerWidth <= 768) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Update active UI
    document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('active'));
    if (cardElement) {
        cardElement.classList.add('active');
    }
    
    // Hide overlays
    playerOverlay.classList.add('hidden');
    errorOverlay.classList.add('hidden');

    // Update Info
    channelInfo.classList.remove('hidden');
    currentChannelName.textContent = channel.name;
    currentChannelGroup.textContent = channel.group || 'Uncategorized';
    currentChannelLogo.src = channel.logo || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhMWExYWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSI3IiB3aWR0aD0iMjAiIGhlaWdodD0iMTUiIHJ4PSIyIiByeT0iMiI+PC9yZWN0Pjxwb2x5bGluZSBwb2ludHM9IjE3IDIgMTIgNyA3IDIiPjwvcG9seWxpbmU+PC9zdmc+";

    const streamSelector = document.getElementById('streamSelector');
    streamSelector.innerHTML = '';
    
    if (channel.urls.length > 1) {
        streamSelector.classList.remove('hidden');
        channel.urls.forEach((url, index) => {
            const btn = document.createElement('button');
            btn.className = 'stream-btn' + (index === 0 ? ' active' : '');
            btn.innerHTML = `<i data-lucide="server" style="width: 12px; height: 12px; margin-right: 4px; display: inline-block; vertical-align: text-bottom;"></i>Server ` + (index + 1);
            btn.onclick = () => {
                document.querySelectorAll('.stream-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                videoPlayer.muted = false; // Reset mute on explicit user interaction
                playStream(url, autoPlay);
            };
            streamSelector.appendChild(btn);
        });
    } else {
        streamSelector.classList.add('hidden');
    }

    lucide.createIcons();
    playStream(channel.urls[0], autoPlay);
}

function playStream(url, autoPlay = true) {
    if (Hls.isSupported()) {
        if (currentHls) {
            currentHls.destroy();
        }
        
        currentHls = new Hls({
            maxBufferLength: 30,
            enableWorker: true,
        });
        
        currentHls.loadSource(url);
        currentHls.attachMedia(videoPlayer);
        
        currentHls.on(Hls.Events.MANIFEST_PARSED, function () {
            if (autoPlay) {
                videoPlayer.play().catch(e => {
                    console.warn('Autoplay with sound prevented by browser. Falling back to muted autoplay.', e);
                    videoPlayer.muted = true;
                    videoPlayer.play().catch(err => console.error('Autoplay totally prevented:', err));
                });
            }
        });

        currentHls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Network error');
                        currentHls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Media error');
                        currentHls.recoverMediaError();
                        break;
                    default:
                        showError();
                        currentHls.destroy();
                        break;
                }
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native support
        videoPlayer.src = url;
        videoPlayer.addEventListener('loadedmetadata', function () {
            if (autoPlay) {
                videoPlayer.play().catch(e => {
                    console.warn('Autoplay with sound prevented by browser. Falling back to muted autoplay.', e);
                    videoPlayer.muted = true;
                    videoPlayer.play().catch(err => console.error('Autoplay totally prevented:', err));
                });
            }
        });
        videoPlayer.addEventListener('error', showError);
    } else {
        alert('Your browser does not support HLS streaming.');
    }
}

function showError() {
    errorOverlay.classList.remove('hidden');
}

// Start
document.addEventListener('DOMContentLoaded', init);
