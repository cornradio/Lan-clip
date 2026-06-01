// Default settings and initialization
document.documentElement.setAttribute('data-theme', 'dark');
document.getElementById('input-text').focus();

document.getElementById('input-text').focus();

// Toggle fullscreen input
function toggleFullscreenInput() {
    const container = document.querySelector('.input-container');
    const btn = document.getElementById('fullscreen-btn');
    const icon = btn.querySelector('i');

    container.classList.toggle('fullscreen');

    if (container.classList.contains('fullscreen')) {
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
        btn.title = "Exit fullscreen";
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Ensure textarea has focus
        document.getElementById('input-text').focus();
    } else {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        btn.title = "Fullscreen edit";
        document.body.style.overflow = '';
    }
}

const ADMIN_PWD_KEY = 'adminPassword';
let currentTypeFilter = 'all';

// Verify password
async function verifyPassword(inputPwd) {
    if (!inputPwd) {
        // Try to get it from localStorage
        inputPwd = localStorage.getItem(ADMIN_PWD_KEY);
        if (!inputPwd) return false;
    }

    try {
        const res = await fetch('/api/verify_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: inputPwd })
        });
        const data = await res.json();
        if (data.valid) {
            // Verification succeeded, save the password
            localStorage.setItem(ADMIN_PWD_KEY, inputPwd);
            // Also store it in a cookie so the backend can recognize it on initial load
            document.cookie = `admin_password=${inputPwd}; path=/; max-age=31536000`;
        }
        return data.valid;
    } catch {
        return false;
    }
}

// Permission management toggle
async function togglePermissionLock() {
    const toggle = document.getElementById('perm-lock-toggle');
    const newState = toggle.checked;

    // We need a password to change this state
    let password = localStorage.getItem(ADMIN_PWD_KEY);
    if (!password) {
        password = prompt('Enter the admin password to change permission settings:');
        if (!password) {
            toggle.checked = !newState;
            return;
        }
    }

    try {
        const response = await fetch('/api/permission_config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password, enabled: newState })
        });
        const result = await response.json();
        if (result.status === 'success') {
            localStorage.setItem(ADMIN_PWD_KEY, password);
            showNotification(`Admin mode ${newState ? 'enabled' : 'disabled'}`, 'success');
        } else {
            showNotification('Operation failed: incorrect password', 'error');
            toggle.checked = !newState;
        }
    } catch (e) {
        console.error(e);
        showNotification('Operation failed, please try again', 'error');
        toggle.checked = !newState;
    }
}

function getAuthHeaders() {
    const pwd = localStorage.getItem(ADMIN_PWD_KEY);
    return pwd ? { 'X-Admin-Password': pwd } : {};
}

// Format timestamp
function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Update all displayed times
function updateAllTimes() {
    document.querySelectorAll('.card-time[data-timestamp]').forEach(el => {
        const ts = parseFloat(el.dataset.timestamp);
        if (ts) el.textContent = formatTimestamp(ts);
    });
}

// Theme toggle
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Load the saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Clear history
async function clearHistory() {
    if (!confirm('Are you sure you want to clear all records? This action cannot be undone!')) {
        document.getElementById('clear-history-toggle').checked = false;
        return;
    }

    let password = localStorage.getItem(ADMIN_PWD_KEY);
    let success = false;

    if (password) {
        success = await executeClear(password);
    }

    if (!success) {
        password = prompt('Enter the admin password to clear all records:');
        if (!password) {
            document.getElementById('clear-history-toggle').checked = false;
            return;
        }
        success = await executeClear(password);
    }
}

async function executeClear(password) {
    try {
        const response = await fetch('/clear_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });

        if (response.status === 204 || response.status === 200) {
            localStorage.setItem(ADMIN_PWD_KEY, password);
            showNotification('All history has been cleared successfully', 'success');
            setTimeout(() => location.reload(), 1000);
            return true;
        } else {
            showNotification('Incorrect password, operation denied', 'error');
            document.getElementById('clear-history-toggle').checked = false;
            return false;
        }
    } catch (e) {
        console.error(e);
        showNotification('Failed to clear, please check your network connection', 'error');
        document.getElementById('clear-history-toggle').checked = false;
        return false;
    }
}
function saveTextToLocalStorage() {
    const textarea = document.getElementById('input-text');
    textarea.addEventListener('input', function () {
        localStorage.setItem('input-text-content', textarea.value);
    });
}

function loadTextFromLocalStorage() {
    const textarea = document.getElementById('input-text');
    const savedText = localStorage.getItem('input-text-content');
    if (savedText) {
        textarea.value = savedText;
    }
}

// Pagination & history display variables
let currentPage = 1;
let hasMore = true;
let isLoading = false;
const PAGE_SIZE = 20;

// Old-content access control (older than 3 days)
const OLD_DAYS_LIMIT = 3;
const VIEW_OLD_KEY = 'viewOldContentUnlocked';
let oldContentLoaded = false; // Whether old content has already been clicked and loaded
let hasOlderCards = false;
let oldPasswordPrompting = false;

function isCardOlderThanDays(timeStr, days) {
    if (!timeStr) return false;
    // Convert "YYYY-MM-DD HH:MM:SS" into a format browsers parse more reliably
    const normalized = timeStr.replace(' ', 'T');
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return false;
    const diff = Date.now() - d.getTime();
    return diff > days * 24 * 60 * 60 * 1000;
}

async function promptUnlockOldContent() {
    if (oldContentLoaded || oldPasswordPrompting) return;

    // Try to verify directly with the saved password; if it fails, prompt
    const savedPwd = localStorage.getItem(ADMIN_PWD_KEY);
    if (savedPwd) {
        if (await verifyPassword(savedPwd)) {
            oldContentLoaded = true;
            showNotification('Loading historical content...', 'success');
            refreshCards(true); // Passing true means load old content
            return;
        }
    }

    oldPasswordPrompting = true;
    const pwd = prompt('History older than 3 days is protected; a password is required to view it:');
    if (pwd === null) {
        oldPasswordPrompting = false;
        return;
    }

    if (await verifyPassword(pwd)) {
        oldContentLoaded = true;
        showNotification('History unlocked, loading...', 'success');
        refreshCards(true);
    } else {
        showNotification('Incorrect password, cannot view content older than 3 days.', 'error');
    }
    oldPasswordPrompting = false;
}

// Show the "load old cards" button
function showGetOldCardsButton() {
    if (oldContentLoaded) return; // If already loaded, don't show the button again

    let btn = document.getElementById('get-old-cards-btn');
    if (btn) {
        btn.style.display = 'block';
        return;
    }

    btn = document.createElement('button');
    btn.id = 'get-old-cards-btn';
    btn.className = 'btn-block secondary';
    btn.style.margin = '20px auto';
    btn.style.maxWidth = '300px';
    btn.innerHTML = '<i class="fas fa-history"></i> Load content older than 3 days';
    btn.onclick = promptUnlockOldContent;

    const container = document.getElementById('card-container');
    if (container) {
        container.insertAdjacentElement('afterend', btn);
    }
}

// Call these two functions on page load
window.onload = function () {
    loadTextFromLocalStorage();
    saveTextToLocalStorage();
    updateAllTimes();
    initGridMode();

    // Sync cookie
    const initialPwd = localStorage.getItem(ADMIN_PWD_KEY);
    if (initialPwd) {
        document.cookie = `admin_password=${initialPwd}; path=/; max-age=31536000`;
    }

    // Listen for the fullscreen shortcut (Esc exits fullscreen)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const container = document.querySelector('.input-container');
            // Only respond to Esc when the input box is in fullscreen
            if (container && container.classList.contains('fullscreen')) {
                toggleFullscreenInput();
            }
        }
    });

    // On initial load, sync the hasMore state (assuming the backend returned 20 or more)
    const container = document.getElementById('card-container');
    if (container) {
        const initialCount = container.querySelectorAll('.card-wrapper').length;
        hasMore = initialCount >= PAGE_SIZE;
    }

    // If the old-content button is on the page, there is restricted content
    if (document.getElementById('get-old-cards-btn')) {
        hasOlderCards = true;
    }

    // Listen for scroll loading / trigger the old-content password prompt
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            if (hasMore && !isLoading) {
                loadMoreCards(oldContentLoaded);
            } else if (!hasMore && hasOlderCards && !oldContentLoaded) {
                // No more new content, but old content exists and isn't loaded
                showGetOldCardsButton();
            }
        }
    });
};

