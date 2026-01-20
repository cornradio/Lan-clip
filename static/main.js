// 默认设置和初始化
document.documentElement.setAttribute('data-theme', 'dark');
document.getElementById('input-text').focus();

document.getElementById('input-text').focus();

// 全屏输入切换
function toggleFullscreenInput() {
    const container = document.querySelector('.input-container');
    const btn = document.getElementById('fullscreen-btn');
    const icon = btn.querySelector('i');

    container.classList.toggle('fullscreen');

    if (container.classList.contains('fullscreen')) {
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
        btn.title = "退出全屏";
        document.body.style.overflow = 'hidden'; // 防止背景滚动

        // Ensure textarea has focus
        document.getElementById('input-text').focus();
    } else {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        btn.title = "全屏编辑";
        document.body.style.overflow = '';
    }
}

// 验证密码
async function verifyPassword(inputPwd) {
    try {
        const res = await fetch('/api/verify_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: inputPwd })
        });
        const data = await res.json();
        return data.valid;
    } catch {
        return false;
    }
}

// 格式化时间戳
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

// 更新所有时间显示
function updateAllTimes() {
    document.querySelectorAll('.card-time[data-timestamp]').forEach(el => {
        const ts = parseFloat(el.dataset.timestamp);
        if (ts) el.textContent = formatTimestamp(ts);
    });
}

// 主题切换
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// 加载保存的主题
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// 清空历史记录
async function clearHistory() {
    const toggle = document.getElementById('clear-history-toggle');
    // 输入密码
    const pwd = prompt('请输入密码以确认清空历史记录:');
    if (!pwd) {
        if (toggle) toggle.checked = false;
        return;
    }

    if (await verifyPassword(pwd)) {
        try {
            const response = await fetch('/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: pwd })
            });
            if (response.ok) {
                const container = document.getElementById('card-container');
                if (container) container.innerHTML = '';
                alert('清空成功');
            } else {
                alert('清空失败');
            }
        } catch (e) {
            console.error(e);
            alert('请求出错');
        }
    } else {
        alert('密码错误，操作已取消。');
    }
    if (toggle) toggle.checked = false;
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

// 分页 & 历史显示相关变量
let currentPage = 1;
let hasMore = true;
let isLoading = false;
const PAGE_SIZE = 20;

// 旧内容访问控制（3 天前）
const OLD_DAYS_LIMIT = 3;
const VIEW_OLD_KEY = 'viewOldContentUnlocked';
let oldContentUnlocked = localStorage.getItem(VIEW_OLD_KEY) === 'true';
let hasOlderCards = false;
let oldPasswordPrompting = false;

function isCardOlderThanDays(timeStr, days) {
    if (!timeStr) return false;
    // 把 "YYYY-MM-DD HH:MM:SS" 转成浏览器更好解析的格式
    const normalized = timeStr.replace(' ', 'T');
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return false;
    const diff = Date.now() - d.getTime();
    return diff > days * 24 * 60 * 60 * 1000;
}

async function promptUnlockOldContent() {
    if (oldContentUnlocked || oldPasswordPrompting) return;
    oldPasswordPrompting = true;

    const pwd = prompt('3 天前的历史记录已保护，需要输入密码才能查看：');
    if (pwd === null) {
        oldPasswordPrompting = false;
        return;
    }

    if (await verifyPassword(pwd)) {
        localStorage.setItem(VIEW_OLD_KEY, 'true');
        oldContentUnlocked = true;
        alert('已解锁所有历史记录，将重新加载页面。');
        location.reload();
    } else {
        alert('密码错误，无法查看 3 天前的内容。');
        oldPasswordPrompting = false;
    }
}

