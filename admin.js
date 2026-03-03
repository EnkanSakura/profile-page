// 后台管理界面交互脚本
// 基于 Cloudflare Workers + D1 架构

let currentConfig = {};
let originalConfig = {};  // 保存原始配置用于对比
let avatarUrlInputCount = 0;
let socialLinkCount = 0;
let isDevEnvironment = false;

// 页面加载
document.addEventListener('DOMContentLoaded', function() {
    checkEnvironment();
    checkAuthToken();
    loadConfig();
    setupEventListeners();
});

// 检查 Token 是否有效
function checkAuthToken() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        // 设置默认 Token
        localStorage.setItem('adminToken', 'enkansakura');
    }
}

// 检查环境
function checkEnvironment() {
    const envIndicator = document.getElementById('envIndicator');
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('.dev.')) {
        isDevEnvironment = true;
        if (envIndicator) envIndicator.textContent = 'DEV';
    } else {
        if (envIndicator) envIndicator.textContent = 'PROD';
    }
}

// 加载配置
function loadConfig() {
    fetch('/api/config')
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            if (data.success && data.config) {
                currentConfig = data.config;
                // 保存原始配置用于对比
                originalConfig = JSON.parse(JSON.stringify(data.config));
                loadConfigToForm();
                showNotification('配置加载成功', 'success');
            } else {
                throw new Error('配置数据无效');
            }
        })
        .catch(function(error) {
            showNotification('加载失败：' + error.message, 'error');
        });
}

// 加载配置到表单
function loadConfigToForm() {
    // 确保所有配置组都存在
    currentConfig.profile = currentConfig.profile || {};
    currentConfig.socialLinks = currentConfig.socialLinks || [];
    currentConfig.appearance = currentConfig.appearance || {};
    currentConfig.effects = currentConfig.effects || {};
    currentConfig.security = currentConfig.security || {};
    
    // 基本信息
    document.getElementById('username').value = currentConfig.profile.username || '';
    document.getElementById('bio').value = currentConfig.profile.bio || '';

    // 头像 URL 列表
    var avatarContainer = document.getElementById('avatarUrlsContainer');
    avatarContainer.innerHTML = '';
    avatarUrlInputCount = 0;

    var avatarUrls = currentConfig.profile.avatarUrls || [];
    if (avatarUrls.length > 0) {
        avatarUrls.forEach(function(url) {
            createAvatarUrlInput(url);
        });
    } else {
        createAvatarUrlInput('');
    }
    updateAvatarPreviewGrid(avatarUrls);

    // 社交链接
    renderSocialLinks(currentConfig.socialLinks);

    // 外观设置
    document.getElementById('backgroundImage').value = currentConfig.appearance.backgroundImage || '';
    updateBgPreview(currentConfig.appearance.backgroundImage, 'bgPreview');
    document.getElementById('portraitBackgroundImage').value = currentConfig.appearance.portraitBackgroundImage || '';
    updateBgPreview(currentConfig.appearance.portraitBackgroundImage, 'portraitBgPreview');

    document.getElementById('overlayOpacity').value = currentConfig.appearance.overlayOpacity || 0.4;
    document.getElementById('backdropBlur').value = currentConfig.appearance.backdropBlur || 10;
    document.getElementById('cardOpacity').value = currentConfig.appearance.cardOpacity || 0.15;
    document.getElementById('footer').value = currentConfig.appearance.footer || '';

    // 更新滑块显示值
    updateSliderValue('overlayOpacity', 'overlayOpacityValue');
    updateSliderValue('backdropBlur', 'backdropBlurValue');
    updateSliderValue('cardOpacity', 'cardOpacityValue');

    // 动态效果
    document.getElementById('effectsEnabled').checked = currentConfig.effects.enabled !== false;
    document.getElementById('rotationIntensity').value = currentConfig.effects.rotationIntensity || 1.0;
    document.getElementById('parallaxIntensity').value = currentConfig.effects.parallaxIntensity || 1.0;
    document.getElementById('recoveryDuration').value = currentConfig.effects.recoveryDuration || 500;

    // 更新动态效果滑块显示值
    updateSliderValue('rotationIntensity', 'rotationIntensityValue');
    updateSliderValue('parallaxIntensity', 'parallaxIntensityValue');
    updateSliderValue('recoveryDuration', 'recoveryDurationValue');

    // 安全设置 - 确保正确加载数据库中的值
    var security = currentConfig.security || {};
    document.getElementById('disableRightClick').checked = security.disableRightClick !== false;
    document.getElementById('disableDevTools').checked = security.disableDevTools === true;
}