// Helper to generate card HTML
function getCardHtml(card) {
    const displayTime = card.timestamp ? formatTimestamp(card.timestamp) : card.time;
    const isPinned = !!card.pinned;
    return `
        <div class="card-wrapper ${isPinned ? 'pinned' : ''}" data-id="${card.id}">
            <div class="card-header">
                <button onclick="togglePin(this)" class="icon-button raw-button pin2-button"
                    title="${isPinned ? 'Unpin' : 'Pin'}" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-thumbtack" style="${isPinned ? 'color: #ffd700; transform: rotate(45deg);' : ''}"></i>
                </button>
                <button onclick="copyToClipboard(this)" class="icon-button raw-button download-button"
                    title="Copy to clipboard" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-copy"></i>
                </button>
                <button onclick="editCard(this)" class="icon-button raw-button" title="Edit"
                    style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="downloadCard(this)" class="icon-button raw-button download-button"
                    style="padding: 4px 8px; font-size: 12px;" title="Download">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteCard(this)" class="icon-button raw-button delete-button"
                    style="padding: 4px 8px; font-size: 12px;" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <pre class="card-content">${card.content}</pre>
            <div class="card-time" data-timestamp="${card.timestamp || ''}">${displayTime}</div>
        </div>`;
}

async function refreshCards(showOldArg = null) {
    if (isLoading) return;
    isLoading = true;

    // If showOldArg is a boolean, update the state (usually from a successful unlock)
    if (typeof showOldArg === 'boolean') {
        oldContentLoaded = showOldArg;
    }

    // Make the request using the current unlock state
    const showOld = oldContentLoaded;

    if (showOld) {
        const btn = document.getElementById('get-old-cards-btn');
        if (btn) btn.style.display = 'none';
    }

    // Spin animation to indicate work
    const refreshBtn = event?.currentTarget || document.querySelector('button[title="Refresh"]');
    const icon = refreshBtn?.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
        const response = await fetch(`/api/cards?page=1&size=${PAGE_SIZE}&show_old=${showOld}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        const container = document.getElementById('card-container');
        if (container) {
            container.innerHTML = '';
            data.cards.forEach(card => {
                // No longer hard-code filtering on the frontend; leave it entirely to the backend based on show_old
                container.insertAdjacentHTML('beforeend', getCardHtml(card));
            });

            currentPage = 1;
            hasMore = data.has_more;
            if (data.has_restricted) {
                hasOlderCards = true;
                showGetOldCardsButton();
            }
        }
    } catch (error) {
        console.error('Failed to refresh cards:', error);
        showNotification('Failed to refresh cards, please check your network.', 'error');
    } finally {
        isLoading = false;
        if (icon) {
            setTimeout(() => icon.classList.remove('fa-spin'), 500);
        }
    }
}

// Quick filter feature
let isLoadingAllData = false; // Whether all data is currently being loaded for filtering

async function loadAllDataForFilter() {
    if (isLoadingAllData) return;
    isLoadingAllData = true;

    const btnText = document.getElementById('search-more-text');
    if (btnText) btnText.textContent = 'Loading all data...';

    // Scroll to the bottom of the page to trigger loading, looping until all data is loaded
    do {
        // Scroll to the bottom of the page
        window.scrollTo(0, document.body.scrollHeight);
        // Wait for scrolling and loading to finish
        await new Promise(resolve => setTimeout(resolve, 500));

        // Scroll again in case there is new content
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 500));
    } while (hasMore);

    isLoadingAllData = false;
    if (btnText) {
        btnText.textContent = 'All results loaded';
    }
}

function filterCards() {
    // Get the currently visible search box (could be the desktop or mobile one)
    const searchInputs = document.querySelectorAll('.search-input');
    let activeInput = null;
    for (let input of searchInputs) {
        if (input.offsetParent !== null) {
            activeInput = input;
            break;
        }
    }
    const query = (activeInput?.value || '').toLowerCase();
    const hasFilter = query.trim() !== '' || currentTypeFilter !== 'all';

    // Update the filter-indicator dot state
    document.querySelectorAll('.filter-toggle-btn').forEach(btn => {
        if (hasFilter) {
            btn.classList.add('has-filter');
        } else {
            btn.classList.remove('has-filter');
        }
    });

    // If there is a filter and more data is still unloaded, automatically load all data
    if (hasFilter && hasMore && !isLoadingAllData) {
        // Start loading data immediately, then re-filter once loading completes
        loadAllDataForFilter().then(() => {
            filterCardsWithQuery(query);
        });
    }

    // Run the filter
    filterCardsWithQuery(query);
}

function filterCardsWithQuery(query) {
    const cards = document.querySelectorAll('.card-wrapper');
    
    cards.forEach(card => {
        const contentElement = card.querySelector('.card-content');
        if (!contentElement) return;
        
        const text = contentElement.textContent.toLowerCase();
        const matchesQuery = text.includes(query);

        let matchesType = true;
        if (currentTypeFilter !== 'all') {
            const hasImg = card.querySelector('img, video');
            const hasLink = card.querySelector('a');
            const hasFile = card.querySelector('.file-card');
            
            if (currentTypeFilter === 'image') matchesType = !!hasImg;
            else if (currentTypeFilter === 'link') matchesType = !!hasLink;
            else if (currentTypeFilter === 'file') matchesType = !!hasFile;
            else if (currentTypeFilter === 'text') {
                // Text only: no images, no external links, no attachments
                matchesType = !hasImg && !hasLink && !hasFile;
            }
        }

        if (matchesQuery && matchesType) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    // Optimization: if searching and more data is still unloaded, show the "search all" button
    const searchMoreContainer = document.getElementById('search-more-container');
    if (searchMoreContainer) {
        if ((query.trim() !== '' || currentTypeFilter !== 'all') && hasMore) {
            searchMoreContainer.style.display = 'block';
        } else {
            searchMoreContainer.style.display = 'none';
        }
    }
}

function toggleFilterMenu(event) {
    event.stopPropagation();
    const dropdowns = document.querySelectorAll('.dropdown-content');
    const currentDropdown = event.currentTarget.nextElementSibling;

    // Close other open dropdown menus
    dropdowns.forEach(d => {
        if (d !== currentDropdown) d.classList.remove('show');
    });
    
    currentDropdown.classList.toggle('show');
}

function setTypeFilter(type) {
    currentTypeFilter = type;

    // Update all related UI states
    document.querySelectorAll('.dropdown-item').forEach(item => {
        if (item.getAttribute('data-type') === type) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update the active state of the toggle button
    document.querySelectorAll('.filter-toggle-btn').forEach(btn => {
        if (type !== 'all') {
            btn.classList.add('active');
            btn.classList.add('has-filter');
        } else {
            btn.classList.remove('active');
            btn.classList.remove('has-filter');
        }
    });

    // Close the dropdown menu
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    filterCards();
}

// Click outside to close the dropdown menu
document.addEventListener('click', function() {
    document.querySelectorAll('.dropdown-content.show').forEach(d => d.classList.remove('show'));
});

async function loadAllForSearch() {
    const btnText = document.getElementById('search-more-text');
    if (btnText) btnText.textContent = 'Loading all data...';

    // Load a very large amount of data at once for full-text filtering
    await loadMoreCards(hasOlderCards, 9999);

    if (btnText) {
        btnText.textContent = hasMore ? 'Loaded more results' : 'All results loaded';
    }
    // Re-run the filter
    filterCards();
}

async function loadMoreCards(showOld = false, customSize = null, onComplete = null) {
    if (isLoading) {
        if (onComplete) onComplete(hasMore);
        return;
    }
    isLoading = true;

    const loader = document.getElementById('main-loader');
    if (loader) loader.style.display = 'block';

    try {
        const fetchSize = customSize || PAGE_SIZE;
        const response = await fetch(`/api/cards?page=${currentPage + 1}&size=${fetchSize}&show_old=${showOld}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        const container = document.getElementById('card-container');
        data.cards.forEach(card => {
            container.insertAdjacentHTML('beforeend', getCardHtml(card));
        });

        currentPage++;
        hasMore = data.has_more;
        if (data.has_restricted) {
            hasOlderCards = true;
            if (!hasMore) showGetOldCardsButton();
        }
    } catch (error) {
        console.error('Failed to load more cards:', error);
        showNotification('Failed to load more cards, please check your network.', 'error');
    } finally {
        isLoading = false;
        if (loader) loader.style.display = 'none';
        if (onComplete) onComplete(hasMore);
    }
}


