const SHAJON_URL = 'https://raw.githubusercontent.com/SHAJON-404/iptv/main/channels.json';
const IPTV_ORG_CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json';
const IPTV_ORG_STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';

let allChannels = [];
let currentHls = null;
let activeGroup = 'All';
let favorites = JSON.parse(localStorage.getItem('xdtv_favorites') || '[]');

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

async function fetchIptvOrgData() {
    try {
        const [channelsRes, streamsRes] = await Promise.all([
            fetch(IPTV_ORG_CHANNELS_URL),
            fetch(IPTV_ORG_STREAMS_URL)
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
        const [shajonRes, iptvOrgData] = await Promise.all([
            fetch(SHAJON_URL).catch(() => null),
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
        
        allChannels = Object.values(grouped);
        
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
        
        // Autoplay T Sports HD on load
        let defaultChannel = allChannels.find(c => c.name.toLowerCase() === 't sports hd' || c.name.toLowerCase() === 'tsports hd');
        if (!defaultChannel) {
            defaultChannel = allChannels.find(c => c.name.toLowerCase().includes('t sports') || c.name.toLowerCase().includes('tsports'));
        }
        if (defaultChannel) {
            playChannel(defaultChannel, null, false);
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

function setupCategories() {
    const groups = new Set(allChannels.map(c => c.group || 'Uncategorized'));
    const sortedGroups = Array.from(groups).sort();
    
    // "All" button is already in HTML, we just add the rest
    sortedGroups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = group;
        btn.dataset.group = group;
        categoryFiltersEl.appendChild(btn);
    });

    categoryFiltersEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            activeGroup = e.target.dataset.group;
            filterAndRender();
        }
    });
}

function setupSearch() {
    searchInput.addEventListener('input', (e) => {
        filterAndRender();
    });
}

function filterAndRender() {
    const query = searchInput.value.toLowerCase().trim();
    
    let filtered = allChannels;
    
    if (activeGroup === 'Favorites') {
        filtered = filtered.filter(c => favorites.includes(c.id));
    } else if (activeGroup !== 'All') {
        filtered = filtered.filter(c => (c.group || 'Uncategorized') === activeGroup);
    }
    
    if (query) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(query) || 
            (c.group && c.group.toLowerCase().includes(query))
        );
    }
    
    renderChannels(filtered);
}

function renderChannels(channels) {
    if (channels.length === 0) {
        channelsListEl.innerHTML = `
            <div class="loading-state">
                <i data-lucide="search-x" style="width: 32px; height: 32px;"></i>
                <p>No channels found.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const fragment = document.createDocumentFragment();
    
    // Hard limit to 200 channels to prevent browser crashing from iptv-org's massive dataset
    const limit = Math.min(channels.length, 200);
    
    for (let i = 0; i < limit; i++) {
        const channel = channels[i];
        
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.onclick = () => playChannel(channel, card);
        
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
    
    channelsListEl.innerHTML = '';
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
    filterAndRender();
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
            btn.textContent = 'Server ' + (index + 1);
            btn.onclick = () => {
                document.querySelectorAll('.stream-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                playStream(url, autoPlay);
            };
            streamSelector.appendChild(btn);
        });
    } else {
        streamSelector.classList.add('hidden');
    }

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