// 更新滑块显示值
function updateSliderValue(sliderId, valueId) {
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(valueId);
    if (slider && valueSpan) {
        valueSpan.textContent = slider.value;
    }
}

// 渲染社交链接
function renderSocialLinks(links) {
    const container = document.getElementById('socialLinksContainer');
    container.innerHTML = '';
    socialLinkCount = 0;

    links.forEach(function(link, index) {
        createSocialLinkCard(link, index);
    });
}

// 创建社交链接卡片
function createSocialLinkCard(link, index) {
    const container = document.getElementById('socialLinksContainer');
    const cardId = socialLinkCount++;

    const card = document.createElement('div');
    card.className = 'social-link-card compact';
    card.dataset.index = index;
    card.innerHTML = `
        <div class="compact-grid">
            <div class="compact-field">
                <label>名称</label>
                <input type="text" class="link-name" value="${link.name || ''}" placeholder="GitHub" />
            </div>
            <div class="compact-field">
                <label>链接</label>
                <input type="text" class="link-url" value="${link.url || ''}" placeholder="https://github.com/yourname" />
            </div>
            <div class="compact-field">
                <label>图标类名</label>
                <input type="text" class="link-icon" value="${link.icon || ''}" placeholder="fab fa-github" />
            </div>
            <div class="compact-field">
                <label>背景颜色</label>
                <div class="color-picker-compact">
                    <input type="color" class="link-color-picker" value="${rgbaToHex(link.color || 'rgba(51, 51, 51, 0.8)')}" />
                    <input type="text" class="link-color" value="${link.color || 'rgba(51, 51, 51, 0.8)'}" />
                    <span class="color-preview-compact" style="background: ${link.color || 'rgba(51, 51, 51, 0.8)'}"></span>
                </div>
            </div>
            <div class="compact-field full-width">
                <label>链接预览</label>
                <div class="link-preview" style="background: ${link.color || 'rgba(51, 51, 51, 0.8)'}">
                    <i class="${link.icon || 'fas fa-link'}"></i>
                    <span>${link.name || 'Link'}</span>
                </div>
            </div>
        </div>
        <div class="social-link-actions">
            <button class="btn btn-primary btn-sm" onclick="moveLinkUp(${index})"><i class="fas fa-arrow-up"></i> 上移</button>
            <button class="btn btn-primary btn-sm" onclick="moveLinkDown(${index})"><i class="fas fa-arrow-down"></i> 下移</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSocialLink(${index})"><i class="fas fa-trash"></i> 删除</button>
        </div>
    `;

    // 绑定颜色选择器事件
    const colorPicker = card.querySelector('.link-color-picker');
    const colorInput = card.querySelector('.link-color');
    const colorPreview = card.querySelector('.color-preview-compact');
    const linkPreview = card.querySelector('.link-preview');
    const linkIcon = card.querySelector('.link-preview i');

    colorPicker.addEventListener('input', function(e) {
        const hex = e.target.value;
        const rgba = hexToRgba(hex, 0.8);
        colorInput.value = rgba;
        colorPreview.style.background = rgba;
        linkPreview.style.background = rgba;
    });

    colorInput.addEventListener('input', function(e) {
        colorPreview.style.background = e.target.value;
        linkPreview.style.background = e.target.value;
    });

    // 绑定名称和图标变化更新预览
    const nameInput = card.querySelector('.link-name');
    const iconInput = card.querySelector('.link-icon');
    
    nameInput.addEventListener('input', function(e) {
        linkPreview.querySelector('span').textContent = e.target.value || 'Link';
    });
    
    iconInput.addEventListener('input', function(e) {
        linkPreview.querySelector('i').className = e.target.value || 'fas fa-link';
    });

    container.appendChild(card);
}