// Paste clipboard content
function pasteClipboard() {
    try {
        navigator.clipboard.readText()
            .then(text => {
                document.getElementById('input-text').value = text;
                document.getElementById('text-form').submit();
            })
    }
    catch {
        alert('Direct paste is not available on HTTP sites');
    }
}

// Ctrl+Enter to submit
document.getElementById('input-text').addEventListener('keydown', function (e) {
    console.log(e.key)
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault(); // Prevent the default newline behavior
        //press button #add-btn
        document.querySelector('#add-btn').click();
    }
    //F1 js
    if (e.key === 'F1') {
        e.preventDefault(); // Prevent the default newline behavior
        //<textarea id="input-text" add a script tag
        const textarea = document.querySelector('textarea[name="text"]');
        textarea.value = `<script>

</script>
<style>

</style>`;

    }
    //F2 sytyle
    if (e.key === 'F2') {
        e.preventDefault(); // Prevent the default newline behavior
        //<textarea id="input-text" add a style tag
        const textarea = document.querySelector('textarea[name="text"]');
        textarea.value = `<iframe>

</iframe>`;
    }
});


// Listen for paste events
document.addEventListener('paste', async function (e) {
    const items = e.clipboardData.items;
    let files = [];
    let text = '';

    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const newFile = new File([file], `image_${randomStr}.png`, {
                type: file.type,
                lastModified: file.lastModified
            });
            files.push(newFile);
        } else if (item.kind === 'file') {
            const file = item.getAsFile();
            files.push(file);
        } else if (item.type === 'text/plain') {
            item.getAsString((str) => {
                text += str;
            });
        }
    }

    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            uploadImage(files);
        } else {
            uploadFiles(files);
        }
    }

    if (text) {
        const textarea = document.querySelector('textarea[name="text"]');
        textarea.value += (textarea.value ? '\n' : '') + text;
    }
});

// Upload progress (real progress)
let currentUploadPercent = 0;
let uploadProgressVisible = false;
const UPLOAD_PROGRESS_MIN_SIZE = 2000 * 1024; // Show the progress window for files larger than 2MB

function showUploadProgress(totalCount) {
    const modal = document.getElementById('upload-modal');
    const barInner = document.getElementById('upload-progress-inner');
    const statusText = document.getElementById('upload-status-text');
    if (!modal || !barInner || !statusText) return;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    currentUploadPercent = 0;
    barInner.style.width = '0%';
    statusText.textContent = totalCount > 1
        ? `Preparing to upload ${totalCount} files...`
        : 'Uploading file...';

    uploadProgressVisible = true;
}

function updateUploadProgress(doneCount, totalCount) {
    const barInner = document.getElementById('upload-progress-inner');
    const statusText = document.getElementById('upload-status-text');
    if (!uploadProgressVisible || !barInner || !statusText || totalCount === 0) return;

    const percent = Math.round((doneCount / totalCount) * 100);
    currentUploadPercent = percent;
    barInner.style.width = `${percent}%`;
    statusText.textContent = `Uploading (${Math.min(doneCount, totalCount).toFixed(1).replace(/\.0$/, '')}/${totalCount})...`;
}

function hideUploadProgress() {
    const modal = document.getElementById('upload-modal');
    const statusText = document.getElementById('upload-status-text');
    const barInner = document.getElementById('upload-progress-inner');
    if (!uploadProgressVisible || !modal) return;

    if (barInner) {
        currentUploadPercent = 100;
        barInner.style.width = '100%';
    }
    if (statusText) statusText.textContent = 'Upload complete';

    uploadProgressVisible = false;

    // Pause briefly before closing so the user can see 100%
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 400);
}

// Use XHR to support upload progress
function uploadWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = onProgress;
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.send(formData);
    });
}

// Image upload functions
document.getElementById('file-input').addEventListener('change', async function (e) {
    if (e.target.files && e.target.files.length > 0) {
        await uploadImage(Array.from(e.target.files));
    }
});

async function uploadImage(files) {
    const fileArray = Array.from(files);
    const autoCompress = localStorage.getItem('autoCompress') === 'true';
    const quality = parseInt(localStorage.getItem('compressionQuality')) || 80;

    try {
        if (fileArray.length > 0) {
            const totalSize = fileArray.reduce((sum, f) => sum + (f.size || 0), 0);
            if (totalSize >= UPLOAD_PROGRESS_MIN_SIZE || fileArray.length > 1) {
                showUploadProgress(fileArray.length);
            }
        }

        // Process one file at a time
        let doneCount = 0;
        for (let file of fileArray) {
            // If auto-compress is enabled and the file is an image
            if (autoCompress && file.type.startsWith('image/')) {
                console.log(`Compressing image: ${file.name}, quality: ${quality}%`);
                const compressedBlob = await compressImage(file, quality / 100);
                file = new File([compressedBlob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
            }

            const formData = new FormData();
            formData.append('image', file);

            const imageUrl = await uploadWithProgress('/upload', formData, (e) => {
                if (!uploadProgressVisible) return;
                if (e.lengthComputable) {
                    const current = doneCount + e.loaded / e.total;
                    updateUploadProgress(current, fileArray.length);
                }
            });

            if (imageUrl) {
                const fileSize = formatFileSize(file.size);
                const content = `<div class="image-card">
                    <img src="${imageUrl}" alt="${file.name}" >
                    <div class="image-info">
                        <i class="fas fa-image" style="margin-right: 4px;"></i>
                        <span>${file.name} (${fileSize})</span>
                    </div>
                </div>`;

                // Submit each file separately
                const textarea = document.querySelector('textarea[name="text"]');
                textarea.value = content;
                document.querySelector('#add-btn').click();
            }

            doneCount++;
            updateUploadProgress(doneCount, fileArray.length);
        }
    } catch (error) {
        console.error('Upload error:', error);
    } finally {
        hideUploadProgress();
    }
}

// Image compression function
async function compressImage(file, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Keep the original dimensions
                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert to jpeg for compression
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}


// File upload functions
async function uploadFiles(files) {
    const fileArray = Array.from(files);
    console.log('Converted file array:', fileArray); // For debugging
    try {
        if (fileArray.length > 0) {
            const totalSize = fileArray.reduce((sum, f) => sum + (f.size || 0), 0);
            if (totalSize >= UPLOAD_PROGRESS_MIN_SIZE || fileArray.length > 1) {
                showUploadProgress(fileArray.length);
            }
        }

        let doneCount = 0;
        for (const file of fileArray) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const fileUrl = await uploadWithProgress('/upload_file', formData, (e) => {
                    if (!uploadProgressVisible) return;
                    if (e.lengthComputable) {
                        const current = doneCount + e.loaded / e.total;
                        updateUploadProgress(current, fileArray.length);
                    }
                });
                if (fileUrl) {
                    const fileIcon = getFileIcon(file.name);
                    const fileSize = formatFileSize(file.size);
                    const fileLink = generateFileLink(file, fileUrl, fileIcon, fileSize);

                    // Submit via the API instead of clicking the button
                    const addResponse = await fetch('/api/add_card', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text: fileLink })
                    });
                    const addResult = await addResponse.json();

                    // Add the new card directly on the frontend
                    addCardToPage(fileLink, addResult.id);
                }
            } catch (error) {
                console.error('File upload failed:', error);
                showUploadError(error);
            }
            doneCount++;
            updateUploadProgress(doneCount, fileArray.length);
        }
    } finally {
        hideUploadProgress();
    }
}

// Generate a file link
function generateFileLink(file, fileUrl, fileIcon, fileSize) {
    let fileLink = `<div class="file-card">
        <i class="${fileIcon}" style="margin-right: 8px;"></i>
        <a href="${fileUrl}" target="_blank">${file.name}</a>
        <span class="file-info" style="margin-left: 8px;">(${fileSize})</span>
    </div>`;

    if (file.type.startsWith('image/')) {
        fileLink = `<img src="${fileUrl}" alt="${file.name}" /> <br/>` + fileLink;
    } else if (file.type.startsWith('video/')) {
        fileLink = `<video controls>
            <source src="${fileUrl}" type="${file.type}">
        </video> <br/>` + fileLink;
    }

    return fileLink;
}