// 在页面加载时调用这两个函数
window.onload = function () {
    loadTextFromLocalStorage();
    saveTextToLocalStorage();
    updateAllTimes();
    initGridMode();

    // 监听全屏快捷键 (Esc 退出全屏)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const container = document.querySelector('.input-container');
            // 只有在输入框全屏时才响应Esc退出
            if (container && container.classList.contains('fullscreen')) {
                toggleFullscreenInput();
            }
        }
    });

    // 首屏内容中过滤 3 天前的卡片（除非已解锁）
    if (!oldContentUnlocked) {
        try {
            const container = document.getElementById('card-container');
            if (container) {
                const wrappers = Array.from(container.querySelectorAll('.card-wrapper'));
                for (let i = 0; i < wrappers.length; i++) {
                    const timeEl = wrappers[i].querySelector('.card-time');
                    const timeText = timeEl ? timeEl.textContent.trim() : '';
                    if (isCardOlderThanDays(timeText, OLD_DAYS_LIMIT)) {
                        hasOlderCards = true;
                        // 删除这条以及后面的所有卡片（它们更老）
                        for (let j = i; j < wrappers.length; j++) {
                            wrappers[j].remove();
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            console.error('过滤旧卡片失败:', e);
        }
    }

    // 监听滚动加载 / 触发旧内容密码提示
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            if (hasMore && !isLoading) {
                loadMoreCards();
            } else if (!hasMore && hasOlderCards && !oldContentUnlocked) {
                // 没有更多新内容，但存在旧内容且未解锁
                promptUnlockOldContent();
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
                    title="${isPinned ? '取消置顶' : '置顶'}" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-thumbtack" style="${isPinned ? 'color: #ffd700; transform: rotate(45deg);' : ''}"></i>
                </button>
                <button onclick="copyToClipboard(this)" class="icon-button raw-button download-button"
                    title="复制到剪贴板" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-copy"></i>
                </button>
                <button onclick="editCard(this)" class="icon-button raw-button" title="编辑"
                    style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="downloadCard(this)" class="icon-button raw-button download-button"
                    style="padding: 4px 8px; font-size: 12px;" title="下载">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteCard(this)" class="icon-button raw-button delete-button"
                    style="padding: 4px 8px; font-size: 12px;" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <pre class="card-content">${card.content}</pre>
            <div class="card-time" data-timestamp="${card.timestamp || ''}">${displayTime}</div>
        </div>`;
}

async function refreshCards() {
    if (isLoading) return;
    isLoading = true;

    // Spin animation to indicate work
    const refreshBtn = event?.currentTarget || document.querySelector('button[title="刷新"]');
    const icon = refreshBtn?.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
        const response = await fetch(`/api/cards?page=1&size=${PAGE_SIZE}`);
        const data = await response.json();

        const container = document.getElementById('card-container');
        if (container) {
            container.innerHTML = '';
            data.cards.forEach(card => {
                if (!oldContentUnlocked && isCardOlderThanDays(card.time, OLD_DAYS_LIMIT)) {
                    hasOlderCards = true;
                    return;
                }
                container.insertAdjacentHTML('beforeend', getCardHtml(card));
            });

            currentPage = 1;
            hasMore = data.has_more;
        }
    } catch (error) {
        console.error('刷新卡片失败:', error);
    } finally {
        isLoading = false;
        if (icon) {
            setTimeout(() => icon.classList.remove('fa-spin'), 500);
        }
    }
}

async function loadMoreCards() {
    if (isLoading) return;
    isLoading = true;

    const loader = document.getElementById('main-loader');
    if (loader) loader.style.display = 'block';

    try {
        const response = await fetch(`/api/cards?page=${currentPage + 1}&size=${PAGE_SIZE}`);
        const data = await response.json();

        const container = document.getElementById('card-container');
        data.cards.forEach(card => {
            // 未解锁旧内容时，遇到 3 天前的卡片就停止继续加载
            if (!oldContentUnlocked && isCardOlderThanDays(card.time, OLD_DAYS_LIMIT)) {
                hasOlderCards = true;
                hasMore = false;
                return;
            }
            container.insertAdjacentHTML('beforeend', getCardHtml(card));
        });

        currentPage++;
        hasMore = data.has_more;
    } catch (error) {
        console.error('加载更多卡片失败:', error);
    } finally {
        isLoading = false;
        if (loader) loader.style.display = 'none';
    }
}


// 粘贴剪贴板内容
function pasteClipboard() {
    try {
        navigator.clipboard.readText()
            .then(text => {
                document.getElementById('input-text').value = text;
                document.getElementById('text-form').submit();
            })
    }
    catch {
        alert('http 网站无法直接粘贴 ');
    }
}

// Ctrl Enter键提交
document.getElementById('input-text').addEventListener('keydown', function (e) {
    console.log(e.key)
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault(); // 阻止默认的换行行为
        //press button #add-btn
        document.querySelector('#add-btn').click();
    }
    //F1 js
    if (e.key === 'F1') {
        e.preventDefault(); // 阻止默认的换行行为
        //<textarea id="input-text" 增加 script tag
        const textarea = document.querySelector('textarea[name="text"]');
        textarea.value = `<script>

</script>
<style>

</style>`;

    }
    //F2 sytyle
    if (e.key === 'F2') {
        e.preventDefault(); // 阻止默认的换行行为
        //<textarea id="input-text" 增加 sytle tag
        const textarea = document.querySelector('textarea[name="text"]');
        textarea.value = `<iframe>

</iframe>`;
    }
});


// 监听粘贴事件
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

// 上传进度相关（真实进度）
let currentUploadPercent = 0;
let uploadProgressVisible = false;
const UPLOAD_PROGRESS_MIN_SIZE = 2000 * 1024; // 2M 以上显示进度窗

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
        ? `准备上传 ${totalCount} 个文件...`
        : '正在上传文件...';

    uploadProgressVisible = true;
}

function updateUploadProgress(doneCount, totalCount) {
    const barInner = document.getElementById('upload-progress-inner');
    const statusText = document.getElementById('upload-status-text');
    if (!uploadProgressVisible || !barInner || !statusText || totalCount === 0) return;

    const percent = Math.round((doneCount / totalCount) * 100);
    currentUploadPercent = percent;
    barInner.style.width = `${percent}%`;
    statusText.textContent = `正在上传 (${Math.min(doneCount, totalCount).toFixed(1).replace(/\.0$/, '')}/${totalCount})...`;
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
    if (statusText) statusText.textContent = '上传完成';

    uploadProgressVisible = false;

    // 稍微停顿一下再关闭，让用户能看到 100%
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 400);
}

// 使用 XHR 支持上传进度
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

// 图片上传相关函数
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

        // 一次处理一个文件
        let doneCount = 0;
        for (let file of fileArray) {
            // 如果开启了自动压缩且是图片
            if (autoCompress && file.type.startsWith('image/')) {
                console.log(`正在压缩图片: ${file.name}, 质量: ${quality}%`);
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

                // 为每个文件单独提交
                const textarea = document.querySelector('textarea[name="text"]');
                textarea.value = content;
                document.querySelector('#add-btn').click();
            }

            doneCount++;
            updateUploadProgress(doneCount, fileArray.length);
        }
    } catch (error) {
        console.error('上传出错:', error);
    } finally {
        hideUploadProgress();
    }
}

// 图片压缩函数
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

                // 保持原始尺寸
                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 转换为 jpeg 进行压缩
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}


// 文件上传相关函数
async function uploadFiles(files) {
    const fileArray = Array.from(files);
    console.log('转换后的文件数组:', fileArray); // 调试用
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

                    // 使用 API 提交而不是点击按钮
                    const addResponse = await fetch('/api/add_card', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text: fileLink })
                    });
                    const addResult = await addResponse.json();

                    // 直接在前端添加新卡片
                    addCardToPage(fileLink, addResult.id);
                }
            } catch (error) {
                console.error('文件上传失败:', error);
                showUploadError(error);
            }
            doneCount++;
            updateUploadProgress(doneCount, fileArray.length);
        }
    } finally {
        hideUploadProgress();
    }
}

// 生成文件链接
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

// 在页面中添加新卡片
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

    // 插入逻辑：插入到所有置顶卡片之后，或者容器的最前面
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

// 显示上传错误
function showUploadError(error) {
    alert(`文件上传失败: ${error.message}`);
}


// 工具函数
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

// 拖放相关
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

// 卡片操作相关函数
async function editCard(button) {
    const cardWrapper = button.closest('.card-wrapper');
    const content = cardWrapper.querySelector('.card-content').innerText;

    // 1. 将内容放入输入框
    const textarea = document.getElementById('input-text');
    textarea.value = content;
    localStorage.setItem('input-text-content', content);

    // 2. 滚动到顶部并聚焦
    window.scrollTo({ top: 0, behavior: 'smooth' });
    textarea.focus();

    // 3. 删除原卡片
    await deleteCard(button);
}

async function deleteCard(button) {
    const cardWrapper = button.closest('.card-wrapper');
    const cardId = cardWrapper.dataset.id;

    // 1. 立即执行动画（乐观更新）
    // 防止重复点击
    if (cardWrapper.classList.contains('fade-out')) return;

    // 如果删除的是当前高亮的卡片，尝试高亮下一张
    if (highlightedCard === cardWrapper) {
        let target = cardWrapper.nextElementSibling;
        if (!target || !target.classList.contains('card-wrapper')) {
            target = cardWrapper.previousElementSibling;
        }
        if (target && target.classList.contains('card-wrapper')) {
            highlightCard(target);
        } else {
            highlightCard(null);
        }
    }

    cardWrapper.classList.add('fade-out');

    // 2. 动画结束后移除元素
    setTimeout(() => {
        cardWrapper.remove();
    }, 500);

    try {
        const response = await fetch('/delete_card', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: cardId
            })
        });

        const result = await response.json();
        if (result.status !== 'success') {
            throw new Error(result.message || '未知错误');
        }
    } catch (error) {
        console.error('删除出错:', error);
        // 如果删除失败，为了数据一致性，建议刷新
        alert('删除失败，页面将刷新已恢复数据');
        location.reload();
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: cardId })
        });
        const data = await response.json();

        if (data.status === 'success') {
            const container = document.getElementById('card-container');
            if (isPinned) {
                // 取消置顶
                cardWrapper.classList.remove('pinned');
                icon.style.color = '';
                icon.style.transform = '';
                button.title = '置顶';

                // 移动到应有的位置：按 ID 倒序排列。
                // 找到第一个非置顶且 ID 比它小的卡片，插在它前面。
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
                    // 如果没找到比它小的，插到最后
                    container.appendChild(cardWrapper);
                }
            } else {
                // 置顶
                cardWrapper.classList.add('pinned');
                icon.style.color = '#ffd700';
                icon.style.transform = 'rotate(45deg)';
                button.title = '取消置顶';

                // 移动到顶部（第一个非置顶卡片之前）
                const firstUnpinned = container.querySelector('.card-wrapper:not(.pinned)');
                if (firstUnpinned) {
                    container.insertBefore(cardWrapper, firstUnpinned);
                } else {
                    container.appendChild(cardWrapper);
                }
            }

            // 滚动到该卡片位置
            cardWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } else {
            alert('操作失败: ' + (data.message || ''));
        }
    } catch (e) {
        console.error(e);
        alert('请求出错');
    }
}

// 初始化卡片检查 - 隐藏图片和文件的 "查看原始内容" 按钮
// document.addEventListener('DOMContentLoaded', function() {
//     const cardWrappers = document.querySelectorAll('.card-wrapper');
//     cardWrappers.forEach(wrapper => {
//         const content = wrapper.querySelector('.card-content').innerHTML;
//         const hasImageOrFile = content.includes('<img') || content.includes('file-card');
//         const rawButton = wrapper.querySelector('.raw-button[title="查看原始内容"]');
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
            // 处理图片下载
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
            // 处理文件下载 - 使用 fetch 获取文件内容
            const response = await fetch(fileLink.href);
            const blob = await response.blob();

            // 从文件卡片中获取原始文件名
            const fileName = fileLink.textContent;

            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.className = 'temp-download-link';
            a.href = url;
            a.download = fileName; // 使用原始文件名
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } else {
            // 处理文本内容下载
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

        // 显示下载成功反馈
        button.title = '下载成功！';
        button.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
            button.title = '下载';
            button.style.backgroundColor = '';
        }, 1000);

    } catch (error) {
        console.error('下载失败:', error);
        button.title = '下载失败';
        button.style.backgroundColor = '#f44336';
        setTimeout(() => {
            button.title = '下载';
            button.style.backgroundColor = '';
        }, 1000);
    }
}

// 处理输入
function processInput(input) {
    var outstr = input.trim();
    // 使用正则表达式匹配所有链接
    outstr = outstr.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    return outstr;
}

async function addCard() {
    const textarea = document.querySelector('#input-text');
    let content = textarea.value;
    content = processInput(content);
    textarea.value = ''; // 清空输入框 同步ls保存 避免残留

    if (!content) return;

    try {
        const response = await fetch('/api/add_card', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: content })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // 创建新卡片
            const cardContainer = document.querySelector('.card');
            const newCard = document.createElement('div');
            newCard.className = 'card-wrapper';
            newCard.dataset.id = result.id;
            const timeStr = getCurrentFormattedTime();
            const timestamp = Date.now() / 1000;

            newCard.innerHTML = `
                <div class="card-header">
                    <button onclick="copyToClipboard(this)" class="icon-button raw-button download-button" title="复制到剪贴板" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="editCard(this)" class="icon-button raw-button" title="编辑" style="padding: 4px 8px; font-size: 12px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="downloadCard(this)" class="icon-button raw-button download-button" style="padding: 4px 8px; font-size: 12px;" title="下载">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="deleteCard(this)" class="icon-button raw-button delete-button" style="padding: 4px 8px; font-size: 12px;" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <pre class="card-content">${content}</pre>
                <div class="card-time" data-timestamp="${timestamp}">${timeStr}</div>
            `;

            // 将新卡片插入到最前面
            cardContainer.insertBefore(newCard, cardContainer.firstChild);

            // 清空输入框 和历史记录
            textarea.value = '';
            localStorage.setItem('input-text-content', '');
        } else {
            console.error('添加失败:', result.message);
        }
    } catch (error) {
        console.error('添加出错:', error);
    }
}


// 定义一个包含远程图片链接的列表
const imageUrls = [
    // 'static/bg.jpg',
    // 'static/2.jpg',
    'static/39.jpg',
    'static/16.jpg',
    'static/5.jpg'
    // 添加更多图片链接
];

// 定义一个函数来获取随机背景图片 (基于日期和手动偏移的“每日一图”)
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

        // 计算当前环境的标识符 (日期 + 偏移量)
        const now = new Date();
        const dateKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        const manualOffset = parseInt(localStorage.getItem('bgManualOffset')) || 0;
        const currentEnvKey = `${dateKey}_${manualOffset}`;

        // 1. 尝试从强缓存中读取
        const cached = await getActiveCache(db);
        if (cached && cached.envKey === currentEnvKey) {
            console.log('从快捷缓存加载背景');
            return URL.createObjectURL(cached.data);
        }

        // 2. 缓存失效或不存在，重新计算
        const totalCount = await getBGCount(db);
        if (totalCount === 0) return imageUrls[0];

        let dateSeed = 0;
        for (let i = 0; i < dateKey.length; i++) dateSeed += dateKey.charCodeAt(i);
        const index = Math.abs(dateSeed + manualOffset) % totalCount;

        // 使用 O(1) 的 ID 查询
        const bgRecord = await getBGById(db, index);
        if (bgRecord && bgRecord.data) {
            // 更新强缓存，以便下次“瞬发”加载
            await updateActiveCache(db, currentEnvKey, bgRecord.data);
            return URL.createObjectURL(bgRecord.data);
        }
    } catch (e) {
        console.error('加载自定义背景失败:', e);
    }

    return imageUrls[0];
}

// 获取背景元素
const backgroundElement = document.getElementById('background');

let currentBGObjectURL = null;

// 定义一个函数来设置背景图片
function setBackgroundImage(url) {
    // 释放旧的 ObjectURL 避免内存泄漏
    if (currentBGObjectURL && currentBGObjectURL.startsWith('blob:')) {
        URL.revokeObjectURL(currentBGObjectURL);
    }
    currentBGObjectURL = url;

    backgroundElement.style.backgroundImage = `url(${url})`;
    // 同步更新设置页面的预览图
    const previewImg = document.getElementById('bg-preview-img');
    const previewContainer = document.getElementById('bg-preview-container');
    if (previewImg && previewContainer) {
        previewImg.src = url;
        previewContainer.style.display = 'block';
    }
}
// 调用函数并设置背景图片
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
        button.style.backgroundColor = '#FF0000'; // 设置为红色
        setTimeout(() => {
            button.style.backgroundColor = ''; // 恢复原始颜色
        }, 500); // 闪烁持续时间为500毫秒
        return;
    } else {
        // 复制文本内容
        const cardContent = contentElement.innerText.trim();
        copyTextToClipboard(cardContent);
        alert('文本已复制到剪贴板');
    }

    // 闪烁按钮绿色
    button.style.backgroundColor = '#4CAF50'; // 设置为绿色
    setTimeout(() => {
        button.style.backgroundColor = ''; // 恢复原始颜色
    }, 500); // 闪烁持续时间为500毫秒
}

function copyTextToClipboard(text) {
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = text;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextarea);
}

// 添加图片导航相关变量和函数
let currentImageIndex = 0;
let imageList = [];

// 修改showImageModal函数
function showImageModal(imageSrc) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalBody = document.querySelector('.image-modal-body');
    const currentImageNumber = document.getElementById('current-image-number');
    const totalImages = document.getElementById('total-images');

    // 获取所有图片
    imageList = Array.from(document.querySelectorAll('.card-content img')).map(img => img.src);
    currentImageIndex = imageList.indexOf(imageSrc);

    // 更新图片
    modalImage.src = imageSrc;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 更新计数器
    currentImageNumber.textContent = currentImageIndex + 1;
    totalImages.textContent = imageList.length;

    // 如果只有一张图片，添加single-image类
    if (imageList.length === 1) {
        modalBody.classList.add('single-image');
    } else {
        modalBody.classList.remove('single-image');
    }

    // 点击模态窗背景关闭
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeImageModal();
        }
    });

    // 键盘快捷键
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeImageModal();
        } else if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
            openImageInNewTab();
        } else if (e.key === 'ArrowLeft') {
            showPrevImage();
        } else if (e.key === 'ArrowRight') {
            showNextImage();
        }
    });
}

// 修改showPrevImage函数
function showPrevImage() {
    if (imageList.length <= 1) return;

    currentImageIndex = (currentImageIndex - 1 + imageList.length) % imageList.length;
    const modalImage = document.getElementById('modal-image');
    const currentImageNumber = document.getElementById('current-image-number');

    modalImage.src = imageList[currentImageIndex];
    currentImageNumber.textContent = currentImageIndex + 1;

    // 添加过渡动画
    modalImage.style.opacity = '0';
    setTimeout(() => {
        modalImage.style.opacity = '1';
    }, 50);
}

// 修改showNextImage函数
function showNextImage() {
    if (imageList.length <= 1) return;

    currentImageIndex = (currentImageIndex + 1) % imageList.length;
    const modalImage = document.getElementById('modal-image');
    const currentImageNumber = document.getElementById('current-image-number');

    modalImage.src = imageList[currentImageIndex];
    currentImageNumber.textContent = currentImageIndex + 1;

    // 添加过渡动画
    modalImage.style.opacity = '0';
    setTimeout(() => {
        modalImage.style.opacity = '1';
    }, 50);
}

// 修改closeImageModal函数
function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.style.display = 'none';

    // 如果图册模态窗没有显示，才恢复背景滚动
    const galleryModal = document.getElementById('gallery-modal');
    if (galleryModal.style.display !== 'block') {
        document.body.style.overflow = '';
    }

    // 清除图片列表
    imageList = [];
    currentImageIndex = 0;
}

// 为所有图片添加点击事件
document.addEventListener('DOMContentLoaded', function () {
    // 为现有的图片添加点击事件
    document.querySelectorAll('.card-content img').forEach(img => {
        img.onclick = function () {
            showImageModal(this.src);
        };
    });

    // 监听新添加的卡片
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) { // 元素节点
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

    // 开始观察卡片容器
    const cardContainer = document.querySelector('.card');
    if (cardContainer) {
        observer.observe(cardContainer, {
            childList: true,
            subtree: true
        });
    }
});

// 添加打开图片的函数
function openImageInNewTab() {
    const modalImage = document.getElementById('modal-image');
    if (modalImage && modalImage.src) {
        window.open(modalImage.src, '_blank');
    }
}

// 下载当前预览的图片
async function downloadCurrentImage() {
    const modalImage = document.getElementById('modal-image');
    if (!modalImage || !modalImage.src) return;
    await downloadImageByUrl(modalImage.src);
}

// 设置相关函数
function showSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 设置简洁模式开关状态
    const simpleModeToggle = document.getElementById('simple-mode-toggle');
    simpleModeToggle.checked = localStorage.getItem('simpleMode') === 'true';

    // 更新自定义背景信息
    updateBGFolderStatus();

    // 设置自动压缩开关状态
    const autoCompressToggle = document.getElementById('auto-compress-toggle');
    const autoCompress = localStorage.getItem('autoCompress') === 'true';
    autoCompressToggle.checked = autoCompress;

    // 显示/隐藏压缩质量容器
    const qualityContainer = document.getElementById('compression-quality-container');
    qualityContainer.style.display = autoCompress ? 'flex' : 'none';

    // 设置压缩质量滑块
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
        text.textContent = '隐藏快捷键与操作提示';
    } else {
        container.style.display = 'none';
        text.textContent = '查看快捷键与操作提示';
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

// 页面加载时检查设置状态
document.addEventListener('DOMContentLoaded', function () {
    const simpleMode = localStorage.getItem('simpleMode') === 'true';
    if (simpleMode) {
        const background = document.getElementById('background');
        if (background) background.style.display = 'none';
        const toggle = document.getElementById('simple-mode-toggle');
        if (toggle) toggle.checked = true;
        document.body.classList.add('simple-mode');
    }

    // 初始化压缩设置
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

// 通用图片下载函数
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
        console.error('下载图片失败:', error);
        alert('下载图片失败，请重试');
    }
}

// 图册预览相关函数
function showGallery() {
    const modal = document.getElementById('gallery-modal');
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = ''; // 清空现有内容

    // 获取所有卡片中的图片
    const images = document.querySelectorAll('.card-content img');

    if (images.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-color); opacity: 0.6;">暂无图片</div>';
    } else {
        images.forEach(img => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const overlay = document.createElement('div');
            overlay.className = 'gallery-item-overlay';

            // 通过最近的卡片找到对应的卡片 ID
            const cardWrapper = img.closest('.card-wrapper');
            const cardId = cardWrapper ? cardWrapper.dataset.id : null;

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'gallery-btn';
            downloadBtn.title = '下载图片';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadImageByUrl(img.src);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'gallery-btn delete';
            deleteBtn.title = '删除这张图所在卡片';
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
            galleryImg.alt = '图册图片';

            item.onclick = () => {
                // 不再关闭图册，直接显示大图
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
function highlightCard(card) {
    if (highlightedCard && highlightedCard !== card) {
        highlightedCard.classList.remove('highlight');
    }

    if (card && document.body.contains(card)) {
        highlightedCard = card;
        card.classList.add('highlight');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.body.classList.add('highlight-mode-active');
    } else {
        highlightedCard = null;
        document.body.classList.remove('highlight-mode-active');
    }
}
// Enter highlight mode: highlight the first card
function enterHighlightMode() {
    const firstCard = document.querySelector('.card-wrapper');
    if (firstCard) {
        highlightCard(firstCard);
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
    if (!highlightedCard) return;

    // Ignore action keys if typing in input
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch (e.key) {
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
            highlightCard(null);
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
        while (target && !target.classList.contains('card-wrapper')) {
            target = dir === 'prev' ? target.previousElementSibling : target.nextElementSibling;
        }
        return target;
    };

    if (!isGrid) {
        // List Mode: Up/Left -> Prev, Down/Right -> Next
        if (direction === 'up' || direction === 'left') {
            const target = getSibling(highlightedCard, 'prev');
            if (target) highlightCard(target);
        } else {
            const target = getSibling(highlightedCard, 'next');
            if (target) highlightCard(target);
        }
        return;
    }

    // Grid Mode Logic
    if (direction === 'left') {
        const target = getSibling(highlightedCard, 'prev');
        if (target) highlightCard(target);
    } else if (direction === 'right') {
        const target = getSibling(highlightedCard, 'next');
        if (target) highlightCard(target);
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

    if (bestCandidate) highlightCard(bestCandidate);
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
        btn.title = "切换列表视图";
    } else {
        icon.className = 'fas fa-border-all';
        btn.title = "切换网格视图";
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

// --- 自定义背景文件夹逻辑 (IndexedDB) ---

async function openBGDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LanClipBGDB', 2); // 升级版本以增加缓存表
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
            alert('选择的文件夹中没有图片文件');
            return;
        }

        try {
            const db = await openBGDB();
            const tx = db.transaction('backgrounds', 'readwrite');
            const store = tx.objectStore('backgrounds');
            await store.clear();

            // 批量保存原始 Blob (File 对象)，手动指定 0-indexed ID
            const savePromises = files.map((file, i) => {
                return new Promise((resolve, reject) => {
                    const txInner = db.transaction(['backgrounds', 'active_cache'], 'readwrite');
                    const request = txInner.objectStore('backgrounds').add({
                        id: i, // 强制使用连续数字 ID，方便 O(1) 查询
                        name: file.name,
                        data: file
                    });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject();
                });
            });

            await Promise.all(savePromises);

            // 清理掉可能存在的旧缓存
            const txCache = db.transaction('active_cache', 'readwrite');
            await txCache.objectStore('active_cache').clear();
            localStorage.setItem('hasCustomBG', 'true');
            updateBGFolderStatus();
            const url = await getRandomBackgroundImage();
            if (url) setBackgroundImage(url);
            alert(`成功加载 ${files.length} 张图片作为背景`);
        } catch (err) {
            console.error(err);
            alert('保存背景图片失败');
        }
    };
    input.click();
}

async function clearBackgroundFolder() {
    if (!confirm('确定要清除自定义背景文件夹吗？')) return;
    try {
        const db = await openBGDB();
        const tx = db.transaction('backgrounds', 'readwrite');
        await tx.objectStore('backgrounds').clear();
        localStorage.removeItem('hasCustomBG');
        localStorage.removeItem('bgManualOffset');
        updateBGFolderStatus();
        // 恢复默认背景
        const url = await getRandomBackgroundImage();
        if (url) setBackgroundImage(url);
        alert('已恢复默认背景');
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
            info.textContent = `当前已加载 ${count} 张自定义图片`;
        } catch (e) {
            info.textContent = '(加载信息失败)';
        }
    } else {
        info.textContent = '(未选择自定义文件夹)';
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