// 添加社交链接
function addSocialLink() {
    const newLink = {
        name: 'New Link',
        url: 'https://',
        icon: 'fas fa-link',
        color: 'rgba(102, 126, 234, 0.8)'
    };
    createSocialLinkCard(newLink, currentConfig.socialLinks.length);
}

// 删除社交链接
function deleteSocialLink(index) {
    if (confirm('确定要删除这个链接吗？')) {
        const cards = document.querySelectorAll('.social-link-card');
        if (index < cards.length) {
            cards[index].remove();
            collectFormConfig();
        }
    }
}

// 上移链接
function moveLinkUp(index) {
    const cards = document.querySelectorAll('.social-link-card');
    if (index > 0 && index < cards.length) {
        cards[index - 1].before(cards[index]);
        collectFormConfig();
    }
}

// 下移链接
function moveLinkDown(index) {
    const cards = document.querySelectorAll('.social-link-card');
    if (index >= 0 && index < cards.length - 1) {
        cards[index + 1].after(cards[index]);
        collectFormConfig();
    }
}

// 创建头像 URL 输入框
function createAvatarUrlInput(url) {
    var container = document.getElementById('avatarUrlsContainer');
    var index = avatarUrlInputCount++;

    var group = document.createElement('div');
    group.className = 'avatar-url-input-group';
    group.dataset.index = index;
    group.innerHTML = `
        <input type="text" class="avatar-url-input" value="${url || ''}" placeholder="https://..." />
        <button class="btn btn-remove-sm" title="删除">
            <i class="fas fa-trash"></i>
        </button>
    `;

    const input = group.querySelector('.avatar-url-input');
    const deleteBtn = group.querySelector('.btn-remove-sm');
    
    input.addEventListener('input', updateAvatarPreviewGridFromInputs);
    deleteBtn.addEventListener('click', function() {
        removeAvatarUrlInput(group);
    });

    container.appendChild(group);
}

// 添加头像 URL 输入框
function addAvatarUrlInput() {
    createAvatarUrlInput('');
    updateAvatarPreviewGridFromInputs();
}

// 删除头像 URL 输入框
function removeAvatarUrlInput(group) {
    var container = document.getElementById('avatarUrlsContainer');
    var inputs = container.querySelectorAll('.avatar-url-input-group');
    if (inputs.length <= 1) {
        alert('至少保留一个头像 URL');
        return;
    }
    group.remove();
    updateAvatarPreviewGridFromInputs();
}

// 从输入框更新预览网格
function updateAvatarPreviewGridFromInputs() {
    var container = document.getElementById('avatarUrlsContainer');
    var inputs = container.querySelectorAll('.avatar-url-input');
    var urls = [];
    inputs.forEach(function(input) {
        if (input.value && input.value.trim()) {
            urls.push(input.value.trim());
        }
    });
    updateAvatarPreviewGrid(urls);
}

// 更新头像预览网格
function updateAvatarPreviewGrid(urls) {
    const grid = document.getElementById('avatarPreviewGrid');
    if (!grid) return;

    grid.innerHTML = '';
    urls.forEach(function(url) {
        if (url && url.trim()) {
            var item = document.createElement('div');
            item.className = 'avatar-preview-item';
            item.innerHTML = '<img src="' + url + '" alt="头像预览" onerror="this.style.display=\'none\'" />';
            grid.appendChild(item);
        }
    });
}

// 更新背景预览
function updateBgPreview(url, previewId) {
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundImage = url ? `url('${url}')` : 'none';
    }
}