// Add a new card to the page
function addCardToPage(fileLink, id) {
    const cardContainer = document.getElementById('card-container');
    if (!cardContainer) return;

    const card = {
        id: id,
        content: fileLink,
        pinned: false,
        timestamp: Date.now() / 1000,
        time: getCurrentFormattedTime()
    };

    const html = getCardHtml(card);

    // Insertion logic: insert after all pinned cards, or at the very top of the container
    const lastPinned = Array.from(cardContainer.querySelectorAll('.card-wrapper.pinned')).pop();
    if (lastPinned) {
        lastPinned.insertAdjacentHTML('afterend', html);
    } else {
        cardContainer.insertAdjacentHTML('afterbegin', html);
    }
}

function getCurrentFormattedTime() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
}

// Show an upload error
function showUploadError(error) {
    alert(`File upload failed: ${error.message}`);
}


// Utility functions
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'webp': 'fas fa-file-image',
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        '7z': 'fas fa-file-archive',
        'js': 'fas fa-file-code',
        'css': 'fas fa-file-code',
        'html': 'fas fa-file-code',
        'py': 'fas fa-file-code',
        'txt': 'fas fa-file-alt',
        'md': 'fas fa-file-alt',
        'mp3': 'fas fa-file-audio',
        'wav': 'fas fa-file-audio',
        'mp4': 'fas fa-file-video',
        'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video'
    };

    return iconMap[ext] || 'fas fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Drag-and-drop
const dropZone = document.getElementById('drop-zone');

document.addEventListener('dragenter', function (e) {
    e.preventDefault();
    dropZone.style.display = 'block';
});

document.addEventListener('dragover', function (e) {
    e.preventDefault();
});
//drop
dropZone.addEventListener('drop', async function (e) {
    e.preventDefault();
    dropZone.style.display = 'none';
    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            uploadImage(files);
        } else {
            uploadFiles(files);
        }
    }
});

dropZone.addEventListener('dragleave', function (e) {
    if (e.target === dropZone) {
        dropZone.style.display = 'none';
    }
});

// Card operation functions
async function editCard(button) {
    const cardWrapper = button.closest('.card-wrapper');
    const contentHtml = cardWrapper.querySelector('.card-content').innerHTML;
    const isFileOrImage = contentHtml.includes('file-card') || contentHtml.includes('image-card') || contentHtml.includes('<img');

    // 1. Put the content into the input box
    // Use innerHTML for files/images, and innerText for plain text to make editing easier
    const textarea = document.getElementById('input-text');
    const contentToEdit = isFileOrImage ? contentHtml : cardWrapper.querySelector('.card-content').innerText;
    textarea.value = contentToEdit;
    localStorage.setItem('input-text-content', contentToEdit);

    // 2. Scroll to the top and focus
    window.scrollTo({ top: 0, behavior: 'smooth' });
    textarea.focus();

    // 3. Delete the original card (a new submission will automatically use the current time)
    await deleteCard(button);
}

async function deleteCard(button) {
    const cardWrapper = button.closest('.card-wrapper');
    const cardId = cardWrapper.dataset.id;

    // 1. Run the animation immediately (optimistic update)
    // Prevent repeated clicks
    if (cardWrapper.classList.contains('fade-out')) return;

    // If deleting the currently highlighted card, try to highlight the next visible card
    if (highlightedCard === cardWrapper) {
        let target = cardWrapper.nextElementSibling;
        // Skip cards that aren't visible (hidden by filtering)
        while (target && (!target.classList.contains('card-wrapper') || target.style.display === 'none')) {
            target = target.nextElementSibling;
        }
        // If none found after it, look before it
        if (!target) {
            target = cardWrapper.previousElementSibling;
            while (target && (!target.classList.contains('card-wrapper') || target.style.display === 'none')) {
                target = target.previousElementSibling;
            }
        }
        if (target && target.classList.contains('card-wrapper')) {
            highlightCard(target, false);
        } else {
            highlightCard(null);
        }
    }

    cardWrapper.classList.add('fade-out');

    try {
        const response = await fetch('/delete_card', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                id: cardId
            })
        });

        const result = await response.json();
        if (response.status === 401) {
            const pwd = prompt('This action requires the admin password:');
            if (pwd) {
                if (await verifyPassword(pwd)) {
                    // Verification succeeded, retry the action
                    return deleteCard(button);
                } else {
                    showNotification('Incorrect password, cannot delete; this action will be logged', 'error');
                }
            }
            // Restore the UI
            cardWrapper.classList.remove('fade-out');
            return;
        }

        if (result.status === 'success') {
            cardWrapper.remove();
        } else {
            throw new Error(result.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        cardWrapper.classList.remove('fade-out');
        if (error.message !== 'Admin password required') {
            showNotification('Incorrect password, cannot delete; this action will be logged', 'error');
        }
    }
}

async function togglePin(button) {
    const cardWrapper = button.closest('.card-wrapper');
    if (!cardWrapper) return;
    const cardId = cardWrapper.dataset.id;
    const isPinned = cardWrapper.classList.contains('pinned');
    const endpoint = isPinned ? '/api/unpin_card' : '/api/pin_card';
    const icon = button.querySelector('i');

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ id: cardId })
        });
        const data = await response.json();

        if (response.status === 401) {
            const pwd = prompt('This action requires the admin password:');
            if (pwd) {
                if (await verifyPassword(pwd)) {
                    // Verification succeeded, retry the action
                    return togglePin(button);
                }
            }
            return;
        }

        if (data.status === 'success') {
            const container = document.getElementById('card-container');
            if (isPinned) {
                // Unpin
                cardWrapper.classList.remove('pinned');
                icon.style.color = '';
                icon.style.transform = '';
                button.title = 'Pin';

                // Move it to where it belongs: sorted by descending ID.
                // Find the first non-pinned card with a smaller ID and insert before it.
                const wrappers = Array.from(container.querySelectorAll('.card-wrapper'));
                let success = false;
                for (let other of wrappers) {
                    if (other === cardWrapper) continue;
                    if (!other.classList.contains('pinned') && parseInt(other.dataset.id) < parseInt(cardId)) {
                        container.insertBefore(cardWrapper, other);
                        success = true;
                        break;
                    }
                }
                if (!success) {
                    // If none smaller is found, insert it at the end
                    container.appendChild(cardWrapper);
                }
            } else {
                // Pin
                cardWrapper.classList.add('pinned');
                icon.style.color = '#ffd700';
                icon.style.transform = 'rotate(45deg)';
                button.title = 'Unpin';

                // Move it to the top (before the first non-pinned card)
                const firstUnpinned = container.querySelector('.card-wrapper:not(.pinned)');
                if (firstUnpinned) {
                    container.insertBefore(cardWrapper, firstUnpinned);
                } else {
                    container.appendChild(cardWrapper);
                }
            }

            // Scroll to the card's position
            cardWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } else {
            alert('Operation failed: ' + (data.message || ''));
        }
    } catch (e) {
        console.error(e);
        alert('Request error');
    }
}

// Initial card check - hide the "view raw content" button for images and files
// document.addEventListener('DOMContentLoaded', function() {
//     const cardWrappers = document.querySelectorAll('.card-wrapper');
//     cardWrappers.forEach(wrapper => {
//         const content = wrapper.querySelector('.card-content').innerHTML;
//         const hasImageOrFile = content.includes('<img') || content.includes('file-card');
//         const rawButton = wrapper.querySelector('.raw-button[title="View raw content"]');
//         if (hasImageOrFile && rawButton) {
//             rawButton.style.display = 'none';
//         }
//     });
// });


async function downloadCard(button) {
    const cardContent = button.closest('.card-wrapper').querySelector('.card-content');
    const img = cardContent.querySelector('img');
    const fileLink = cardContent.querySelector('.file-card a');

    try {
        if (img) {
            // Handle image download
            const response = await fetch(img.src);
            const blob = await response.blob();

            const imageInfo = cardContent.querySelector('.image-info span');
            let fileName = 'image.png';
            if (imageInfo) {
                fileName = imageInfo.textContent.split(' (')[0];
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.className = 'temp-download-link';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } else if (fileLink) {
            // Handle file download - use fetch to retrieve the file content
            const response = await fetch(fileLink.href);
            const blob = await response.blob();

            // Get the original file name from the file card
            const fileName = fileLink.textContent;

            // Create the download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.className = 'temp-download-link';
            a.href = url;
            a.download = fileName; // Use the original file name
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } else {
            // Handle text content download
            const content = cardContent.innerText.trim();
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.className = 'temp-download-link';
            a.href = url;
            a.download = 'content.txt';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }

        // Show download-success feedback
        button.title = 'Download successful!';
        button.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
            button.title = 'Download';
            button.style.backgroundColor = '';
        }, 1000);

    } catch (error) {
        console.error('Download failed:', error);
        button.title = 'Download failed';
        button.style.backgroundColor = '#f44336';
        setTimeout(() => {
            button.title = 'Download';
            button.style.backgroundColor = '';
        }, 1000);
    }
}

