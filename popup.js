const folderList = document.getElementById('folderList');
const createFolderBtn = document.getElementById('createFolderBtn');
const folderContent = document.getElementById('folderContent');
const folderTitle = document.getElementById('folderTitle');
const addChannelBtn = document.getElementById('addChannelBtn');
const renameFolderBtn = document.getElementById('renameFolderBtn');
const deleteFolderBtn = document.getElementById('deleteFolderBtn');
const channelList = document.getElementById('channelList');
const videoList = document.getElementById('videoList');
const updateVideosBtn = document.getElementById('updateVideosBtn');

let folders = {};
let activeFolder = null;
let channelNames = {};

const API_KEY = 'YOUR_API_KEY';
updateVideosBtn.onclick = fetchVideos;

function saveFolders() {
    chrome.storage.local.set({ folders, channelNames });
}

function loadFolders() {
    chrome.storage.local.get(['folders', 'channelNames'], (data) => {
        folders = data.folders || {};
        channelNames = data.channelNames || {};
        renderFolders();
    });
}

function renderFolders() {
    folderList.innerHTML = '';
    for (const folderName in folders) {
        const folderItem = document.createElement('li');
        folderItem.textContent = folderName;
        folderItem.onclick = () => openFolder(folderName);
        folderList.appendChild(folderItem);
    }
}

function openFolder(folderName) {
    activeFolder = folderName;
    folderTitle.textContent = folderName;
    folderContent.style.display = 'block';
    renderChannels();
    fetchVideos();
}

async function fetchChannelName(channelId) {
    if (channelNames[channelId]) return channelNames[channelId];

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${API_KEY}`
        );
        const data = await response.json();
        if (data.items[0]?.snippet?.title) {
            channelNames[channelId] = data.items[0].snippet.title;
            saveFolders();
            return channelNames[channelId];
        }
    } catch (error) {
        console.error('Error fetching channel name:', error);
    }
    return channelId;
}

async function renderChannels() {
    channelList.innerHTML = '';
    const channels = folders[activeFolder] || [];

    for (let i = 0; i < channels.length; i++) {
        const channelId = channels[i];
        const channelItem = document.createElement('li');

        channelItem.textContent = 'Loading...';

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Remove';
        deleteBtn.onclick = () => {
            channels.splice(i, 1);
            saveFolders();
            renderChannels();
        };

        channelItem.textContent = await fetchChannelName(channelId);
        channelItem.appendChild(deleteBtn);
        channelList.appendChild(channelItem);
    }
}

function fetchVideos() {
    videoList.innerHTML = '<li>Loading...</li>';
    const channels = folders[activeFolder] || [];

    const promises = channels.map((channelId) => {
        const videosUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=5`;
        return fetch(videosUrl).then((response) => response.json());
    });

    Promise.all(promises)
        .then((results) => {
            videoList.innerHTML = '';
            let allVideos = [];

            results.forEach((result) => {
                if (result.items) {
                    result.items.forEach((video) => {
                        if (video.id.videoId) {
                            allVideos.push({
                                title: video.snippet.title,
                                videoId: video.id.videoId,
                                publishDate: video.snippet.publishedAt,
                                channelTitle: video.snippet.channelTitle
                            });
                        }
                    });
                }
            });

            allVideos.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

            if (allVideos.length > 0) {
                allVideos.forEach((video) => {
                    const videoItem = document.createElement('li');
                    videoItem.textContent = `${video.channelTitle}: ${video.title} (${new Date(video.publishDate).toLocaleString()})`;
                    videoItem.onclick = () => {
                        window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank');
                    };
                    videoList.appendChild(videoItem);
                });
            } else {
                videoList.innerHTML = '<li>No videos found.</li>';
            }
        })
        .catch((error) => {
            console.error('Error fetching videos:', error);
            videoList.innerHTML = '<li>Error loading videos. Try again.</li>';
        });
}

createFolderBtn.onclick = () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
        folders[folderName] = [];
        saveFolders();
        renderFolders();
    }
};

addChannelBtn.onclick = () => {
    const channelUrl = prompt('Enter YouTube channel ID:');
    if (channelUrl) {
        const channelId = channelUrl.split('/').pop();
        folders[activeFolder].push(channelId);
        saveFolders();
        renderChannels();
    }
};

renameFolderBtn.onclick = () => {
    const newName = prompt('Enter new folder name:');
    if (newName) {
        folders[newName] = folders[activeFolder];
        delete folders[activeFolder];
        activeFolder = newName;
        saveFolders();
        renderFolders();
        openFolder(newName);
    }
};

deleteFolderBtn.onclick = () => {
    if (confirm(`Delete folder "${activeFolder}"?`)) {
        delete folders[activeFolder];
        activeFolder = null;
        folderContent.style.display = 'none';
        saveFolders();
        renderFolders();
    }
};

loadFolders();