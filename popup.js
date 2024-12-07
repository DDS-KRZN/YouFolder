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

const API_KEY = 'YOUR_API_KEY';
updateVideosBtn.onclick = fetchVideos;

function saveFolders() {
    chrome.storage.local.set({ folders });
}

function loadFolders() {
    chrome.storage.local.get('folders', (data) => {
        folders = data.folders || {};
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

function renderChannels() {
    channelList.innerHTML = '';
    const channels = folders[activeFolder] || [];
    channels.forEach((channel, index) => {
        const channelItem = document.createElement('li');
        channelItem.textContent = channel;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Remove';
        deleteBtn.onclick = () => {
            channels.splice(index, 1);
            saveFolders();
            renderChannels();
        };
        channelItem.appendChild(deleteBtn);
        channelList.appendChild(channelItem);
    });
}

function fetchVideos() {
    videoList.innerHTML = '<li>Loading...</li>'; // Indicate loading state
    const channels = folders[activeFolder] || [];

    const promises = channels.map((channelUrl) => {
        // Extract username or channel ID
        const isUsername = channelUrl.includes('/@');
        const identifier = isUsername
            ? channelUrl.split('/@')[1] // Extract username
            : channelUrl.split('/').pop(); // Extract channel ID

        // Resolve to channel ID if necessary
        const url = isUsername
            ? `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${identifier}&key=${API_KEY}`
            : `https://www.googleapis.com/youtube/v3/channels?part=id&id=${identifier}&key=${API_KEY}`;

        return fetch(url)
            .then((response) => response.json())
            .then((data) => {
                const channelId = isUsername
                    ? data.items[0]?.id // Resolve from username to channel ID
                    : identifier; // Use provided channel ID

                if (!channelId) throw new Error(`Invalid channel: ${channelUrl}`);

                // Fetch recent videos for the resolved channel ID
                const videosUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=5`;
                return fetch(videosUrl).then((response) => response.json());
            });
    });

    Promise.all(promises)
        .then((results) => {
            videoList.innerHTML = ''; // Clear loading state
            let allVideos = [];

            results.forEach((result) => {
                if (result.items) {
                    result.items.forEach((video) => {
                        if (video.id.videoId) {
                            allVideos.push({
                                title: video.snippet.title,
                                videoId: video.id.videoId,
                                publishDate: video.snippet.publishedAt
                            });
                        }
                    });
                }
            });

            // Sort all videos by publish date (newest first)
            allVideos.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

            if (allVideos.length > 0) {
                allVideos.forEach((video) => {
                    const videoItem = document.createElement('li');
                    videoItem.textContent = `${video.title} (${new Date(video.publishDate).toLocaleString()})`;
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
        folders[activeFolder].push(channelUrl);
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