// 设置事件监听
function setupEventListeners() {
    // 添加头像按钮
    document.getElementById('addAvatarBtn').addEventListener('click', addAvatarUrlInput);

    // 背景预览
    document.getElementById('backgroundImage').addEventListener('input', function(e) {
        updateBgPreview(e.target.value, 'bgPreview');
    });

    document.getElementById('portraitBackgroundImage').addEventListener('input', function(e) {
        updateBgPreview(e.target.value, 'portraitBgPreview');
    });

    // 滑块值更新
    const sliders = [
        { id: 'overlayOpacity', valueId: 'overlayOpacityValue' },
        { id: 'backdropBlur', valueId: 'backdropBlurValue' },
        { id: 'cardOpacity', valueId: 'cardOpacityValue' },
        { id: 'rotationIntensity', valueId: 'rotationIntensityValue' },
        { id: 'parallaxIntensity', valueId: 'parallaxIntensityValue' },
        { id: 'recoveryDuration', valueId: 'recoveryDurationValue' }
    ];

    sliders.forEach(function(item) {
        document.getElementById(item.id).addEventListener('input', function() {
            updateSliderValue(item.id, item.valueId);
        });
    });

    // 键盘保存快捷键 Ctrl+S
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveAllConfig();
        }
    });
}

// 从表单收集配置
function collectFormConfig() {
    // 收集头像 URL 列表
    var avatarUrls = [];
    var avatarContainer = document.getElementById('avatarUrlsContainer');
    var avatarInputs = avatarContainer.querySelectorAll('.avatar-url-input');
    avatarInputs.forEach(function(input) {
        if (input.value && input.value.trim()) {
            avatarUrls.push(input.value.trim());
        }
    });

    // 收集社交链接
    const linkCards = document.querySelectorAll('.social-link-card');
    const socialLinks = [];
    linkCards.forEach(function(card) {
        socialLinks.push({
            name: card.querySelector('.link-name').value,
            url: card.querySelector('.link-url').value,
            icon: card.querySelector('.link-icon').value,
            color: card.querySelector('.link-color').value
        });
    });

    currentConfig = {
        profile: {
            username: document.getElementById('username').value,
            bio: document.getElementById('bio').value,
            avatarUrls: avatarUrls
        },
        socialLinks: socialLinks,
        appearance: {
            backgroundImage: document.getElementById('backgroundImage').value,
            portraitBackgroundImage: document.getElementById('portraitBackgroundImage').value,
            overlayOpacity: parseFloat(document.getElementById('overlayOpacity').value),
            backdropBlur: parseInt(document.getElementById('backdropBlur').value),
            cardOpacity: parseFloat(document.getElementById('cardOpacity').value),
            footer: document.getElementById('footer').value
        },
        effects: {
            enabled: document.getElementById('effectsEnabled').checked,
            rotationIntensity: parseFloat(document.getElementById('rotationIntensity').value),
            parallaxIntensity: parseFloat(document.getElementById('parallaxIntensity').value),
            recoveryDuration: parseInt(document.getElementById('recoveryDuration').value)
        },
        security: {
            disableRightClick: document.getElementById('disableRightClick').checked,
            disableDevTools: document.getElementById('disableDevTools').checked
        }
    };

    return currentConfig;
}

// 深度比较两个对象是否相等
function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

// 保存所有配置（只保存有改动的）
function saveAllConfig() {
    currentConfig = collectFormConfig();

    const groups = ['profile', 'socialLinks', 'appearance', 'effects', 'security'];
    let savedCount = 0;
    let errorCount = 0;
    let hasChanges = false;

    // 检查哪些配置组有改动
    groups.forEach(function(group) {
        if (!deepEqual(currentConfig[group], originalConfig[group])) {
            hasChanges = true;
        }
    });

    if (!hasChanges) {
        showNotification('配置已保存！', 'success');
        return;
    }

    // 只保存有改动的配置组
    function saveGroup(index) {
        if (index >= groups.length) {
            if (errorCount === 0) {
                showNotification('配置已保存！', 'success');
                // 更新原始配置
                originalConfig = JSON.parse(JSON.stringify(currentConfig));
            } else {
                showNotification(`保存完成，${savedCount}成功，${errorCount}失败`, 'warning');
            }
            return;
        }

        const group = groups[index];
        
        // 如果这个配置组没有改动，跳过
        if (deepEqual(currentConfig[group], originalConfig[group])) {
            saveGroup(index + 1);
            return;
        }

        const data = currentConfig[group];

        // 获取存储的 Token
        const token = localStorage.getItem('adminToken') || 'enkansakura';

        fetch('/api/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                group: group,
                data: data
            })
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(result) {
            if (result.success) {
                savedCount++;
            } else {
                errorCount++;
            }
            saveGroup(index + 1);
        })
        .catch(function(error) {
            errorCount++;
            saveGroup(index + 1);
        });
    }

    saveGroup(0);
}