// Process input
function processInput(input) {
    var outstr = input.trim();
    // If the content already appears to contain HTML tags (especially our card structure), don't process it, to avoid breaking the structure
    if (outstr.includes('<div') || outstr.includes('<img') || outstr.includes('<a ')) {
        return outstr;
    }
    // Use a regular expression to match all links
    outstr = outstr.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    return outstr;
}

async function addCard() {
    const textarea = document.querySelector('#input-text');
    let content = textarea.value;
    content = processInput(content);
    textarea.value = ''; // Clear the input box and sync to localStorage to avoid leftovers

    if (!content) return;

    try {
        const requestData = { text: content };

        const response = await fetch('/api/add_card', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Create a new card
            const cardContainer = document.querySelector('.card');
            const newCard = document.createElement('div');
            newCard.className = 'card-wrapper';
            newCard.dataset.id = result.id;
            const timeStr = getCurrentFormattedTime();
            const timestamp = Date.now() / 1000;

            newCard.innerHTML = `
                <div class="card-header">
                    <button onclick="copyToClipboard(this)" class="icon-button raw-button download-button" title="Copy to clipboard" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="editCard(this)" class="icon-button raw-button" title="Edit" style="padding: 4px 8px; font-size: 12px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="downloadCard(this)" class="icon-button raw-button download-button" style="padding: 4px 8px; font-size: 12px;" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="deleteCard(this)" class="icon-button raw-button delete-button" style="padding: 4px 8px; font-size: 12px;" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <pre class="card-content">${content}</pre>
                <div class="card-time" data-timestamp="${timestamp}">${timeStr}</div>
            `;

            // Insert the new card at the very top
            cardContainer.insertBefore(newCard, cardContainer.firstChild);

            // Clear the input box and saved history
            textarea.value = '';
            localStorage.setItem('input-text-content', '');
        } else {
            console.error('Add failed:', result.message);
        }
    } catch (error) {
        console.error('Add error:', error);
    }
}


// Define a list of remote image links
const imageUrls = [
    // 'static/bg.jpg',
    // 'static/2.jpg',
    'static/39.jpg',
    'static/16.jpg',
    'static/5.jpg'
    // Add more image links
];

// Define a function to get a random background image ("image of the day" based on date and manual offset)
async function getRandomBackgroundImage() {
    const isCustom = localStorage.getItem('hasCustomBG') === 'true';
    if (!isCustom) {
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        let dateSeed = 0;
        for (let i = 0; i < dateStr.length; i++) dateSeed += dateStr.charCodeAt(i);
        const manualOffset = parseInt(localStorage.getItem('bgManualOffset')) || 0;
        const index = Math.abs(dateSeed + manualOffset) % imageUrls.length;
        return imageUrls[index];
    }

    try {
        const db = await openBGDB();

        // Compute the identifier for the current environment (date + offset)
        const now = new Date();
        const dateKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        const manualOffset = parseInt(localStorage.getItem('bgManualOffset')) || 0;
        const currentEnvKey = `${dateKey}_${manualOffset}`;

        // 1. Try to read from the hot cache
        const cached = await getActiveCache(db);
        if (cached && cached.envKey === currentEnvKey) {
            console.log('Loading background from the quick cache');
            return URL.createObjectURL(cached.data);
        }

        // 2. Cache is invalid or missing, recompute
        const totalCount = await getBGCount(db);
        if (totalCount === 0) return imageUrls[0];

        let dateSeed = 0;
        for (let i = 0; i < dateKey.length; i++) dateSeed += dateKey.charCodeAt(i);
        const index = Math.abs(dateSeed + manualOffset) % totalCount;

        // Use an O(1) ID lookup
        const bgRecord = await getBGById(db, index);
        if (bgRecord && bgRecord.data) {
            // Update the hot cache so the next load is "instant"
            await updateActiveCache(db, currentEnvKey, bgRecord.data);
            return URL.createObjectURL(bgRecord.data);
        }
    } catch (e) {
        console.error('Failed to load custom background:', e);
    }

    return imageUrls[0];
}

// Get the background element
const backgroundElement = document.getElementById('background');

let currentBGObjectURL = null;

// Define a function to set the background image
function setBackgroundImage(url) {
    // Release the old ObjectURL to avoid memory leaks
    if (currentBGObjectURL && currentBGObjectURL.startsWith('blob:')) {
        URL.revokeObjectURL(currentBGObjectURL);
    }
    currentBGObjectURL = url;

    backgroundElement.style.backgroundImage = `url(${url})`;
    // Also update the preview image on the settings page
    const previewImg = document.getElementById('bg-preview-img');
    const previewContainer = document.getElementById('bg-preview-container');
    if (previewImg && previewContainer) {
        previewImg.src = url;
        previewContainer.style.display = 'block';
    }
}
// Call the function and set the background image
getRandomBackgroundImage().then(url => {
    if (url) {
        setBackgroundImage(url);
    }
});
async function copyToClipboard(button) {
    const card = button.closest('.card-wrapper');
    const contentElement = card.querySelector('.card-content');
    const imgElement = contentElement.querySelector('img');

    if (imgElement) {
        // Check whether the environment supports one-click image copy (HTTPS or localhost)
        const isSecure = window.isSecureContext ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (!isSecure) {
            showNotification('One-click image copy is not supported over HTTP; please right-click to copy manually', 'warning');
            button.style.backgroundColor = '#FF0000';
            setTimeout(() => button.style.backgroundColor = '', 500);
            return;
        }

        const success = await copyImageToClipboard(imgElement.src, imgElement);
        if (success) {
            showNotification('Image copied to clipboard', 'success');
            button.style.backgroundColor = '#4CAF50';
        } else {
            showNotification('Failed to copy image, please try right-clicking to copy manually', 'error');
            button.style.backgroundColor = '#FF0000';
        }
        setTimeout(() => button.style.backgroundColor = '', 500);
        return;
    } else {
        // Copy text content
        const cardContent = contentElement.innerText.trim();
        copyTextToClipboard(cardContent);
        showNotification('Copied to clipboard', 'success');
    }

    // Flash the button green
    button.style.backgroundColor = '#4CAF50'; // Set to green
    setTimeout(() => {
        button.style.backgroundColor = ''; // Restore the original color
    }, 500); // Flash duration is 500 milliseconds
}

function copyTextToClipboard(text) {
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = text;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextarea);
}

async function copyImageToClipboard(src, imgElement) {
    // 1. Prefer the modern Clipboard API (Secure Context only)
    // Note: Chrome only provides navigator.clipboard.write over localhost or HTTPS
    if (navigator.clipboard && window.ClipboardItem && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
            const response = await fetch(src);
            let blob = await response.blob();

            if (!blob.type.includes('png')) {
                blob = await convertImageToPng(src);
            }

            const data = [new ClipboardItem({ [blob.type]: blob })];
            await navigator.clipboard.write(data);
            return true;
        } catch (err) {
            console.warn('Clipboard API failed, trying the fallback:', err);
        }
    }

    // 2. Fallback: simulate "copy image" via Selection (compatible with HTTP environments)
    // This method mimics the user right-clicking an image and selecting "Copy image"
    try {
        const selection = window.getSelection();
        const oldRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        const container = document.createElement('div');
        container.contentEditable = true;
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.opacity = '0';
        container.style.overflow = 'hidden';
        document.body.appendChild(container);

        // Clone the original image element to ensure it includes the full URL and styles
        const imgClone = imgElement.cloneNode(true);
        // Make sure to use an absolute path
        if (imgClone.src.startsWith('/')) {
            imgClone.src = window.location.origin + imgClone.src;
        }

        container.appendChild(imgClone);

        // Select the image element itself
        const range = document.createRange();
        range.selectNode(imgClone);
        selection.removeAllRanges();
        selection.addRange(range);

        // Some browsers require the container to be focused to perform the copy
        container.focus();

        const success = document.execCommand('copy');

        // Clean up
        document.body.removeChild(container);
        selection.removeAllRanges();
        if (oldRange) selection.addRange(oldRange);

        return success;
    } catch (err) {
        console.error('Fallback copy method failed:', err);
        return false;
    }
}

