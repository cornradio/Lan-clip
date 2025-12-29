// 默认设置和初始化
document.documentElement.setAttribute('data-theme', 'dark');
document.getElementById('input-text').focus();

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
function clearHistory() {
    // 输入密码
    x = prompt('请输入密码以确认清空历史记录:');
    if (x !== '1230') {
        alert('密码错误，操作已取消。');
        return;
    }
    else {
        fetch('/clear', { method: 'POST' })
        document.querySelector('.card').innerHTML = '';
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

// 分页相关变量
let currentPage = 1;
let hasMore = true;
let isLoading = false;
const PAGE_SIZE = 20;

// 在页面加载时调用这两个函数
window.onload = function () {
    loadTextFromLocalStorage();
    saveTextToLocalStorage();

    // 监听滚动加载
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            if (hasMore && !isLoading) {
                loadMoreCards();
            }
        }
    });
};

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
            const cardHtml = `
                <div class="card-wrapper" data-id="${card.id}">
                    <div class="card-header">
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
                    <div class="card-time">${card.time}</div>
                </div>`;
            container.insertAdjacentHTML('beforeend', cardHtml);
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
        // 一次处理一个文件
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

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const imageUrl = await response.text();
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
        }
    } catch (error) {
        console.error('上传出错:', error);
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

    for (const file of fileArray) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload_file', {
                method: 'POST',
                body: formData
            });

            const fileUrl = await response.text();
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
    const cardContainer = document.querySelector('.card');
    const newCard = document.createElement('div');
    newCard.className = 'card-wrapper';
    newCard.dataset.id = id;
    const timeStr = getCurrentFormattedTime();
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
        <pre class="card-content" style="text-align: left; align-self: flex-start;">${fileLink}</pre>
        <div class="card-time">${timeStr}</div>
    `;
    cardContainer.insertBefore(newCard, cardContainer.firstChild);
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
        if (result.status === 'success') {
            cardWrapper.remove();
        } else {
            alert('删除失败：' + result.message);
        }
    } catch (error) {
        console.error('删除出错:', error);
        alert('删除失败，请重试');
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
                <div class="card-time">${timeStr}</div>
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

// 定义一个函数来获取随机背景图片
async function getRandomBackgroundImage() {
    // 从列表中随机选择一个图片链接
    const randomIndex = Math.floor(Math.random() * imageUrls.length);
    const randomImageUrl = imageUrls[randomIndex];

    // 返回图片的 URL
    return randomImageUrl;
}

// 获取背景元素
const backgroundElement = document.getElementById('background');

// 定义一个函数来设置背景图片
function setBackgroundImage(url) {
    backgroundElement.style.backgroundImage = `url(${url})`;
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

// 设置相关函数
function showSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 设置简洁模式开关状态
    const simpleModeToggle = document.getElementById('simple-mode-toggle');
    simpleModeToggle.checked = localStorage.getItem('simpleMode') === 'true';

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

function toggleSimpleMode() {
    const simpleMode = document.getElementById('simple-mode-toggle').checked;
    localStorage.setItem('simpleMode', simpleMode);

    const background = document.getElementById('background');
    if (simpleMode) {
        background.style.display = 'none';
    } else {
        background.style.display = 'block';
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

            const galleryImg = document.createElement('img');
            galleryImg.src = img.src;
            galleryImg.alt = '图册图片';

            item.onclick = () => {
                // 不再关闭图册，直接显示大图
                showImageModal(img.src);
            };

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

