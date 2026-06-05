const REPO_OWNER = 'No-man1234';
const REPO_NAME = 'XD-tv';
const FILE_PATH = 'config.json';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

let currentSha = null;
let githubPat = '';

const authSection = document.getElementById('authSection');
const configForm = document.getElementById('configForm');
const alertBox = document.getElementById('alertBox');

const inputs = {
    defaultChannel: document.getElementById('cfgDefaultChannel'),
    shajonUrl: document.getElementById('cfgShajonUrl'),
    iptvOrgChannelsUrl: document.getElementById('cfgIptvChannelsUrl'),
    iptvOrgStreamsUrl: document.getElementById('cfgIptvStreamsUrl')
};

function showAlert(message, isError = false) {
    alertBox.textContent = message;
    alertBox.className = `alert ${isError ? 'error' : 'success'}`;
}

async function authenticate() {
    githubPat = document.getElementById('patInput').value.trim();
    if (!githubPat) {
        showAlert('Please enter a GitHub Token.', true);
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            headers: {
                'Authorization': `Bearer ${githubPat}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403 || response.status === 404) {
                throw new Error('Invalid Token or insufficient permissions.');
            }
            throw new Error('Failed to fetch config.');
        }
        
        const data = await response.json();
        currentSha = data.sha;
        
        // Decode base64 content
        const decodedContent = decodeURIComponent(escape(window.atob(data.content)));
        const config = JSON.parse(decodedContent);
        
        // Populate Form
        inputs.defaultChannel.value = config.defaultChannel || '';
        inputs.shajonUrl.value = config.shajonUrl || '';
        inputs.iptvOrgChannelsUrl.value = config.iptvOrgChannelsUrl || '';
        inputs.iptvOrgStreamsUrl.value = config.iptvOrgStreamsUrl || '';
        
        authSection.style.display = 'none';
        configForm.style.display = 'block';
        showAlert('Authenticated successfully! Loaded current config.');
        
    } catch (err) {
        showAlert(err.message, true);
    }
}

async function saveConfig() {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 18px; height: 18px; display: inline-block; vertical-align: text-bottom; margin-right: 8px; animation: spin 1s linear infinite;"></i>Saving...';
    lucide.createIcons();
    
    const newConfig = {
        defaultChannel: inputs.defaultChannel.value.trim(),
        shajonUrl: inputs.shajonUrl.value.trim(),
        iptvOrgChannelsUrl: inputs.iptvOrgChannelsUrl.value.trim(),
        iptvOrgStreamsUrl: inputs.iptvOrgStreamsUrl.value.trim()
    };
    
    const jsonString = JSON.stringify(newConfig, null, 2);
    const encodedContent = window.btoa(unescape(encodeURIComponent(jsonString)));
    
    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubPat}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'admin: update config.json via Admin Panel',
                content: encodedContent,
                sha: currentSha
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save changes. Check your token permissions.');
        }
        
        const data = await response.json();
        currentSha = data.content.sha; // Update SHA for subsequent saves
        
        showAlert('Saved successfully! Vercel is deploying the changes now (takes ~30s).');
    } catch (err) {
        showAlert(err.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="save" style="width: 18px; height: 18px; display: inline-block; vertical-align: text-bottom; margin-right: 8px;"></i>Save & Deploy';
        lucide.createIcons();
    }
}

document.getElementById('loginBtn').addEventListener('click', authenticate);
document.getElementById('saveBtn').addEventListener('click', saveConfig);