function convertImageToPng(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = src;
    });
}

// Add image navigation variables and functions
let currentImageIndex = 0;
let imageList = [];

// Modify the showImageModal function
function showImageModal(imageSrc) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalBody = document.querySelector('.image-modal-body');
    const currentImageNumber = document.getElementById('current-image-number');
    const totalImages = document.getElementById('total-images');

    // Get all images
    imageList = Array.from(document.querySelectorAll('.card-content img')).map(img => img.src);
    currentImageIndex = imageList.indexOf(imageSrc);

    // Update the image
    modalImage.src = imageSrc;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Update the counter
    currentImageNumber.textContent = currentImageIndex + 1;
    totalImages.textContent = imageList.length;

    // If there is only one image, add the single-image class
    if (imageList.length === 1) {
        modalBody.classList.add('single-image');
    } else {
        modalBody.classList.remove('single-image');
    }

    // Click the modal backdrop to close
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeImageModal();
        }
    });

    // Keyboard shortcuts use a single global listener; don't add them again here, or listeners will stack and cause performance issues.
    // The relevant esc, left, and right logic is handled uniformly via the global keydown handler.
}

// Modify the showPrevImage function
function showPrevImage() {
    if (imageList.length <= 1) return;

    currentImageIndex = (currentImageIndex - 1 + imageList.length) % imageList.length;
    const modalImage = document.getElementById('modal-image');
    const currentImageNumber = document.getElementById('current-image-number');

    modalImage.src = imageList[currentImageIndex];
    currentImageNumber.textContent = currentImageIndex + 1;


}

// Modify the showNextImage function
function showNextImage() {
    if (imageList.length <= 1) return;

    currentImageIndex = (currentImageIndex + 1) % imageList.length;
    const modalImage = document.getElementById('modal-image');
    const currentImageNumber = document.getElementById('current-image-number');

    modalImage.src = imageList[currentImageIndex];
    currentImageNumber.textContent = currentImageIndex + 1;


}

// Modify the closeImageModal function
function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.style.display = 'none';

    // Only restore background scrolling if the gallery modal isn't showing
    const galleryModal = document.getElementById('gallery-modal');
    if (galleryModal.style.display !== 'block') {
        document.body.style.overflow = '';
    }

    // Clear the image list
    imageList = [];
    currentImageIndex = 0;
}

// Add click events to all images
document.addEventListener('DOMContentLoaded', function () {
    // Add click events to existing images
    document.querySelectorAll('.card-content img').forEach(img => {
        img.onclick = function () {
            showImageModal(this.src);
        };
    });

    // Watch for newly added cards
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) { // Element node
                        const images = node.querySelectorAll('img');
                        images.forEach(img => {
                            img.onclick = function () {
                                showImageModal(this.src);
                            };
                        });
                    }
                });
            }
        });
    });

    // Start observing the card container
    const cardContainer = document.querySelector('.card');
    if (cardContainer) {
        observer.observe(cardContainer, {
            childList: true,
            subtree: true
        });
    }
});

// Add a function to open the image
function openImageInNewTab() {
    const modalImage = document.getElementById('modal-image');
    if (modalImage && modalImage.src) {
        window.open(modalImage.src, '_blank');
    }
}

// Content expand logic - use a dedicated button instead of clicking the whole content box
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('expand-toggle-btn') || e.target.closest('.expand-toggle-btn')) {
        const btn = e.target.closest('.expand-toggle-btn');
        const content = btn.closest('.card-wrapper').querySelector('.card-content');
        if (content) {
            content.classList.toggle('expanded');
            btn.innerHTML = content.classList.contains('expanded')
                ? '<i class="fas fa-chevron-up"></i> Collapse'
                : '<i class="fas fa-chevron-down"></i> Expand all';
        }
    }
});

// Helper function to detect content overflow
function checkOverflow() {
    const screenHeight = window.innerHeight;

    document.querySelectorAll('.card-content').forEach(content => {
        const wrapper = content.closest('.card-wrapper');
        let toggleBtn = wrapper.querySelector('.expand-toggle-btn');

        // Determine whether the content's actual height exceeds the full screen height
        if (content.scrollHeight > screenHeight) {
            content.classList.add('needs-collapse');
        } else {
            content.classList.remove('needs-collapse');
        }

        if (!content.classList.contains('expanded')) {
            // When the content is collapsed and has needs-collapse, show the expand button
            const isOverflowing = content.scrollHeight > content.clientHeight + 5;

            if (isOverflowing && content.classList.contains('needs-collapse')) {
                content.classList.add('is-overflowing');
                // Add the expand button if it doesn't exist
                if (!toggleBtn) {
                    toggleBtn = document.createElement('button');
                    toggleBtn.className = 'expand-toggle-btn';
                    toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Expand all';
                    wrapper.appendChild(toggleBtn);
                }
                toggleBtn.style.display = 'flex';
            } else {
                content.classList.remove('is-overflowing');
                if (toggleBtn) toggleBtn.style.display = 'none';
            }
        } else if (toggleBtn && content.classList.contains('needs-collapse')) {
             // If already expanded, make sure the button shows "Collapse" (in case of re-detection)
             toggleBtn.style.display = 'flex';
             toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Collapse';
        } else if (toggleBtn) {
             toggleBtn.style.display = 'none';
        }
    });
}

// Detect overflow on page load and scroll
window.addEventListener('load', checkOverflow);
window.addEventListener('resize', checkOverflow);

// Intercept refresh functions to check overflow after DOM update
const originalRefreshCards = window.refreshCards;
if (originalRefreshCards) {
    window.refreshCards = async function(...args) {
        await originalRefreshCards.apply(this, args);
        setTimeout(checkOverflow, 500); 
    };
}

const originalLoadMoreCards = window.loadMoreCards;
if (originalLoadMoreCards) {
    window.loadMoreCards = async function(...args) {
        await originalLoadMoreCards.apply(this, args);
        setTimeout(checkOverflow, 500);
    };
}

async function downloadCurrentImage() {
    const modalImage = document.getElementById('modal-image');
    if (!modalImage || !modalImage.src) return;
    await downloadImageByUrl(modalImage.src);
}

// Settings functions
function showSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Set the compact-mode toggle state
    const simpleModeToggle = document.getElementById('simple-mode-toggle');
    simpleModeToggle.checked = localStorage.getItem('simpleMode') === 'true';

    // Update the custom background info
    updateBGFolderStatus();

    // Set the auto-compress toggle state
    const autoCompressToggle = document.getElementById('auto-compress-toggle');
    const autoCompress = localStorage.getItem('autoCompress') === 'true';
    autoCompressToggle.checked = autoCompress;

    // Show/hide the compression quality container
    const qualityContainer = document.getElementById('compression-quality-container');
    qualityContainer.style.display = autoCompress ? 'flex' : 'none';

    // Set the compression quality slider
    const qualitySlider = document.getElementById('compression-quality-slider');
    const quality = localStorage.getItem('compressionQuality') || 80;
    qualitySlider.value = quality;
    document.getElementById('quality-value').textContent = quality;
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function toggleTips() {
    const container = document.getElementById('tips-container');
    const text = document.getElementById('tips-toggle-text');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        text.textContent = 'Hide shortcuts and usage tips';
    } else {
        container.style.display = 'none';
        text.textContent = 'View shortcuts and usage tips';
    }
}

function toggleSimpleMode() {
    const simpleMode = document.getElementById('simple-mode-toggle').checked;
    localStorage.setItem('simpleMode', simpleMode);

    const background = document.getElementById('background');
    if (simpleMode) {
        background.style.display = 'none';
        document.body.classList.add('simple-mode');
    } else {
        background.style.display = 'block';
        document.body.classList.remove('simple-mode');
    }
}

// Check the settings state on page load
document.addEventListener('DOMContentLoaded', function () {
    const simpleMode = localStorage.getItem('simpleMode') === 'true';
    if (simpleMode) {
        const background = document.getElementById('background');
        if (background) background.style.display = 'none';
        const toggle = document.getElementById('simple-mode-toggle');
        if (toggle) toggle.checked = true;
        document.body.classList.add('simple-mode');
    }

    // Initialize compression settings
    if (localStorage.getItem('autoCompress') === null) {
        localStorage.setItem('autoCompress', 'false');
    }
    if (localStorage.getItem('compressionQuality') === null) {
        localStorage.setItem('compressionQuality', '80');
    }
});

