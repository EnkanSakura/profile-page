// 个人社媒链接展示页 - 主脚本
// 从 Workers API 加载配置

(function() {
    'use strict';

    let appConfig = null;
    let bgLayer = null;
    let scaleFactor = 1;
    let currentBgUrl = null;
    let isPortrait = false;
    let imagesLoaded = false;

    document.addEventListener('DOMContentLoaded', function() {
        init();
    });

    function init() {
        // 显示加载状态
        document.body.classList.add('loading');
        // 从 Workers API 加载配置
        loadConfigFromAPI();
    }

    // 检测横竖屏
    function checkOrientation() {
        isPortrait = window.innerHeight > window.innerWidth;
    }

    // 预加载图片
    function preloadImages(urls, callback) {
        if (!urls || urls.length === 0) {
            if (callback) callback();
            return;
        }

        var loaded = 0;
        var total = urls.length;
        var failed = 0;

        function checkComplete() {
            loaded + failed >= total && callback && callback();
        }

        urls.forEach(function(url) {
            if (!url) {
                loaded++;
                checkComplete();
                return;
            }
            var img = new Image();
            img.onload = function() {
                loaded++;
                checkComplete();
            };
            img.onerror = function() {
                failed++;
                loaded++;
                checkComplete();
            };
            img.src = url;
        });
    }

    // 加载配置
    function loadConfigFromAPI() {
        fetch('/api/config')
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                if (data.success && data.config) {
                    appConfig = data.config;
                    checkOrientation();
                    renderPage();
                } else {
                    throw new Error('配置数据无效');
                }
            })
            .catch(function(error) {
                // 使用默认配置
                appConfig = getDefaultConfig();
                checkOrientation();
                renderPage();
            });
    }

    function getDefaultConfig() {
        return {
            profile: {
                username: '@EnkanSakura',
                bio: '分享生活 · 记录美好 · 连接世界',
                avatarUrls: ['https://picsum.photos/200/200']
            },
            socialLinks: [
                { name: 'GitHub', url: 'https://github.com/EnkanSakura', icon: 'fab fa-github', color: 'rgba(51, 51, 51, 0.8)' }
            ],
            appearance: {
                backgroundImage: 'https://picsum.photos/1920/1080',
                portraitBackgroundImage: '',
                overlayOpacity: 0.4,
                backdropBlur: 10,
                cardOpacity: 0.15,
                footer: '© 2026 EnkanSakura. All rights reserved.'
            },
            effects: {
                enabled: true,
                rotationIntensity: 1,
                parallaxIntensity: 1,
                recoveryDuration: 500
            },
            security: {
                disableRightClick: true,
                disableDevTools: false
            }
        };
    }

    function renderPage() {
        if (!appConfig) {
            return;
        }

        initSecurity();
        renderContent();
        init3DEffects();
    }

    // 等待图片加载完成后显示页面
    function showPage() {
        imagesLoaded = true;
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
    }

    function initSecurity() {
        var security = appConfig.security || {};

        if (security.disableRightClick !== false) {
            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
            });
        }

        if (security.disableDevTools === true) {
            document.addEventListener('keydown', function(e) {
                if (e.key === 'F12') {
                    e.preventDefault();
                    return false;
                }
                if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                    e.preventDefault();
                    return false;
                }
                if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                    e.preventDefault();
                    return false;
                }
                if (e.ctrlKey && e.key === 'U') {
                    e.preventDefault();
                    return false;
                }
            });
        }
    }

    function renderContent() {
        var profile = appConfig.profile || {};
        var appearance = appConfig.appearance || {};
        var socialLinks = appConfig.socialLinks || [];

        var avatarEl = document.getElementById('avatar');
        var usernameEl = document.getElementById('username');
        var bioEl = document.getElementById('bio');
        var footerEl = document.getElementById('footer');

        // 从头像 URL 列表中随机选择一个
        var avatarUrls = profile.avatarUrls || [];
        var avatarUrl = '';
        if (avatarUrls.length > 0) {
            avatarUrl = avatarUrls[Math.floor(Math.random() * avatarUrls.length)];
        }

        if (avatarEl) avatarEl.src = avatarUrl;
        if (usernameEl) usernameEl.textContent = profile.username || '';
        if (bioEl) bioEl.textContent = profile.bio || '';
        if (footerEl) footerEl.textContent = appearance.footer || '';

        // 更新背景
        updateBackground();

        // 预加载头像和背景图片，加载完成后再显示页面
        var imageUrls = [];
        if (avatarUrl) imageUrls.push(avatarUrl);
        if (appearance.backgroundImage) imageUrls.push(appearance.backgroundImage);
        if (appearance.portraitBackgroundImage) imageUrls.push(appearance.portraitBackgroundImage);

        preloadImages(imageUrls, function() {
            showPage();
        });

        // 渲染社交链接
        var container = document.getElementById('social-links');
        if (container && socialLinks.length > 0) {
            socialLinks.forEach(function(link, index) {
                var a = document.createElement('a');
                a.href = link.url || '#';
                a.className = 'social-link';
                a.target = '_blank';
                a.rel = 'noopener';
                a.style.background = link.color || 'rgba(51, 51, 51, 0.8)';
                a.style.animationDelay = (0.1 + index * 0.05) + 's';

                var icon = document.createElement('i');
                icon.className = link.icon || 'fas fa-link';

                var text = document.createElement('span');
                text.textContent = link.name || 'Link';

                a.appendChild(icon);
                a.appendChild(text);
                container.appendChild(a);
            });
        }
    }

    // 更新背景图片
    function updateBackground() {
        if (!appConfig) return;

        var appearance = appConfig.appearance || {};
        var effects = appConfig.effects || {};

        // 根据横竖屏选择背景图片
        var bgUrl = isPortrait && appearance.portraitBackgroundImage 
            ? appearance.portraitBackgroundImage 
            : appearance.backgroundImage;

        // 如果竖屏未设置，使用横屏背景
        if (!bgUrl) {
            bgUrl = appearance.backgroundImage || 'https://picsum.photos/1920/1080';
        }

        // 如果背景图片没有变化，不更新
        if (currentBgUrl === bgUrl && bgLayer) {
            return;
        }

        currentBgUrl = bgUrl;

        // 设置 body 背景
        document.body.style.backgroundImage = "url('" + bgUrl + "')";

        // 计算缩放因子
        var parallaxIntensity = effects.parallaxIntensity || 1.0;
        var maxParallax = 20 * parallaxIntensity;
        scaleFactor = 1 + (maxParallax / Math.min(window.innerWidth, window.innerHeight));

        // 创建或更新背景层
        if (!bgLayer) {
            bgLayer = document.createElement('div');
            bgLayer.className = 'background-layer';
            document.body.insertBefore(bgLayer, document.body.firstChild);
        }

        bgLayer.style.backgroundImage = "url('" + bgUrl + "')";
        bgLayer.style.transform = 'scale(' + scaleFactor + ')';

        // 设置遮罩和卡片透明度
        var overlayOpacity = appearance.overlayOpacity || 0.4;
        var cardOpacity = appearance.cardOpacity || 0.15;
        var backdropBlur = appearance.backdropBlur || 10;

        // 更新或创建样式
        var styleEl = document.getElementById('dynamic-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-styles';
            document.head.appendChild(styleEl);
        }

        styleEl.textContent =
            'body::before { background: rgba(0, 0, 0, ' + overlayOpacity + '); }' +
            '.profile-card { background: rgba(255, 255, 255, ' + cardOpacity + '); backdrop-filter: blur(' + backdropBlur + 'px); }';
    }

    function init3DEffects() {
        var effects = appConfig.effects || {};
        var enabled = effects.enabled !== false;
        var rotationIntensity = effects.rotationIntensity || 1.0;
        var parallaxIntensity = effects.parallaxIntensity || 1.0;
        var recoveryDuration = effects.recoveryDuration || 500;

        var card = document.querySelector('.profile-card');
        if (!card || !enabled) return;

        var lastKnownBgOffset = { x: 0, y: 0 };
        var isMouseInWindow = true;

        function getCenter(element) {
            var rect = element.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }

        document.addEventListener('mousemove', function(e) {
            isMouseInWindow = true;
            var cardCenter = getCenter(card);
            var deltaX = e.clientX - cardCenter.x;
            var deltaY = e.clientY - cardCenter.y;

            var rotateY = (deltaX / window.innerWidth) * 30 * rotationIntensity;
            var rotateX = -(deltaY / window.innerHeight) * 30 * rotationIntensity;

            card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';

            if (bgLayer) {
                var bgOffsetX = -(deltaX / window.innerWidth) * 20 * parallaxIntensity;
                var bgOffsetY = -(deltaY / window.innerHeight) * 20 * parallaxIntensity;
                lastKnownBgOffset = { x: bgOffsetX, y: bgOffsetY };
                bgLayer.style.transform = 'scale(' + scaleFactor + ') translate(' + bgOffsetX + 'px, ' + bgOffsetY + 'px)';
            }
        });

        document.addEventListener('mouseleave', function() {
            isMouseInWindow = false;
            card.style.transform = 'rotateX(0deg) rotateY(0deg)';
            if (bgLayer) {
                bgLayer.style.transform = 'scale(' + scaleFactor + ') translate(' + lastKnownBgOffset.x + 'px, ' + lastKnownBgOffset.y + 'px)';
            }
        });

        document.addEventListener('mouseenter', function() {
            if (!isMouseInWindow && bgLayer) {
                bgLayer.style.transition = 'transform 0.2s ease-out';
                setTimeout(function() {
                    bgLayer.style.transition = '';
                }, 200);
            }
            isMouseInWindow = true;
            card.style.transition = 'transform 0.1s ease-out';
        });

        card.addEventListener('mouseenter', function() {
            card.style.transition = 'transform 0.1s ease-out';
        });

        card.addEventListener('mouseleave', function() {
            card.style.transition = 'transform ' + recoveryDuration + 'ms ease-out';
        });
    }
})();