// 重置配置
function resetConfig() {
    if (confirm('确定要重置为默认配置吗？此操作不可恢复！')) {
        fetch('/api/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.success) {
                showNotification('配置已重置为默认值', 'success');
                loadConfig();
            } else {
                showNotification('重置失败：' + data.error, 'error');
            }
        })
        .catch(function(error) {
            showNotification('重置失败：' + error.message, 'error');
        });
    }
}

// 显示通知
function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'save-notification ' + type + ' show';
    setTimeout(function() {
        notification.classList.remove('show');
    }, 3000);
}

// ============================================
// Token 管理功能
// ============================================

// 打开 Token 修改模态框
function openTokenModal() {
    document.getElementById('tokenModal').classList.add('show');
    document.getElementById('currentToken').value = '';
    document.getElementById('newToken').value = '';
    document.getElementById('confirmToken').value = '';
    document.getElementById('confirmStatus').className = 'confirm-status';
    document.getElementById('confirmStatus').innerHTML = '';
}

// 关闭 Token 修改模态框
function closeTokenModal() {
    document.getElementById('tokenModal').classList.remove('show');
}

// 验证 Token 一致性
function checkTokenMatch() {
    const newToken = document.getElementById('newToken').value;
    const confirmToken = document.getElementById('confirmToken').value;
    const confirmStatus = document.getElementById('confirmStatus');

    if (confirmToken.length === 0) {
        confirmStatus.className = 'confirm-status';
        confirmStatus.innerHTML = '';
    } else if (newToken === confirmToken) {
        confirmStatus.className = 'confirm-status match';
        confirmStatus.innerHTML = '<i class="fas fa-check-circle"></i> Token 一致';
    } else {
        confirmStatus.className = 'confirm-status mismatch';
        confirmStatus.innerHTML = '<i class="fas fa-times-circle"></i> Token 不一致';
    }
}

// 修改 Token
function changeToken() {
    const currentToken = document.getElementById('currentToken').value;
    const newToken = document.getElementById('newToken').value;
    const confirmToken = document.getElementById('confirmToken').value;

    // 验证输入
    if (!currentToken || !newToken || !confirmToken) {
        showNotification('请填写所有字段', 'error');
        return;
    }

    if (newToken.length < 6) {
        showNotification('Token 长度至少为 6 位', 'error');
        return;
    }

    if (newToken !== confirmToken) {
        showNotification('两次输入的新 Token 不一致', 'error');
        return;
    }

    // 验证当前 Token
    const storedToken = localStorage.getItem('adminToken') || 'enkansakura';
    if (currentToken !== storedToken) {
        showNotification('当前 Token 错误', 'error');
        return;
    }

    // 保存新 Token
    localStorage.setItem('adminToken', newToken);
    closeTokenModal();
    showNotification('Token 已修改成功，请妥善保管', 'success');
}

// 绑定 Token 匹配检查
document.addEventListener('DOMContentLoaded', function() {
    const newTokenInput = document.getElementById('newToken');
    const confirmTokenInput = document.getElementById('confirmToken');

    if (newTokenInput) {
        newTokenInput.addEventListener('input', checkTokenMatch);
    }

    if (confirmTokenInput) {
        confirmTokenInput.addEventListener('input', checkTokenMatch);
    }
});

// 颜色格式转换工具
function rgbaToHex(rgba) {
    if (!rgba) return '#333333';
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#333333';
    return '#' + [match[1], match[2], match[3]].map(function(x) {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgba(51, 51, 51, ' + alpha + ')';
    return 'rgba(' + parseInt(result[1], 16) + ', ' + parseInt(result[2], 16) + ', ' + parseInt(result[3], 16) + ', ' + alpha + ')';
}