function toggleAutoCompress() {
    const autoCompress = document.getElementById('auto-compress-toggle').checked;
    localStorage.setItem('autoCompress', autoCompress);

    const qualityContainer = document.getElementById('compression-quality-container');
    qualityContainer.style.display = autoCompress ? 'flex' : 'none';
}

function updateCompressionQuality(value) {
    localStorage.setItem('compressionQuality', value);
    document.getElementById('quality-value').textContent = value;
}

// Generic image download function
async function downloadImageByUrl(imageUrl) {
    if (!imageUrl) return;

    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        let fileName = 'image.png';
        try {
            const url = new URL(imageUrl);
            const pathname = url.pathname;
            const lastSegment = pathname.split('/').filter(Boolean).pop();
            if (lastSegment) {
                fileName = lastSegment;
            }
        } catch (e) {
            const parts = imageUrl.split('/');
            if (parts.length > 0) {
                fileName = parts[parts.length - 1];
            }
        }

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.className = 'temp-download-link'; // Prevent triggering click-outside logic
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Failed to download image:', error);
        alert('Failed to download image, please try again');
    }
}

// Gallery preview functions
function showGallery() {
    const modal = document.getElementById('gallery-modal');
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = ''; // Clear existing content

    // Get all images from the cards
    const images = document.querySelectorAll('.card-content img');

    if (images.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-color); opacity: 0.6;">No images yet</div>';
    } else {
        images.forEach(img => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const overlay = document.createElement('div');
            overlay.className = 'gallery-item-overlay';

            // Find the corresponding card ID via the nearest card
            const cardWrapper = img.closest('.card-wrapper');
            const cardId = cardWrapper ? cardWrapper.dataset.id : null;

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'gallery-btn';
            downloadBtn.title = 'Download image';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadImageByUrl(img.src);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'gallery-btn delete';
            deleteBtn.title = 'Delete the card containing this image';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!cardId) return;

                const cardWrapperEl = document.querySelector(`.card-wrapper[data-id="${cardId}"]`);
                if (!cardWrapperEl) return;

                const deleteButtonInCard = cardWrapperEl.querySelector('.delete-button');
                if (deleteButtonInCard) {
                    await deleteCard(deleteButtonInCard);
                    item.remove();
                }
            };

            overlay.appendChild(downloadBtn);
            overlay.appendChild(deleteBtn);

            const galleryImg = document.createElement('img');
            galleryImg.src = img.src;
            galleryImg.alt = 'Gallery image';

            item.onclick = () => {
                // Don't close the gallery; just show the large image
                showImageModal(img.src);
            };

            item.appendChild(overlay);
            item.appendChild(galleryImg);
            grid.appendChild(item);
        });
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeGallery() {
    const modal = document.getElementById('gallery-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Highlight Mode Logic
let highlightedCard = null;

// Toggle highlight on a card
// Toggle highlight on a card
function highlightCard(card, smooth = true) {
    if (highlightedCard && highlightedCard !== card) {
        if (!smooth) {
            highlightedCard.style.transition = 'none';
        }
        highlightedCard.classList.remove('highlight');
        if (!smooth) {
            const prevHC = highlightedCard;
            requestAnimationFrame(() => {
                if (prevHC) prevHC.style.transition = '';
            });
        }
    }

    if (card && document.body.contains(card)) {
        highlightedCard = card;

        if (!smooth) {
            // Disable CSS transition for instant visual feedback
            const originalTransition = card.style.transition;
            card.style.transition = 'none';
            card.classList.add('highlight');
            card.scrollIntoView({ behavior: 'auto', block: 'center' });
            // Restore transition in next frame
            requestAnimationFrame(() => {
                card.style.transition = originalTransition;
            });
        } else {
            card.classList.add('highlight');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        document.body.classList.add('highlight-mode-active');
    } else {
        highlightedCard = null;
        document.body.classList.remove('highlight-mode-active');
    }
}
// Enter highlight mode: highlight the first visible card
function enterHighlightMode() {
    const cards = Array.from(document.querySelectorAll('.card-wrapper'));
    const firstVisible = cards.find(c => c.style.display !== 'none');
    if (firstVisible) {
        highlightCard(firstVisible, false);
    } // else: no cards to highlight
}

// Double click to highlight
document.addEventListener('dblclick', function (e) {
    const card = e.target.closest('.card-wrapper');
    if (card) {
        highlightCard(card);
    }
});

// Click outside to clear highlight
// Click outside to clear highlight
document.addEventListener('click', function (e) {
    // If click is not on a card or a button, and not a temporary download link, and we have a highlight
    if (!e.target.closest('.card-wrapper') &&
        !e.target.closest('.icon-button') &&
        !e.target.classList.contains('temp-download-link')) {

        if (highlightedCard) {
            highlightedCard.classList.remove('highlight');
            highlightedCard = null;
        }
    }
});


document.addEventListener('keydown', function (e) {
    // Ignore action keys if typing in input
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    // Handle the large-image modal logic first (regardless of whether a card is highlighted, since the large-image mode may have no "selected" state)
    const imageModal = document.getElementById('image-modal');
    const isImageModalOpen = imageModal && imageModal.style.display === 'block';

    if (isImageModalOpen) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeImageModal();
            return;
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            showPrevImage();
            return;
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            showNextImage();
            return;
        } else if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            openImageInNewTab();
            return;
        }
    }

    if (!highlightedCard) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            enterHighlightMode();
        }
        return;
    }

    switch (e.key) {
        case 'Enter':
            e.preventDefault();
            const content = highlightedCard.querySelector('.card-content');
            const img = content.querySelector('img');
            const link = content.querySelector('a');
            
            if (img) {
                showImageModal(img.src);
            } else if (link) {
                window.open(link.href, '_blank');
            } else {
                // For very long content, the Enter key can also expand/collapse it
                content.classList.toggle('expanded');
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            navigateCard('up');
            break;
        case 'ArrowLeft':
            e.preventDefault();
            navigateCard('left');
            break;
        case 'ArrowDown':
            e.preventDefault();
            navigateCard('down');
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateCard('right');
            break;
        case 'Delete':
        case 'Backspace':
            e.preventDefault();
            const deleteBtn = highlightedCard.querySelector('.delete-button');
            if (deleteBtn) deleteCard(deleteBtn);
            break;
        case 'd':
        case 'D':
            e.preventDefault();
            const downloadBtn = highlightedCard.querySelector('.download-button');
            if (downloadBtn) downloadCard(downloadBtn);
            break;
        case 'c':
        case 'C':
            e.preventDefault();
            const copyBtn = highlightedCard.querySelector('.copy-button') || highlightedCard.querySelector('button[onclick*="copyToClipboard"]');
            if (copyBtn) copyToClipboard(copyBtn);
            break;
        case 'e':
        case 'E':
            e.preventDefault();
            const editBtn = highlightedCard.querySelector('button[onclick*="editCard"]');
            if (editBtn) editCard(editBtn);
            break;
        case 'Escape':
            e.preventDefault();
            // If the settings modal or gallery modal is open, close them first
            const settingsModal = document.getElementById('settings-modal');
            const galleryModal = document.getElementById('gallery-modal');
            if (settingsModal && settingsModal.style.display === 'block') {
                closeSettings();
            } else if (galleryModal && galleryModal.style.display === 'block') {
                closeGallery();
            } else {
                // Only exit selection mode when all of these modals are closed
                highlightCard(null);
            }
            break;
    }
});

function navigateCard(direction) {
    if (!highlightedCard) return;

    const container = document.getElementById('card-container');
    const isGrid = container && container.classList.contains('grid-mode');

    // Helper to find linear sibling
    const getSibling = (start, dir) => {
        let target = dir === 'prev' ? start.previousElementSibling : start.nextElementSibling;
        while (target && (!target.classList.contains('card-wrapper') || target.style.display === 'none')) {
            target = dir === 'prev' ? target.previousElementSibling : target.nextElementSibling;
        }
        return target;
    };

    if (!isGrid) {
        // List Mode: Up/Left -> Prev, Down/Right -> Next
        if (direction === 'up' || direction === 'left') {
            const target = getSibling(highlightedCard, 'prev');
            if (target) highlightCard(target, false);
        } else {
            const target = getSibling(highlightedCard, 'next');
            if (target) highlightCard(target, false);
        }
        return;
    }

    // Grid Mode Logic
    if (direction === 'left') {
        const target = getSibling(highlightedCard, 'prev');
        if (target) highlightCard(target, false);
    } else if (direction === 'right') {
        const target = getSibling(highlightedCard, 'next');
        if (target) highlightCard(target, false);
    } else if (direction === 'up' || direction === 'down') {
        findGridVisibleNeighbor(highlightedCard, direction);
    }
}

function findGridVisibleNeighbor(current, direction) {
    const cards = Array.from(document.querySelectorAll('.card-wrapper'));
    const currentRect = current.getBoundingClientRect();
    const currentCenter = currentRect.left + currentRect.width / 2;

    // Filter candidates
    const candidates = cards.filter(c => {
        if (c === current) return false;
        if (c.style.display === 'none') return false;
        const r = c.getBoundingClientRect();

        // Use a small buffer to handle slight misalignments
        // Up: strictly above current top
        // Down: strictly below current top (or bottom?)

        if (direction === 'up') {
            return r.bottom <= currentRect.top + 5;
        } else {
            return r.top >= currentRect.bottom - 5;
        }
    });

    if (candidates.length === 0) return;

    let bestCandidate = null;
    let minDiffX = Infinity;
    let closestY = Infinity; // We want closest in Y dimension

    candidates.forEach(c => {
        const r = c.getBoundingClientRect();
        const center = r.left + r.width / 2;
        const diffX = Math.abs(center - currentCenter);

        // For UP, we want the LARGEST bottom (closest to current top)
        // For DOWN, we want the SMALLEST top (closest to current bottom)
        const diffY = direction === 'up'
            ? Math.abs(currentRect.top - r.bottom)
            : Math.abs(r.top - currentRect.bottom);

        // Logic: Find candidates in the "closest row", then find closest X in that row.
        // Or simpler: strictly prioritize minimal DiffX (same column), then minimal DiffY.

        // Since it's a grid, items are usually aligned in columns.
        // We look for same column (DiffX small).
        if (diffX < 20) { // Same column threshold
            if (diffY < closestY) {
                closestY = diffY;
                bestCandidate = c;
                minDiffX = diffX; // Lock into this column
            }
        } else if (closestY === Infinity) {
            // If we haven't found any in same column yet, keep track of closest global neighbor just in case
            // But actually, arrow keys should generally stick to columns. 
            // If no item in same column, maybe do nothing or jump to closest?
            // Let's stick to strict column navigation for "Grid" feel.
        }
    });

    // If no direct column neighbor, try to find physically closest one?
    if (!bestCandidate && candidates.length > 0) {
        // Fallback: simple closest distance
        let minDist = Infinity;
        candidates.forEach(c => {
            const r = c.getBoundingClientRect();
            const center = r.left + r.width / 2;
            const diffX = Math.abs(center - currentCenter);
            const dy = direction === 'up' ? currentRect.top - r.bottom : r.top - currentRect.bottom;
            const dist = Math.sqrt(diffX * diffX + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                bestCandidate = c;
            }
        });
    }

    if (bestCandidate) highlightCard(bestCandidate, false);
}


// Grid Mode Toggle Logic
function toggleGridMode() {
    const container = document.getElementById('card-container');
    if (!container) return;
    container.classList.toggle('grid-mode');

    const isGrid = container.classList.contains('grid-mode');
    localStorage.setItem('gridMode', isGrid);
    updateGridModeIcon(isGrid);
}

function updateGridModeIcon(isGrid) {
    const btn = document.getElementById('grid-mode-btn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (isGrid) {
        icon.className = 'fas fa-list';
        btn.title = "Switch to list view";
    } else {
        icon.className = 'fas fa-border-all';
        btn.title = "Switch to grid view";
    }
}

function initGridMode() {
    const savedMode = localStorage.getItem('gridMode') === 'true';
    if (savedMode) {
        const container = document.getElementById('card-container');
        if (container) container.classList.add('grid-mode');
    }
    updateGridModeIcon(savedMode);
}

// --- Custom background folder logic (IndexedDB) ---

async function openBGDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LanClipBGDB', 2); // Bump the version to add a cache store
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('backgrounds')) {
                db.createObjectStore('backgrounds', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('active_cache')) {
                db.createObjectStore('active_cache', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getBGCount(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('backgrounds', 'readonly');
        const store = tx.objectStore('backgrounds');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getBGById(db, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('backgrounds', 'readonly');
        const store = tx.objectStore('backgrounds');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getActiveCache(db) {
    return new Promise((resolve) => {
        const tx = db.transaction('active_cache', 'readonly');
        const store = tx.objectStore('active_cache');
        const request = store.get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function updateActiveCache(db, envKey, data) {
    return new Promise((resolve) => {
        const tx = db.transaction('active_cache', 'readwrite');
        const store = tx.objectStore('active_cache');
        store.put({ id: 'current', envKey: envKey, data: data });
        tx.oncomplete = () => resolve();
    });
}

async function selectBackgroundFolder() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.onchange = async (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) {
            alert('The selected folder contains no image files');
            return;
        }

        try {
            const db = await openBGDB();
            const tx = db.transaction('backgrounds', 'readwrite');
            const store = tx.objectStore('backgrounds');
            await store.clear();

            // Batch-save the raw Blobs (File objects), manually assigning 0-indexed IDs
            const savePromises = files.map((file, i) => {
                return new Promise((resolve, reject) => {
                    const txInner = db.transaction(['backgrounds', 'active_cache'], 'readwrite');
                    const request = txInner.objectStore('backgrounds').add({
                        id: i, // Force consecutive numeric IDs to allow O(1) lookups
                        name: file.name,
                        data: file
                    });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject();
                });
            });

            await Promise.all(savePromises);

            // Clear out any existing old cache
            const txCache = db.transaction('active_cache', 'readwrite');
            await txCache.objectStore('active_cache').clear();
            localStorage.setItem('hasCustomBG', 'true');
            updateBGFolderStatus();
            const url = await getRandomBackgroundImage();
            if (url) setBackgroundImage(url);
            showNotification(`Successfully loaded ${files.length} images as backgrounds`, 'success');
        } catch (err) {
            console.error(err);
            showNotification('Failed to save background images', 'error');
        }
    };
    input.click();
}

async function clearBackgroundFolder() {
    if (!confirm('Are you sure you want to clear the custom background folder?')) return;
    try {
        const db = await openBGDB();
        const tx = db.transaction('backgrounds', 'readwrite');
        await tx.objectStore('backgrounds').clear();
        localStorage.removeItem('hasCustomBG');
        localStorage.removeItem('bgManualOffset');
        updateBGFolderStatus();
        // Restore the default background
        const url = await getRandomBackgroundImage();
        if (url) setBackgroundImage(url);
        showNotification('Default background restored', 'success');
    } catch (err) {
        console.error(err);
    }
}

async function updateBGFolderStatus() {
    const info = document.getElementById('bg-folder-info');
    if (!info) return;

    if (localStorage.getItem('hasCustomBG') === 'true') {
        try {
            const db = await openBGDB();
            const count = await getBGCount(db);
            info.textContent = `${count} custom images currently loaded`;
        } catch (e) {
            info.textContent = '(Failed to load info)';
        }
    } else {
        info.textContent = '(No custom folder selected)';
        const previewContainer = document.getElementById('bg-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
    }
}

async function nextBackground() {
    const currentOffset = parseInt(localStorage.getItem('bgManualOffset')) || 0;
    localStorage.setItem('bgManualOffset', currentOffset + 1);
    const url = await getRandomBackgroundImage();
    if (url) {
        setBackgroundImage(url);
    }
}

// --- Apple-style notification system ---
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // Choose an icon based on the type
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';

    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);

    // Remove the DOM element after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3500);
}

// Export and import logic
function exportContent() {
    window.location.href = '/api/export';
}

async function importContent(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    showNotification('Importing data, please wait...', 'info');
    try {
        const response = await fetch('/api/import', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.status === 'success') {
            showNotification('Import successful, reloading shortly...', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification('Import failed: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Import Error:', error);
        showNotification('An error occurred during import, please check the archive.', 'error');
    }
}
