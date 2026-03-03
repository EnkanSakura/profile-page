// Cloudflare Workers - D1 + 静态文件版本
// 个人社媒链接展示页

const MIME_TYPES = {
    '.html': 'text/html;charset=utf-8',
    '.css': 'text/css;charset=utf-8',
    '.js': 'application/javascript;charset=utf-8',
    '.json': 'application/json;charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

// 缓存配置：key -> { data, timestamp, ttl }
const CACHE_TTL = 60000; // 1 分钟缓存

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS 预检请求
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }

        // API 路由
        if (path.startsWith('/api/')) {
            return handleAPI(request, env, url);
        }

        // 静态文件服务
        return serveStaticFile(path, env);
    }
};

// ============================================
// CORS 处理
// ============================================

function handleCORS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============================================
// API 路由处理
// ============================================

async function handleAPI(request, env, url) {
    const path = url.pathname;
    const method = request.method;

    try {
        // GET /api/config - 获取所有配置（带缓存）
        if (method === 'GET' && path === '/api/config') {
            return await getConfig(env);
        }

        // GET /api/config/:group - 获取指定配置组
        if (method === 'GET' && path.startsWith('/api/config/')) {
            const group = path.split('/').pop();
            return await getConfigGroup(env, group);
        }

        // POST /api/update - 更新配置
        if (method === 'POST' && path === '/api/update') {
            return await updateConfig(request, env);
        }

        // POST /api/reset - 重置配置为默认值
        if (method === 'POST' && path === '/api/reset') {
            return await resetConfig(request, env);
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'API not found',
            available: ['GET /api/config', 'GET /api/config/:group', 'POST /api/update', 'POST /api/reset']
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================
// 配置管理（D1 数据库）
// ============================================

// 获取所有配置（直接从 D1 读取，不使用缓存）
async function getConfig(env) {
    try {
        // 检查数据库绑定是否存在
        if (!env.PROFILE_DB) {
            console.error('PROFILE_DB binding is missing');
            return new Response(JSON.stringify({
                success: false,
                error: 'Database binding not found'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 从 D1 读取所有配置组
        const config = {};
        const groups = ['profile', 'socialLinks', 'appearance', 'effects', 'security'];

        for (const group of groups) {
                const result = await env.PROFILE_DB.prepare(
                    'SELECT config_data FROM config WHERE config_group = ?'
                ).bind(group).first();

                if (result && result.config_data) {
                config[group] = JSON.parse(result.config_data);
                } else {
                    // 如果配置不存在，返回空对象
                    config[group] = {};
            }
        }

        return new Response(JSON.stringify({
            success: true,
            config: config
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 获取指定配置组
async function getConfigGroup(env, group) {
    const cacheKey = `config_cache_${group}`;
    
    // 尝试从缓存读取
    const cached = await readCache(env, cacheKey);
    if (cached) {
        return new Response(JSON.stringify({ 
            success: true, 
            data: cached,
            cached: true
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60'
            }
        });
    }

    // 从 D1 读取
    const result = await env.PROFILE_DB.prepare(
        'SELECT config_data, version FROM config WHERE config_group = ?'
    ).bind(group).first();

    if (!result) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: '配置组不存在' 
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const data = JSON.parse(result.config_data);
    
    // 写入缓存
    await writeCache(env, cacheKey, data);

    return new Response(JSON.stringify({ 
        success: true, 
        data: data,
        version: result.version,
        cached: false
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60'
        }
    });
}

// 更新配置
async function updateConfig(request, env) {
    try {
        // 鉴权检查（开发环境跳过）
        const authResult = await verifyAuth(request, env);

        const body = await request.json();
        const { group, data, version } = body;

        if (!group || data === undefined) {
            return new Response(JSON.stringify({
                success: false,
                error: '缺少必要参数：group, data'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证配置组
        const validGroups = ['profile', 'socialLinks', 'appearance', 'effects', 'security'];
        if (!validGroups.includes(group)) {
            return new Response(JSON.stringify({
                success: false,
                error: '无效的配置组'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 获取当前版本
        const current = await env.PROFILE_DB.prepare(
            'SELECT config_data, version FROM config WHERE config_group = ?'
        ).bind(group).first();

        const newVersion = current ? current.version + 1 : 1;

        // 检查版本号（乐观锁）
        if (version !== undefined && current && version !== current.version) {
            return new Response(JSON.stringify({
                success: false,
                error: '版本冲突，配置已被修改',
                currentVersion: current.version
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 写入数据库
        const jsonData = JSON.stringify(data);

        await env.PROFILE_DB.prepare(
            `INSERT INTO config (config_group, config_data, version, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(config_group) DO UPDATE SET
                config_data = excluded.config_data,
                version = excluded.version,
                updated_at = CURRENT_TIMESTAMP`
        ).bind(group, jsonData, newVersion).run();

        // 验证写入：立即读取确认
        const verify = await env.PROFILE_DB.prepare(
            'SELECT config_data, version FROM config WHERE config_group = ?'
        ).bind(group).first();

        if (verify && verify.config_data === jsonData) {
            return new Response(JSON.stringify({
                success: true,
                message: '配置已更新',
                version: verify.version
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                error: '写入后验证失败'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 重置配置为默认值
async function resetConfig(request, env) {
    const authResult = await verifyAuth(request, env);
    if (!authResult.valid) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: authResult.error 
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const defaults = {
        'profile': '{"username":"@EnkanSakura","bio":"分享生活 · 记录美好 · 连接世界","avatarUrls":["https://picsum.photos/200/200"]}',
        'socialLinks': '[{"name":"GitHub","url":"https://github.com/EnkanSakura","icon":"fab fa-github","color":"rgba(51, 51, 51, 0.8)"}]',
        'appearance': '{"backgroundImage":"https://picsum.photos/1920/1080","portraitBackgroundImage":"","overlayOpacity":0.4,"backdropBlur":10,"cardOpacity":0.15,"footer":"© 2026 EnkanSakura. All rights reserved."}',
        'effects': '{"enabled":true,"rotationIntensity":1,"parallaxIntensity":1,"recoveryDuration":500}',
        'security': '{"disableRightClick":true,"disableDevTools":false}'
    };

    try {
        for (const [group, data] of Object.entries(defaults)) {
            await env.PROFILE_DB.prepare(
                `INSERT INTO config (config_group, config_data, version) 
                 VALUES (?, ?, 1)
                 ON CONFLICT(config_group) DO UPDATE SET 
                    config_data = excluded.config_data,
                    version = 1,
                    updated_at = CURRENT_TIMESTAMP`
            ).bind(group, data).run();

            await clearConfigCache(env, group);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: '配置已重置' 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================
// 缓存管理（使用 KV 或 内存缓存）
// ============================================

async function readCache(env, key) {
    if (env.CONFIG_CACHE) {
        // 使用 KV 缓存
        const cached = await env.CONFIG_CACHE.get(key, { type: 'json' });
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
    }
    return null;
}

async function writeCache(env, key, data, ttl = CACHE_TTL) {
    if (env.CONFIG_CACHE) {
        await env.CONFIG_CACHE.put(key, JSON.stringify({
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        }));
    }
}

async function clearConfigCache(env, group) {
    if (env.CONFIG_CACHE) {
        await env.CONFIG_CACHE.delete('config_cache');
        await env.CONFIG_CACHE.delete(`config_cache_${group}`);
    }
}

// ============================================
// 鉴权管理（支持 Token 和 Zero Trust 切换）
// ============================================

async function verifyAuth(request, env) {
    // 开发环境：跳过鉴权
    if (env.ENVIRONMENT === 'dev' || env.ENVIRONMENT === 'development') {
        return { valid: true, user: 'dev' };
    }

    // 获取认证方式配置（默认为 key）
    const authFunc = env.AUTH_FUNC;

    if (authFunc === 'zerotrust') {
        // Zero Trust 认证模式
        const accessHeader = request.headers.get('Cf-Access-Jwt-Assertion');
        const accessToken = request.headers.get('Cf-Access-Authenticated-Service-Id');

        if (accessHeader) {
            try {
                const payload = decodeJWT(accessHeader);
                if (payload && payload.email) {
                    return { valid: true, user: payload.email, payload };
                }
            } catch (e) {
                // JWT 验证失败
            }
        }

        if (accessToken) {
            return { valid: true, user: 'access-service', serviceId: accessToken };
        }

        return { valid: false, error: '未授权访问，请配置 Cloudflare Zero Trust' };
    } else {
        // Token 认证模式（默认）
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { valid: false, error: '未授权访问，缺少 Authorization header' };
        }

        const token = authHeader.substring(7);
        const expectedToken = env.AUTH_KEY;

        if (token === expectedToken) {
            return { valid: true, user: 'token-auth' };
        }

        return { valid: false, error: 'Token 无效' };
    }
}

// 简单的 JWT 解码（不验证签名，签名由 Cloudflare 验证）
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1];
        // Base64URL 解码
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

// ============================================
// 静态文件服务 - 内嵌文件内容
// ============================================

// 内嵌的静态文件（部署时由 wrangler 自动注入）
// 本地开发时使用这些内嵌内容
const STATIC_FILES = {
    'index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EnkanSakura Profile</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="container">
        <div class="profile-card">
            <div class="profile-header">
                <div class="avatar">
                    <img id="avatar" alt="头像" />
                </div>
                <h1 class="username" id="username"></h1>
                <p class="bio" id="bio"></p>
            </div>
            <div class="social-links" id="social-links"></div>
            <div class="footer">
                <p id="footer"></p>
            </div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>`,
    'favicon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <!-- 渐变背景 - 粉色到紫色 -->
  <defs>
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 圆形背景 -->
  <circle cx="90" cy="90" r="90" fill="url(#iconGrad)"/>
  
  <!-- 樱花图标 -->
  <g fill="white" opacity="0.9">
    <!-- 五片花瓣 -->
    <circle cx="90" cy="63" r="14"/>
    <circle cx="117" cy="81" r="14"/>
    <circle cx="108" cy="112" r="14"/>
    <circle cx="72" cy="112" r="14"/>
    <circle cx="63" cy="81" r="14"/>
    
    <!-- 花心 -->
    <circle cx="90" cy="90" r="11" fill="#fff"/>
    <circle cx="90" cy="90" r="5" fill="url(#iconGrad)"/>
  </g>
</svg>`,
    'styles.css': `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --card-bg: rgba(255, 255, 255, 0.15);
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.8);
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #667eea;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    perspective: 1000px;
    overflow: hidden;
}

body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 0;
    pointer-events: none;
}

.background-layer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: -1;
    will-change: transform;
}

.container {
    width: 100%;
    max-width: 480px;
    perspective: 1000px;
}

.profile-card {
    background: var(--card-bg);
    border-radius: 24px;
    padding: 48px 32px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transform-style: preserve-3d;
    transform: rotateX(0deg) rotateY(0deg);
    transition: transform 0.1s ease-out;
}

.profile-header {
    text-align: center;
    margin-bottom: 40px;
}

.avatar {
    width: 120px;
    height: 120px;
    margin: 0 auto 20px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid white;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.username {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 8px;
}

.bio {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.6;
}

.social-links {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.social-link {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-radius: 12px;
    text-decoration: none;
    color: white;
    font-weight: 600;
    font-size: 16px;
    transition: all 0.3s ease;
}

.social-link:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.social-link i {
    font-size: 24px;
    width: 32px;
    text-align: center;
}

.footer {
    margin-top: 40px;
    text-align: center;
}

.footer p {
    font-size: 13px;
    color: var(--text-secondary);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

.profile-card {
    animation: fadeInUp 0.6s ease;
}

.social-link {
    animation: fadeInUp 0.6s ease;
    animation-fill-mode: both;
}

.social-link:nth-child(1) { animation-delay: 0.1s; }
.social-link:nth-child(2) { animation-delay: 0.15s; }
.social-link:nth-child(3) { animation-delay: 0.2s; }
`,
    'app.js': `// 个人社媒链接展示页 - 主脚本\n// 从 Workers API 加载配置\n\n(function() {\n    'use strict';\n\n    let appConfig = null;\n    let bgLayer = null;\n    let scaleFactor = 1;\n    let currentBgUrl = null;\n    let isPortrait = false;\n\n    document.addEventListener('DOMContentLoaded', function() {\n        init();\n    });\n\n    function init() {\n        // 从 Workers API 加载配置\n        loadConfigFromAPI();\n    }\n\n    // 检测横竖屏\n    function checkOrientation() {\n        isPortrait = window.innerHeight > window.innerWidth;\n    }\n\n    // 加载配置\n    function loadConfigFromAPI() {\n        fetch('/api/config')\n            .then(function(response) {\n                if (!response.ok) {\n                    throw new Error('HTTP ' + response.status);\n                }\n                return response.json();\n            })\n            .then(function(data) {\n                if (data.success && data.config) {\n                    appConfig = data.config;\n                    checkOrientation();\n                    renderPage();\n                } else {\n                    throw new Error('配置数据无效');\n                }\n            })\n            .catch(function(error) {\n                // 使用默认配置\n                appConfig = getDefaultConfig();\n                checkOrientation();\n                renderPage();\n            });\n    }\n\n    function getDefaultConfig() {\n        return {\n            profile: {\n                username: '@EnkanSakura',\n                bio: '分享生活 · 记录美好 · 连接世界',\n                avatarUrls: ['https://picsum.photos/200/200']\n            },\n            socialLinks: [\n                { name: 'GitHub', url: 'https://github.com/EnkanSakura', icon: 'fab fa-github', color: 'rgba(51, 51, 51, 0.8)' }\n            ],\n            appearance: {\n                backgroundImage: 'https://picsum.photos/1920/1080',\n                portraitBackgroundImage: '',\n                overlayOpacity: 0.4,\n                backdropBlur: 10,\n                cardOpacity: 0.15,\n                footer: '© 2026 EnkanSakura. All rights reserved.'\n            },\n            effects: {\n                enabled: true,\n                rotationIntensity: 1,\n                parallaxIntensity: 1,\n                recoveryDuration: 500\n            },\n            security: {\n                disableRightClick: true,\n                disableDevTools: false\n            }\n        };\n    }\n\n    function renderPage() {\n        if (!appConfig) {\n            return;\n        }\n\n        initSecurity();\n        renderContent();\n        init3DEffects();\n    }\n\n    function initSecurity() {\n        var security = appConfig.security || {};\n\n        if (security.disableRightClick !== false) {\n            document.addEventListener('contextmenu', function(e) {\n                e.preventDefault();\n                return false;\n            });\n        }\n\n        if (security.disableDevTools === true) {\n            document.addEventListener('keydown', function(e) {\n                if (e.key === 'F12') {\n                    e.preventDefault();\n                    return false;\n                }\n                if (e.ctrlKey && e.shiftKey && e.key === 'I') {\n                    e.preventDefault();\n                    return false;\n                }\n                if (e.ctrlKey && e.shiftKey && e.key === 'J') {\n                    e.preventDefault();\n                    return false;\n                }\n                if (e.ctrlKey && e.key === 'U') {\n                    e.preventDefault();\n                    return false;\n                }\n            });\n        }\n    }\n\n    function renderContent() {\n        var profile = appConfig.profile || {};\n        var appearance = appConfig.appearance || {};\n        var socialLinks = appConfig.socialLinks || [];\n\n        var avatarEl = document.getElementById('avatar');\n        var usernameEl = document.getElementById('username');\n        var bioEl = document.getElementById('bio');\n        var footerEl = document.getElementById('footer');\n\n        // 从头像 URL 列表中随机选择一个\n        var avatarUrls = profile.avatarUrls || [];\n        var avatarUrl = '';\n        if (avatarUrls.length > 0) {\n            avatarUrl = avatarUrls[Math.floor(Math.random() * avatarUrls.length)];\n        }\n\n        if (avatarEl) avatarEl.src = avatarUrl;\n        if (usernameEl) usernameEl.textContent = profile.username || '';\n        if (bioEl) bioEl.textContent = profile.bio || '';\n        if (footerEl) footerEl.textContent = appearance.footer || '';\n\n        // 更新背景\n        updateBackground();\n\n        // 渲染社交链接\n        var container = document.getElementById('social-links');\n        if (container && socialLinks.length > 0) {\n            socialLinks.forEach(function(link, index) {\n                var a = document.createElement('a');\n                a.href = link.url || '#';\n                a.className = 'social-link';\n                a.target = '_blank';\n                a.rel = 'noopener';\n                a.style.background = link.color || 'rgba(51, 51, 51, 0.8)';\n                a.style.animationDelay = (0.1 + index * 0.05) + 's';\n\n                var icon = document.createElement('i');\n                icon.className = link.icon || 'fas fa-link';\n\n                var text = document.createElement('span');\n                text.textContent = link.name || 'Link';\n\n                a.appendChild(icon);\n                a.appendChild(text);\n                container.appendChild(a);\n            });\n        }\n    }\n\n    // 更新背景图片\n    function updateBackground() {\n        if (!appConfig) return;\n\n        var appearance = appConfig.appearance || {};\n        var effects = appConfig.effects || {};\n\n        // 根据横竖屏选择背景图片\n        var bgUrl = isPortrait && appearance.portraitBackgroundImage \n            ? appearance.portraitBackgroundImage \n            : appearance.backgroundImage;\n\n        // 如果竖屏未设置，使用横屏背景\n        if (!bgUrl) {\n            bgUrl = appearance.backgroundImage || 'https://picsum.photos/1920/1080';\n        }\n\n        // 如果背景图片没有变化，不更新\n        if (currentBgUrl === bgUrl && bgLayer) {\n            return;\n        }\n\n        currentBgUrl = bgUrl;\n\n        // 设置 body 背景\n        document.body.style.backgroundImage = "url('" + bgUrl + "')";\n\n        // 计算缩放因子\n        var parallaxIntensity = effects.parallaxIntensity || 1.0;\n        var maxParallax = 20 * parallaxIntensity;\n        scaleFactor = 1 + (maxParallax / Math.min(window.innerWidth, window.innerHeight));\n\n        // 创建或更新背景层\n        if (!bgLayer) {\n            bgLayer = document.createElement('div');\n            bgLayer.className = 'background-layer';\n            document.body.insertBefore(bgLayer, document.body.firstChild);\n        }\n\n        bgLayer.style.backgroundImage = "url('" + bgUrl + "')";\n        bgLayer.style.transform = 'scale(' + scaleFactor + ')';\n\n        // 设置遮罩和卡片透明度\n        var overlayOpacity = appearance.overlayOpacity || 0.4;\n        var cardOpacity = appearance.cardOpacity || 0.15;\n        var backdropBlur = appearance.backdropBlur || 10;\n\n        // 更新或创建样式\n        var styleEl = document.getElementById('dynamic-styles');\n        if (!styleEl) {\n            styleEl = document.createElement('style');\n            styleEl.id = 'dynamic-styles';\n            document.head.appendChild(styleEl);\n        }\n\n        styleEl.textContent =\n            'body::before { background: rgba(0, 0, 0, ' + overlayOpacity + '); }' +\n            '.profile-card { background: rgba(255, 255, 255, ' + cardOpacity + '); backdrop-filter: blur(' + backdropBlur + 'px); }';\n    }\n\n    function init3DEffects() {\n        var effects = appConfig.effects || {};\n        var enabled = effects.enabled !== false;\n        var rotationIntensity = effects.rotationIntensity || 1.0;\n        var parallaxIntensity = effects.parallaxIntensity || 1.0;\n        var recoveryDuration = effects.recoveryDuration || 500;\n\n        var card = document.querySelector('.profile-card');\n        if (!card || !enabled) return;\n\n        var lastKnownBgOffset = { x: 0, y: 0 };\n        var isMouseInWindow = true;\n\n        function getCenter(element) {\n            var rect = element.getBoundingClientRect();\n            return {\n                x: rect.left + rect.width / 2,\n                y: rect.top + rect.height / 2\n            };\n        }\n\n        document.addEventListener('mousemove', function(e) {\n            isMouseInWindow = true;\n            var cardCenter = getCenter(card);\n            var deltaX = e.clientX - cardCenter.x;\n            var deltaY = e.clientY - cardCenter.y;\n\n            var rotateY = (deltaX / window.innerWidth) * 30 * rotationIntensity;\n            var rotateX = -(deltaY / window.innerHeight) * 30 * rotationIntensity;\n\n            card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';\n\n            if (bgLayer) {\n                var bgOffsetX = -(deltaX / window.innerWidth) * 20 * parallaxIntensity;\n                var bgOffsetY = -(deltaY / window.innerHeight) * 20 * parallaxIntensity;\n                lastKnownBgOffset = { x: bgOffsetX, y: bgOffsetY };\n                bgLayer.style.transform = 'scale(' + scaleFactor + ') translate(' + bgOffsetX + 'px, ' + bgOffsetY + 'px)';\n            }\n        });\n\n        document.addEventListener('mouseleave', function() {\n            isMouseInWindow = false;\n            card.style.transform = 'rotateX(0deg) rotateY(0deg)';\n            if (bgLayer) {\n                bgLayer.style.transform = 'scale(' + scaleFactor + ') translate(' + lastKnownBgOffset.x + 'px, ' + lastKnownBgOffset.y + 'px)';\n            }\n        });\n\n        document.addEventListener('mouseenter', function() {\n            if (!isMouseInWindow && bgLayer) {\n                bgLayer.style.transition = 'transform 0.2s ease-out';\n                setTimeout(function() {\n                    bgLayer.style.transition = '';\n                }, 200);\n            }\n            isMouseInWindow = true;\n            card.style.transition = 'transform 0.1s ease-out';\n        });\n\n        card.addEventListener('mouseenter', function() {\n            card.style.transition = 'transform 0.1s ease-out';\n        });\n\n        card.addEventListener('mouseleave', function() {\n            card.style.transition = 'transform ' + recoveryDuration + 'ms ease-out';\n        });\n    }\n})();\n`,
    'admin.html': `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>后台管理 - EnkanSakura Profile</title>\n    \n    <!-- 网站图标 -->\n    <link rel="icon" type="image/svg+xml" href="favicon.svg">\n    <link rel="apple-touch-icon" href="apple-touch-icon.png">\n    \n    <link rel="stylesheet" href="admin-styles.css">\n    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n</head>\n<body>\n    <div class="admin-container">\n        <header class="admin-header">\n            <h1><i class="fas fa-cog"></i> 后台管理</h1>\n            <div class="header-actions">\n                <span class="env-indicator" id="envIndicator">DEV</span>\n                <button class="btn btn-token" onclick="openTokenModal()">\n                    <i class="fas fa-key"></i> 认证 Token\n                </button>\n                <button class="btn btn-preview" onclick="window.open('index.html', '_blank')">\n                    <i class="fas fa-external-link-alt"></i> 预览页面\n                </button>\n                <button class="btn btn-save" onclick="saveAllConfig()">\n                    <i class="fas fa-save"></i> 保存全部\n                </button>\n            </div>\n        </header>\n\n        <main class="admin-main">\n            <!-- 基本信息 -->\n            <section class="config-section">\n                <h2><i class="fas fa-user"></i> 基本信息</h2>\n                <div class="form-group">\n                    <label for="username">用户名</label>\n                    <input type="text" id="username" placeholder="@YourName" />\n                </div>\n                <div class="form-group">\n                    <label for="bio">个人简介</label>\n                    <input type="text" id="bio" placeholder="分享生活 · 记录美好 · 连接世界" />\n                </div>\n                <div class="form-group">\n                    <label>头像 URL 列表</label>\n                    <div id="avatarUrlsContainer" class="avatar-urls-container">\n                        <!-- 动态生成 -->\n                    </div>\n                    <div class="avatar-url-actions">\n                        <button class="btn btn-primary btn-sm" id="addAvatarBtn">\n                            <i class="fas fa-plus"></i> 添加头像\n                        </button>\n                    </div>\n                    <!-- 头像预览图在所有链接后一行展示 -->\n                    <div class="avatar-preview-grid" id="avatarPreviewGrid"></div>\n                </div>\n            </section>\n\n            <!-- 社交链接 -->\n            <section class="config-section">\n                <h2>\n                    <i class="fas fa-link"></i> 社交链接\n                </h2>\n                <div id="socialLinksContainer"></div>\n                <div style="margin-top: 16px;">\n                    <button class="btn btn-primary btn-sm" onclick="addSocialLink()">\n                        <i class="fas fa-plus"></i> 添加链接\n                    </button>\n                </div>\n            </section>\n\n            <!-- 外观设置 -->\n            <section class="config-section">\n                <h2><i class="fas fa-paint-brush"></i> 外观设置</h2>\n                \n                <!-- 背景图片设置 -->\n                <div class="form-group">\n                    <label for="backgroundImage">横屏背景图片 URL</label>\n                    <input type="text" id="backgroundImage" placeholder="https://..." />\n                    <!-- 背景预览图在横屏链接后一行展示 -->\n                    <div class="bg-preview" id="bgPreview"></div>\n                </div>\n                <div class="form-group">\n                    <label for="portraitBackgroundImage">竖屏背景图片 URL</label>\n                    <input type="text" id="portraitBackgroundImage" placeholder="留空则使用横屏背景" />\n                    <!-- 背景预览图在竖屏链接后一行展示 -->\n                    <div class="bg-preview" id="portraitBgPreview"></div>\n                </div>\n                \n                <!-- 透明度设置 -->\n                <div class="form-group">\n                    <label for="overlayOpacity">背景遮罩透明度：<span id="overlayOpacityValue">0.4</span></label>\n                    <input type="range" id="overlayOpacity" min="0" max="1" step="0.05" value="0.4" />\n                </div>\n                <div class="form-group">\n                    <label for="backdropBlur">毛玻璃模糊强度：<span id="backdropBlurValue">10</span>px</label>\n                    <input type="range" id="backdropBlur" min="0" max="30" step="1" value="10" />\n                </div>\n                <div class="form-group">\n                    <label for="cardOpacity">卡片透明度：<span id="cardOpacityValue">0.15</span></label>\n                    <input type="range" id="cardOpacity" min="0" max="1" step="0.05" value="0.15" />\n                </div>\n                \n                <!-- 页脚文字 -->\n                <div class="form-group">\n                    <label for="footer">页脚文字</label>\n                    <input type="text" id="footer" placeholder="© 2026 YourName. All rights reserved." />\n                </div>\n            </section>\n\n            <!-- 动态效果 -->\n            <section class="config-section">\n                <h2><i class="fas fa-magic"></i> 动态效果</h2>\n                <div class="form-group">\n                    <label class="checkbox-label">\n                        <input type="checkbox" id="effectsEnabled" checked />\n                        <span>启用 3D 动态效果</span>\n                    </label>\n                </div>\n                <div class="form-group">\n                    <label for="rotationIntensity">3D 翻转强度：<span id="rotationIntensityValue">1.0</span></label>\n                    <input type="range" id="rotationIntensity" min="0" max="2" step="0.1" value="1.0" />\n                </div>\n                <div class="form-group">\n                    <label for="parallaxIntensity">背景视差强度：<span id="parallaxIntensityValue">1.0</span></label>\n                    <input type="range" id="parallaxIntensity" min="0" max="2" step="0.1" value="1.0" />\n                </div>\n                <div class="form-group">\n                    <label for="recoveryDuration">恢复时间 (毫秒)：<span id="recoveryDurationValue">500</span></label>\n                    <input type="range" id="recoveryDuration" min="100" max="2000" step="50" value="500" />\n                </div>\n            </section>\n\n            <!-- 安全设置 -->\n            <section class="config-section">\n                <h2><i class="fas fa-shield-alt"></i> 安全设置</h2>\n                <div class="form-group">\n                    <label class="checkbox-label">\n                        <input type="checkbox" id="disableRightClick" checked />\n                        <span>禁止右键菜单</span>\n                    </label>\n                </div>\n                <div class="form-group">\n                    <label class="checkbox-label">\n                        <input type="checkbox" id="disableDevTools" />\n                        <span>禁止开发者工具快捷键（F12, Ctrl+Shift+I/J, Ctrl+U）</span>\n                    </label>\n                </div>\n            </section>\n\n            <!-- 高级操作 -->\n            <section class="config-section">\n                <h2><i class="fas fa-tools"></i> 高级操作</h2>\n                <div class="advanced-actions">\n                    <button class="btn btn-primary" onclick="loadConfig()">\n                        <i class="fas fa-sync"></i> 重新加载配置\n                    </button>\n                    <button class="btn btn-danger" onclick="resetConfig()">\n                        <i class="fas fa-undo"></i> 重置为默认配置\n                    </button>\n                </div>\n            </section>\n        </main>\n\n        <div class="save-notification" id="notification"></div>\n\n        <!-- Token 修改模态框 -->\n        <div class="modal" id="tokenModal">\n            <div class="modal-content token-modal">\n                <div class="modal-header">\n                    <h2><i class="fas fa-key"></i> 认证 Token 设置</h2>\n                </div>\n                <div class="modal-body">\n                    <div class="token-modal-intro">\n                        <i class="fas fa-shield-alt"></i>\n                        <p>Token 用于后台管理权限认证，请妥善保管</p>\n                    </div>\n                    <div class="form-group">\n                        <label for="currentToken"><i class="fas fa-lock"></i> 当前 Token</label>\n                        <input type="password" id="currentToken" placeholder="请输入当前 Token" autocomplete="off" />\n                    </div>\n                    <div class="form-group">\n                        <label for="newToken"><i class="fas fa-key"></i> 新 Token</label>\n                        <input type="password" id="newToken" placeholder="请输入新 Token（至少 6 位）" autocomplete="off" />\n                    </div>\n                    <div class="form-group">\n                        <label for="confirmToken"><i class="fas fa-check-circle"></i> 确认新 Token</label>\n                        <input type="password" id="confirmToken" placeholder="请再次输入新 Token" autocomplete="off" />\n                        <div class="confirm-status" id="confirmStatus"></div>\n                    </div>\n                    <div class="token-tips">\n                        <div class="tip-item">\n                            <i class="fas fa-info-circle"></i>\n                            <span>Token 长度至少 6 位，建议使用强密码</span>\n                        </div>\n                        <div class="tip-item">\n                            <i class="fas fa-exclamation-triangle"></i>\n                            <span>修改后请妥善保管，丢失后需手动重置</span>\n                        </div>\n                    </div>\n                </div>\n                <div class="modal-footer">\n                    <button class="btn btn-cancel" onclick="closeTokenModal()">\n                        <i class="fas fa-times"></i> 取消\n                    </button>\n                    <button class="btn btn-save" onclick="changeToken()">\n                        <i class="fas fa-save"></i> 确认修改\n                    </button>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <script src="admin.js"></script>\n</body>\n</html>\n`,
    'admin-styles.css': `* {\n    margin: 0;\n    padding: 0;\n    box-sizing: border-box;\n}\n\n:root {\n    --primary-color: #667eea;\n    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n    --bg-color: #f7fafc;\n    --card-bg: #ffffff;\n    --text-primary: #2d3748;\n    --text-secondary: #718096;\n    --border-color: #e2e8f0;\n    --success-color: #48bb78;\n    --danger-color: #f56565;\n    --warning-color: #ed8936;\n}\n\nbody {\n    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n    background: var(--bg-color);\n    color: var(--text-primary);\n    line-height: 1.6;\n}\n\n.admin-container {\n    max-width: 1200px;\n    margin: 0 auto;\n    padding: 20px;\n}\n\n/* 头部 */\n.admin-header {\n    background: var(--primary-gradient);\n    color: white;\n    padding: 24px 32px;\n    border-radius: 16px;\n    margin-bottom: 32px;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);\n}\n\n.admin-header h1 {\n    font-size: 28px;\n    font-weight: 700;\n}\n\n.admin-header h1 i {\n    margin-right: 12px;\n}\n\n.header-actions {\n    display: flex;\n    gap: 12px;\n    align-items: center;\n}\n\n.env-indicator {\n    background: rgba(255, 255, 255, 0.2);\n    padding: 6px 12px;\n    border-radius: 6px;\n    font-size: 12px;\n    font-weight: 600;\n    backdrop-filter: blur(10px);\n}\n\n.btn {\n    padding: 12px 24px;\n    border-radius: 10px;\n    border: none;\n    font-size: 15px;\n    font-weight: 600;\n    cursor: pointer;\n    transition: all 0.3s ease;\n    display: inline-flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.btn i {\n    font-size: 14px;\n}\n\n.btn-preview {\n    background: rgba(255, 255, 255, 0.2);\n    color: white;\n    backdrop-filter: blur(10px);\n}\n\n.btn-preview:hover {\n    background: rgba(255, 255, 255, 0.3);\n}\n\n.btn-save {\n    background: white;\n    color: var(--primary-color);\n}\n\n.btn-save:hover {\n    transform: translateY(-2px);\n    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);\n}\n\n.btn-primary {\n    background: var(--primary-color);\n    color: white;\n}\n\n.btn-primary:hover {\n    background: #5a67d8;\n    transform: translateY(-2px);\n    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);\n}\n\n.btn-danger {\n    background: var(--danger-color);\n    color: white;\n}\n\n.btn-danger:hover {\n    background: #e53e3e;\n    transform: translateY(-2px);\n    box-shadow: 0 5px 20px rgba(245, 101, 101, 0.4);\n}\n\n.btn-sm {\n    padding: 8px 16px;\n    font-size: 13px;\n    height: 36px;\n}\n\n/* 主内容区 */\n.admin-main {\n    display: flex;\n    flex-direction: column;\n    gap: 24px;\n}\n\n.config-section {\n    background: var(--card-bg);\n    border-radius: 16px;\n    padding: 32px;\n    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);\n}\n\n.config-section h2 {\n    font-size: 22px;\n    margin-bottom: 24px;\n    color: var(--text-primary);\n    display: flex;\n    align-items: center;\n    gap: 12px;\n}\n\n.config-section h2 i {\n    color: var(--primary-color);\n}\n\n/* 表单元素 */\n.form-group {\n    margin-bottom: 20px;\n}\n\n.form-group label {\n    display: block;\n    font-weight: 600;\n    margin-bottom: 8px;\n    color: var(--text-primary);\n}\n\n/* 所有文本输入框统一样式 */\ninput[type="text"],\ninput[type="url"],\ninput[type="number"] {\n    width: 100%;\n    padding: 0 16px;\n    border: 2px solid var(--border-color);\n    border-radius: 8px;\n    font-size: 14px;\n    transition: all 0.3s ease;\n    height: 44px;\n    box-sizing: border-box;\n}\n\ninput[type="text"]:focus,\ninput[type="url"]:focus,\ninput[type="number"]:focus {\n    outline: none;\n    border-color: var(--primary-color);\n    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);\n}\n\n.form-group input[type="range"] {\n    width: 100%;\n    height: 8px;\n    border-radius: 4px;\n    background: var(--border-color);\n    outline: none;\n    -webkit-appearance: none;\n}\n\n.form-group input[type="range"]::-webkit-slider-thumb {\n    -webkit-appearance: none;\n    width: 20px;\n    height: 20px;\n    border-radius: 50%;\n    background: var(--primary-color);\n    cursor: pointer;\n    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);\n}\n\n.form-group input[type="checkbox"] {\n    width: 20px;\n    height: 20px;\n    cursor: pointer;\n    accent-color: var(--primary-color);\n}\n\n.checkbox-label {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    cursor: pointer;\n}\n\n.checkbox-label span {\n    font-weight: 500;\n}\n\n.form-group small {\n    display: block;\n    margin-top: 6px;\n    color: var(--text-secondary);\n    font-size: 13px;\n}\n\n/* 头像 URL 列表 */\n.avatar-urls-container {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n}\n\n.avatar-url-input-group {\n    display: flex;\n    gap: 12px;\n    align-items: center;\n}\n\n.avatar-url-input-group input {\n    flex: 1;\n}\n\n.btn-remove-sm {\n    background: var(--danger-color);\n    color: white;\n    width: 36px;\n    height: 36px;\n    padding: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    border-radius: 6px;\n    flex-shrink: 0;\n}\n\n.btn-remove-sm:hover {\n    opacity: 0.8;\n    transform: scale(1.05);\n}\n\n.avatar-url-input-group {\n    display: flex;\n    gap: 8px;\n    align-items: center;\n}\n\n.avatar-url-input-group input {\n    flex: 1;\n    min-width: 0;\n}\n\n.avatar-url-actions {\n    display: flex;\n    gap: 12px;\n    margin-top: 12px;\n    flex-wrap: wrap;\n}\n\n.avatar-preview-grid {\n    display: flex;\n    flex-wrap: nowrap;\n    gap: 12px;\n    margin-top: 16px;\n    overflow-x: auto;\n    padding: 8px 0;\n}\n\n.avatar-preview-item {\n    width: 100px;\n    height: 100px;\n    flex-shrink: 0;\n    border-radius: 50%;\n    overflow: hidden;\n    border: 3px solid var(--border-color);\n    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n    position: relative;\n}\n\n.avatar-preview-item img {\n    width: 100%;\n    height: 100%;\n    object-fit: cover;\n    display: block;\n}\n\n.bg-preview {\n    margin-top: 12px;\n    height: 150px;\n    width: 100%;\n    border-radius: 10px;\n    background-size: cover;\n    background-position: center;\n    border: 2px solid var(--border-color);\n    background-repeat: no-repeat;\n}\n\n/* 社交链接卡片 */\n.social-link-card {\n    background: var(--bg-color);\n    border-radius: 12px;\n    padding: 20px;\n    margin-bottom: 16px;\n    border: 2px solid var(--border-color);\n    transition: all 0.3s ease;\n}\n\n.social-link-card:hover {\n    border-color: var(--primary-color);\n    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.15);\n}\n\n/* 紧凑布局样式 */\n.social-link-card.compact {\n    padding: 16px;\n}\n\n.compact-grid {\n    display: grid;\n    grid-template-columns: 1fr 1fr;\n    gap: 12px;\n    margin-bottom: 12px;\n}\n\n.compact-field {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n}\n\n.compact-field.full-width {\n    grid-column: 1 / -1;\n}\n\n.compact-field label {\n    font-size: 12px;\n    font-weight: 600;\n    color: var(--text-secondary);\n    margin-bottom: 0;\n}\n\n/* 紧凑布局中的输入框使用较小高度 */\n.compact-field input[type="text"],\n.compact-field input[type="url"],\n.compact-field input[type="number"] {\n    height: 36px;\n    padding: 0 14px;\n}\n\n/* 颜色选择器紧凑布局 */\n.color-picker-compact {\n    display: flex;\n    gap: 6px;\n    align-items: center;\n}\n\n.color-picker-compact input[type="color"] {\n    width: 36px;\n    height: 36px;\n    padding: 0;\n    border: 2px solid var(--border-color);\n    border-radius: 6px;\n    cursor: pointer;\n}\n\n.color-picker-compact input[type="text"] {\n    flex: 1;\n    height: 36px;\n}\n\n.color-preview-compact {\n    width: 36px;\n    height: 36px;\n    border-radius: 6px;\n    border: 2px solid var(--border-color);\n    flex-shrink: 0;\n}\n\n.link-preview {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 10px 14px;\n    border-radius: 8px;\n    color: white;\n    font-weight: 500;\n    font-size: 14px;\n    background: rgba(51, 51, 51, 0.8);\n}\n\n.link-preview i {\n    font-size: 18px;\n    width: 24px;\n    text-align: center;\n}\n\n.social-link-card .form-group {\n    margin-bottom: 12px;\n}\n\n.social-link-actions {\n    display: flex;\n    gap: 8px;\n    margin-top: 12px;\n    padding-top: 12px;\n    border-top: 1px solid var(--border-color);\n    flex-wrap: wrap;\n}\n\n.color-picker-row {\n    display: flex;\n    gap: 10px;\n    align-items: center;\n}\n\n.color-picker-row input[type="text"] {\n    flex: 1;\n}\n\n.color-picker-row input[type="color"] {\n    width: 50px;\n    height: 44px;\n    padding: 5px;\n    border: 2px solid var(--border-color);\n    border-radius: 8px;\n    cursor: pointer;\n}\n\n.color-preview {\n    width: 30px;\n    height: 30px;\n    border-radius: 6px;\n    border: 2px solid var(--border-color);\n}\n\n/* 高级操作 */\n.advanced-actions {\n    display: flex;\n    gap: 12px;\n    flex-wrap: wrap;\n}\n\n/* 通知 */\n.save-notification {\n    position: fixed;\n    bottom: 30px;\n    right: 30px;\n    padding: 16px 24px;\n    border-radius: 12px;\n    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    font-weight: 600;\n    transform: translateY(100px);\n    opacity: 0;\n    transition: all 0.3s ease;\n    z-index: 1000;\n}\n\n.save-notification.show {\n    transform: translateY(0);\n    opacity: 1;\n}\n\n.save-notification.success {\n    background: var(--success-color);\n    color: white;\n}\n\n.save-notification.error {\n    background: var(--danger-color);\n    color: white;\n}\n\n.save-notification.warning {\n    background: var(--warning-color);\n    color: white;\n}\n\n/* 响应式设计 */\n@media (max-width: 768px) {\n    .admin-header {\n        flex-direction: column;\n        gap: 16px;\n        text-align: center;\n    }\n\n    .header-actions {\n        flex-wrap: wrap;\n        justify-content: center;\n    }\n\n    .config-section {\n        padding: 20px;\n    }\n\n    .social-link-actions {\n        flex-wrap: wrap;\n    }\n\n    /* 移动端紧凑布局改为单列 */\n    .compact-grid {\n        grid-template-columns: 1fr;\n    }\n}\n\n/* Token 按钮 */\n.btn-token {\n    background: rgba(255, 255, 255, 0.2);\n    color: white;\n    backdrop-filter: blur(10px);\n}\n\n.btn-token:hover {\n    background: rgba(255, 255, 255, 0.3);\n}\n\n/* Token 模态框 */\n.modal {\n    display: none;\n    position: fixed;\n    z-index: 1000;\n    left: 0;\n    top: 0;\n    width: 100%;\n    height: 100%;\n    background-color: rgba(0, 0, 0, 0.6);\n    backdrop-filter: blur(5px);\n}\n\n.modal.show {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n}\n\n.modal-content {\n    background: var(--card-bg);\n    border-radius: 16px;\n    width: 90%;\n    max-width: 550px;\n    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\n    max-height: 90vh;\n    overflow-y: auto;\n}\n\n.token-modal .modal-header {\n    background: var(--primary-gradient);\n    color: white;\n    border-radius: 16px 16px 0 0;\n    padding: 20px 24px;\n}\n\n.token-modal .modal-header h2 {\n    color: white;\n    font-size: 18px;\n    margin: 0;\n}\n\n.token-modal .modal-body {\n    padding: 24px;\n}\n\n.token-modal-intro {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 16px;\n    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);\n    border-radius: 12px;\n    margin-bottom: 20px;\n    border: 1px solid rgba(102, 126, 234, 0.2);\n}\n\n.token-modal-intro i {\n    font-size: 24px;\n    color: var(--primary-color);\n}\n\n.token-modal-intro p {\n    margin: 0;\n    color: var(--text-primary);\n    font-size: 14px;\n}\n\n.token-modal .form-group label {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    font-size: 14px;\n}\n\n.token-modal .form-group label i {\n    color: var(--primary-color);\n}\n\n.token-modal .form-group input {\n    width: 100%;\n    padding: 12px 16px;\n    border: 2px solid var(--border-color);\n    border-radius: 8px;\n    font-size: 15px;\n    box-sizing: border-box;\n}\n\n.token-modal .form-group input:focus {\n    outline: none;\n    border-color: var(--primary-color);\n    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);\n}\n\n.confirm-status {\n    margin-top: 8px;\n    font-size: 13px;\n}\n\n.confirm-status.match {\n    color: var(--success-color);\n}\n\n.confirm-status.mismatch {\n    color: var(--danger-color);\n}\n\n.token-tips {\n    margin-top: 20px;\n    padding: 16px;\n    background: rgba(255, 193, 7, 0.1);\n    border-radius: 8px;\n    border-left: 4px solid #ffc107;\n}\n\n.tip-item {\n    display: flex;\n    align-items: flex-start;\n    gap: 8px;\n    margin-bottom: 8px;\n}\n\n.tip-item:last-child {\n    margin-bottom: 0;\n}\n\n.tip-item i {\n    color: #ffc107;\n    font-size: 14px;\n    margin-top: 2px;\n}\n\n.tip-item span {\n    color: var(--text-secondary);\n    font-size: 13px;\n}\n\n.modal-footer {\n    display: flex;\n    gap: 12px;\n    justify-content: flex-end;\n    padding: 16px 24px;\n    border-top: 1px solid var(--border-color);\n}\n\n.btn-cancel {\n    background: var(--border-color);\n    color: var(--text-primary);\n}\n\n.btn-cancel:hover {\n    background: #cbd5e0;\n}\n`,
    'admin.js': `// 后台管理界面交互脚本\n// 基于 Cloudflare Workers + D1 架构\n\nlet currentConfig = {};\nlet originalConfig = {};  // 保存原始配置用于对比\nlet avatarUrlInputCount = 0;\nlet socialLinkCount = 0;\nlet isDevEnvironment = false;\n\n// 页面加载\ndocument.addEventListener('DOMContentLoaded', function() {\n    checkEnvironment();\n    checkAuthToken();\n    loadConfig();\n    setupEventListeners();\n});\n\n// 检查 Token 是否有效\nfunction checkAuthToken() {\n    const token = localStorage.getItem('adminToken');\n    if (!token) {\n        // 设置默认 Token\n        localStorage.setItem('adminToken', 'enkansakura');\n    }\n}\n\n// 检查环境\nfunction checkEnvironment() {\n    const envIndicator = document.getElementById('envIndicator');\n    if (window.location.hostname === 'localhost' || \n        window.location.hostname === '127.0.0.1' ||\n        window.location.hostname.includes('.dev.')) {\n        isDevEnvironment = true;\n        if (envIndicator) envIndicator.textContent = 'DEV';\n    } else {\n        if (envIndicator) envIndicator.textContent = 'PROD';\n    }\n}\n\n// 加载配置\nfunction loadConfig() {\n    fetch('/api/config')\n        .then(function(response) {\n            if (!response.ok) {\n                throw new Error('HTTP ' + response.status);\n            }\n            return response.json();\n        })\n        .then(function(data) {\n            if (data.success && data.config) {\n                currentConfig = data.config;\n                // 保存原始配置用于对比\n                originalConfig = JSON.parse(JSON.stringify(data.config));\n                loadConfigToForm();\n                showNotification('配置加载成功', 'success');\n            } else {\n                throw new Error('配置数据无效');\n            }\n        })\n        .catch(function(error) {\n            showNotification('加载失败：' + error.message, 'error');\n        });\n}\n\n// 加载配置到表单\nfunction loadConfigToForm() {\n    // 确保所有配置组都存在\n    currentConfig.profile = currentConfig.profile || {};\n    currentConfig.socialLinks = currentConfig.socialLinks || [];\n    currentConfig.appearance = currentConfig.appearance || {};\n    currentConfig.effects = currentConfig.effects || {};\n    currentConfig.security = currentConfig.security || {};\n    \n    // 基本信息\n    document.getElementById('username').value = currentConfig.profile.username || '';\n    document.getElementById('bio').value = currentConfig.profile.bio || '';\n\n    // 头像 URL 列表\n    var avatarContainer = document.getElementById('avatarUrlsContainer');\n    avatarContainer.innerHTML = '';\n    avatarUrlInputCount = 0;\n\n    var avatarUrls = currentConfig.profile.avatarUrls || [];\n    if (avatarUrls.length > 0) {\n        avatarUrls.forEach(function(url) {\n            createAvatarUrlInput(url);\n        });\n    } else {\n        createAvatarUrlInput('');\n    }\n    updateAvatarPreviewGrid(avatarUrls);\n\n    // 社交链接\n    renderSocialLinks(currentConfig.socialLinks);\n\n    // 外观设置\n    document.getElementById('backgroundImage').value = currentConfig.appearance.backgroundImage || '';\n    updateBgPreview(currentConfig.appearance.backgroundImage, 'bgPreview');\n    document.getElementById('portraitBackgroundImage').value = currentConfig.appearance.portraitBackgroundImage || '';\n    updateBgPreview(currentConfig.appearance.portraitBackgroundImage, 'portraitBgPreview');\n\n    document.getElementById('overlayOpacity').value = currentConfig.appearance.overlayOpacity || 0.4;\n    document.getElementById('backdropBlur').value = currentConfig.appearance.backdropBlur || 10;\n    document.getElementById('cardOpacity').value = currentConfig.appearance.cardOpacity || 0.15;\n    document.getElementById('footer').value = currentConfig.appearance.footer || '';\n\n    // 更新滑块显示值\n    updateSliderValue('overlayOpacity', 'overlayOpacityValue');\n    updateSliderValue('backdropBlur', 'backdropBlurValue');\n    updateSliderValue('cardOpacity', 'cardOpacityValue');\n\n    // 动态效果\n    document.getElementById('effectsEnabled').checked = currentConfig.effects.enabled !== false;\n    document.getElementById('rotationIntensity').value = currentConfig.effects.rotationIntensity || 1.0;\n    document.getElementById('parallaxIntensity').value = currentConfig.effects.parallaxIntensity || 1.0;\n    document.getElementById('recoveryDuration').value = currentConfig.effects.recoveryDuration || 500;\n\n    // 更新动态效果滑块显示值\n    updateSliderValue('rotationIntensity', 'rotationIntensityValue');\n    updateSliderValue('parallaxIntensity', 'parallaxIntensityValue');\n    updateSliderValue('recoveryDuration', 'recoveryDurationValue');\n\n    // 安全设置 - 确保正确加载数据库中的值\n    var security = currentConfig.security || {};\n    document.getElementById('disableRightClick').checked = security.disableRightClick !== false;\n    document.getElementById('disableDevTools').checked = security.disableDevTools === true;\n}\n\n// 更新滑块显示值\nfunction updateSliderValue(sliderId, valueId) {\n    const slider = document.getElementById(sliderId);\n    const valueSpan = document.getElementById(valueId);\n    if (slider && valueSpan) {\n        valueSpan.textContent = slider.value;\n    }\n}\n\n// 渲染社交链接\nfunction renderSocialLinks(links) {\n    const container = document.getElementById('socialLinksContainer');\n    container.innerHTML = '';\n    socialLinkCount = 0;\n\n    links.forEach(function(link, index) {\n        createSocialLinkCard(link, index);\n    });\n}\n\n// 创建社交链接卡片\nfunction createSocialLinkCard(link, index) {\n    const container = document.getElementById('socialLinksContainer');\n    const cardId = socialLinkCount++;\n\n    const card = document.createElement('div');\n    card.className = 'social-link-card compact';\n    card.dataset.index = index;\n    card.innerHTML = \`\n        <div class="compact-grid">\n            <div class="compact-field">\n                <label>名称</label>\n                <input type="text" class="link-name" value="\${link.name || ''}" placeholder="GitHub" />\n            </div>\n            <div class="compact-field">\n                <label>链接</label>\n                <input type="text" class="link-url" value="\${link.url || ''}" placeholder="https://github.com/yourname" />\n            </div>\n            <div class="compact-field">\n                <label>图标类名</label>\n                <input type="text" class="link-icon" value="\${link.icon || ''}" placeholder="fab fa-github" />\n            </div>\n            <div class="compact-field">\n                <label>背景颜色</label>\n                <div class="color-picker-compact">\n                    <input type="color" class="link-color-picker" value="\${rgbaToHex(link.color || 'rgba(51, 51, 51, 0.8)')}" />\n                    <input type="text" class="link-color" value="\${link.color || 'rgba(51, 51, 51, 0.8)'}" />\n                    <span class="color-preview-compact" style="background: \${link.color || 'rgba(51, 51, 51, 0.8)'}"></span>\n                </div>\n            </div>\n            <div class="compact-field full-width">\n                <label>链接预览</label>\n                <div class="link-preview" style="background: \${link.color || 'rgba(51, 51, 51, 0.8)'}">\n                    <i class="\${link.icon || 'fas fa-link'}"></i>\n                    <span>\${link.name || 'Link'}</span>\n                </div>\n            </div>\n        </div>\n        <div class="social-link-actions">\n            <button class="btn btn-primary btn-sm" onclick="moveLinkUp(\${index})"><i class="fas fa-arrow-up"></i> 上移</button>\n            <button class="btn btn-primary btn-sm" onclick="moveLinkDown(\${index})"><i class="fas fa-arrow-down"></i> 下移</button>\n            <button class="btn btn-danger btn-sm" onclick="deleteSocialLink(\${index})"><i class="fas fa-trash"></i> 删除</button>\n        </div>\n    \`;\n\n    // 绑定颜色选择器事件\n    const colorPicker = card.querySelector('.link-color-picker');\n    const colorInput = card.querySelector('.link-color');\n    const colorPreview = card.querySelector('.color-preview-compact');\n    const linkPreview = card.querySelector('.link-preview');\n    const linkIcon = card.querySelector('.link-preview i');\n\n    colorPicker.addEventListener('input', function(e) {\n        const hex = e.target.value;\n        const rgba = hexToRgba(hex, 0.8);\n        colorInput.value = rgba;\n        colorPreview.style.background = rgba;\n        linkPreview.style.background = rgba;\n    });\n\n    colorInput.addEventListener('input', function(e) {\n        colorPreview.style.background = e.target.value;\n        linkPreview.style.background = e.target.value;\n    });\n\n    // 绑定名称和图标变化更新预览\n    const nameInput = card.querySelector('.link-name');\n    const iconInput = card.querySelector('.link-icon');\n    \n    nameInput.addEventListener('input', function(e) {\n        linkPreview.querySelector('span').textContent = e.target.value || 'Link';\n    });\n    \n    iconInput.addEventListener('input', function(e) {\n        linkPreview.querySelector('i').className = e.target.value || 'fas fa-link';\n    });\n\n    container.appendChild(card);\n}\n\n// 添加社交链接\nfunction addSocialLink() {\n    const newLink = {\n        name: 'New Link',\n        url: 'https://',\n        icon: 'fab fa-link',\n        color: 'rgba(102, 126, 234, 0.8)'\n    };\n    createSocialLinkCard(newLink, currentConfig.socialLinks.length);\n}\n\n// 删除社交链接\nfunction deleteSocialLink(index) {\n    if (confirm('确定要删除这个链接吗？')) {\n        const cards = document.querySelectorAll('.social-link-card');\n        if (index < cards.length) {\n            cards[index].remove();\n            collectFormConfig();\n        }\n    }\n}\n\n// 上移链接\nfunction moveLinkUp(index) {\n    const cards = document.querySelectorAll('.social-link-card');\n    if (index > 0 && index < cards.length) {\n        cards[index - 1].before(cards[index]);\n        collectFormConfig();\n    }\n}\n\n// 下移链接\nfunction moveLinkDown(index) {\n    const cards = document.querySelectorAll('.social-link-card');\n    if (index >= 0 && index < cards.length - 1) {\n        cards[index + 1].after(cards[index]);\n        collectFormConfig();\n    }\n}\n\n// 创建头像 URL 输入框\nfunction createAvatarUrlInput(url) {\n    var container = document.getElementById('avatarUrlsContainer');\n    var index = avatarUrlInputCount++;\n\n    var group = document.createElement('div');\n    group.className = 'avatar-url-input-group';\n    group.dataset.index = index;\n    group.innerHTML = \`\n        <input type="text" class="avatar-url-input" value="\${url || ''}" placeholder="https://..." />\n        <button class="btn btn-remove-sm" title="删除">\n            <i class="fas fa-trash"></i>\n        </button>\n    \`;\n\n    const input = group.querySelector('.avatar-url-input');\n    const deleteBtn = group.querySelector('.btn-remove-sm');\n    \n    input.addEventListener('input', updateAvatarPreviewGridFromInputs);\n    deleteBtn.addEventListener('click', function() {\n        removeAvatarUrlInput(group);\n    });\n\n    container.appendChild(group);\n}\n\n// 添加头像 URL 输入框\nfunction addAvatarUrlInput() {\n    createAvatarUrlInput('');\n    updateAvatarPreviewGridFromInputs();\n}\n\n// 删除头像 URL 输入框\nfunction removeAvatarUrlInput(group) {\n    var container = document.getElementById('avatarUrlsContainer');\n    var inputs = container.querySelectorAll('.avatar-url-input-group');\n    if (inputs.length <= 1) {\n        alert('至少保留一个头像 URL');\n        return;\n    }\n    group.remove();\n    updateAvatarPreviewGridFromInputs();\n}\n\n// 从输入框更新预览网格\nfunction updateAvatarPreviewGridFromInputs() {\n    var container = document.getElementById('avatarUrlsContainer');\n    var inputs = container.querySelectorAll('.avatar-url-input');\n    var urls = [];\n    inputs.forEach(function(input) {\n        if (input.value && input.value.trim()) {\n            urls.push(input.value.trim());\n        }\n    });\n    updateAvatarPreviewGrid(urls);\n}\n\n// 更新头像预览网格\nfunction updateAvatarPreviewGrid(urls) {\n    const grid = document.getElementById('avatarPreviewGrid');\n    if (!grid) return;\n\n    grid.innerHTML = '';\n    urls.forEach(function(url) {\n        if (url && url.trim()) {\n            var item = document.createElement('div');\n            item.className = 'avatar-preview-item';\n            item.innerHTML = '<img src="' + url + '" alt="头像预览" onerror="this.style.display=\\'none\\'" />';\n            grid.appendChild(item);\n        }\n    });\n}\n\n// 更新背景预览\nfunction updateBgPreview(url, previewId) {\n    const preview = document.getElementById(previewId);\n    if (preview) {\n        preview.style.backgroundImage = url ? \`url('\${url}')\` : 'none';\n    }\n}\n\n// 设置事件监听\nfunction setupEventListeners() {\n    // 添加头像按钮\n    document.getElementById('addAvatarBtn').addEventListener('click', addAvatarUrlInput);\n\n    // 背景预览\n    document.getElementById('backgroundImage').addEventListener('input', function(e) {\n        updateBgPreview(e.target.value, 'bgPreview');\n    });\n\n    document.getElementById('portraitBackgroundImage').addEventListener('input', function(e) {\n        updateBgPreview(e.target.value, 'portraitBgPreview');\n    });\n\n    // 滑块值更新\n    const sliders = [\n        { id: 'overlayOpacity', valueId: 'overlayOpacityValue' },\n        { id: 'backdropBlur', valueId: 'backdropBlurValue' },\n        { id: 'cardOpacity', valueId: 'cardOpacityValue' },\n        { id: 'rotationIntensity', valueId: 'rotationIntensityValue' },\n        { id: 'parallaxIntensity', valueId: 'parallaxIntensityValue' },\n        { id: 'recoveryDuration', valueId: 'recoveryDurationValue' }\n    ];\n\n    sliders.forEach(function(item) {\n        document.getElementById(item.id).addEventListener('input', function() {\n            updateSliderValue(item.id, item.valueId);\n        });\n    });\n\n    // 键盘保存快捷键 Ctrl+S\n    document.addEventListener('keydown', function(e) {\n        if (e.ctrlKey && e.key === 's') {\n            e.preventDefault();\n            saveAllConfig();\n        }\n    });\n}\n\n// 从表单收集配置\nfunction collectFormConfig() {\n    // 收集头像 URL 列表\n    var avatarUrls = [];\n    var avatarContainer = document.getElementById('avatarUrlsContainer');\n    var avatarInputs = avatarContainer.querySelectorAll('.avatar-url-input');\n    avatarInputs.forEach(function(input) {\n        if (input.value && input.value.trim()) {\n            avatarUrls.push(input.value.trim());\n        }\n    });\n\n    // 收集社交链接\n    const linkCards = document.querySelectorAll('.social-link-card');\n    const socialLinks = [];\n    linkCards.forEach(function(card) {\n        socialLinks.push({\n            name: card.querySelector('.link-name').value,\n            url: card.querySelector('.link-url').value,\n            icon: card.querySelector('.link-icon').value,\n            color: card.querySelector('.link-color').value\n        });\n    });\n\n    currentConfig = {\n        profile: {\n            username: document.getElementById('username').value,\n            bio: document.getElementById('bio').value,\n            avatarUrls: avatarUrls\n        },\n        socialLinks: socialLinks,\n        appearance: {\n            backgroundImage: document.getElementById('backgroundImage').value,\n            portraitBackgroundImage: document.getElementById('portraitBackgroundImage').value,\n            overlayOpacity: parseFloat(document.getElementById('overlayOpacity').value),\n            backdropBlur: parseInt(document.getElementById('backdropBlur').value),\n            cardOpacity: parseFloat(document.getElementById('cardOpacity').value),\n            footer: document.getElementById('footer').value\n        },\n        effects: {\n            enabled: document.getElementById('effectsEnabled').checked,\n            rotationIntensity: parseFloat(document.getElementById('rotationIntensity').value),\n            parallaxIntensity: parseFloat(document.getElementById('parallaxIntensity').value),\n            recoveryDuration: parseInt(document.getElementById('recoveryDuration').value)\n        },\n        security: {\n            disableRightClick: document.getElementById('disableRightClick').checked,\n            disableDevTools: document.getElementById('disableDevTools').checked\n        }\n    };\n\n    return currentConfig;\n}\n\n// 深度比较两个对象是否相等\nfunction deepEqual(obj1, obj2) {\n    return JSON.stringify(obj1) === JSON.stringify(obj2);\n}\n\n// 保存所有配置（只保存有改动的）\nfunction saveAllConfig() {\n    currentConfig = collectFormConfig();\n\n    const groups = ['profile', 'socialLinks', 'appearance', 'effects', 'security'];\n    let savedCount = 0;\n    let errorCount = 0;\n    let hasChanges = false;\n\n    // 检查哪些配置组有改动\n    groups.forEach(function(group) {\n        if (!deepEqual(currentConfig[group], originalConfig[group])) {\n            hasChanges = true;\n        }\n    });\n\n    if (!hasChanges) {\n        showNotification('配置已保存！', 'success');\n        return;\n    }\n\n    // 只保存有改动的配置组\n    function saveGroup(index) {\n        if (index >= groups.length) {\n            if (errorCount === 0) {\n                showNotification('配置已保存！', 'success');\n                // 更新原始配置\n                originalConfig = JSON.parse(JSON.stringify(currentConfig));\n            } else {\n                showNotification(\`保存完成，\${savedCount}成功，\${errorCount}失败\`, 'warning');\n            }\n            return;\n        }\n\n        const group = groups[index];\n        \n        // 如果这个配置组没有改动，跳过\n        if (deepEqual(currentConfig[group], originalConfig[group])) {\n            saveGroup(index + 1);\n            return;\n        }\n\n        const data = currentConfig[group];\n\n        // 获取存储的 Token\n        const token = localStorage.getItem('adminToken') || 'enkansakura';\n\n        fetch('/api/update', {\n            method: 'POST',\n            headers: {\n                'Content-Type': 'application/json',\n                'Authorization': 'Bearer ' + token\n            },\n            body: JSON.stringify({\n                group: group,\n                data: data\n            })\n        })\n        .then(function(response) {\n            return response.json();\n        })\n        .then(function(result) {\n            if (result.success) {\n                savedCount++;\n            } else {\n                errorCount++;\n            }\n            saveGroup(index + 1);\n        })\n        .catch(function(error) {\n            errorCount++;\n            saveGroup(index + 1);\n        });\n    }\n\n    saveGroup(0);\n}\n\n// 重置配置\nfunction resetConfig() {\n    if (confirm('确定要重置为默认配置吗？此操作不可恢复！')) {\n        fetch('/api/reset', {\n            method: 'POST',\n            headers: {\n                'Content-Type': 'application/json'\n            }\n        })\n        .then(function(response) {\n            return response.json();\n        })\n        .then(function(data) {\n            if (data.success) {\n                showNotification('配置已重置为默认值', 'success');\n                loadConfig();\n            } else {\n                showNotification('重置失败：' + data.error, 'error');\n            }\n        })\n        .catch(function(error) {\n            showNotification('重置失败：' + error.message, 'error');\n        });\n    }\n}\n\n// 显示通知\nfunction showNotification(message, type) {\n    const notification = document.getElementById('notification');\n    notification.textContent = message;\n    notification.className = 'save-notification ' + type + ' show';\n    setTimeout(function() {\n        notification.classList.remove('show');\n    }, 3000);\n}\n\n// ============================================\n// Token 管理功能\n// ============================================\n\n// 打开 Token 修改模态框\nfunction openTokenModal() {\n    document.getElementById('tokenModal').classList.add('show');\n    document.getElementById('currentToken').value = '';\n    document.getElementById('newToken').value = '';\n    document.getElementById('confirmToken').value = '';\n    document.getElementById('confirmStatus').className = 'confirm-status';\n    document.getElementById('confirmStatus').innerHTML = '';\n}\n\n// 关闭 Token 修改模态框\nfunction closeTokenModal() {\n    document.getElementById('tokenModal').classList.remove('show');\n}\n\n// 验证 Token 一致性\nfunction checkTokenMatch() {\n    const newToken = document.getElementById('newToken').value;\n    const confirmToken = document.getElementById('confirmToken').value;\n    const confirmStatus = document.getElementById('confirmStatus');\n\n    if (confirmToken.length === 0) {\n        confirmStatus.className = 'confirm-status';\n        confirmStatus.innerHTML = '';\n    } else if (newToken === confirmToken) {\n        confirmStatus.className = 'confirm-status match';\n        confirmStatus.innerHTML = '<i class="fas fa-check-circle"></i> Token 一致';\n    } else {\n        confirmStatus.className = 'confirm-status mismatch';\n        confirmStatus.innerHTML = '<i class="fas fa-times-circle"></i> Token 不一致';\n    }\n}\n\n// 修改 Token\nfunction changeToken() {\n    const currentToken = document.getElementById('currentToken').value;\n    const newToken = document.getElementById('newToken').value;\n    const confirmToken = document.getElementById('confirmToken').value;\n\n    // 验证输入\n    if (!currentToken || !newToken || !confirmToken) {\n        showNotification('请填写所有字段', 'error');\n        return;\n    }\n\n    if (newToken.length < 6) {\n        showNotification('Token 长度至少为 6 位', 'error');\n        return;\n    }\n\n    if (newToken !== confirmToken) {\n        showNotification('两次输入的新 Token 不一致', 'error');\n        return;\n    }\n\n    // 验证当前 Token\n    const storedToken = localStorage.getItem('adminToken') || 'enkansakura';\n    if (currentToken !== storedToken) {\n        showNotification('当前 Token 错误', 'error');\n        return;\n    }\n\n    // 保存新 Token\n    localStorage.setItem('adminToken', newToken);\n    closeTokenModal();\n    showNotification('Token 已修改成功，请妥善保管', 'success');\n}\n\n// 绑定 Token 匹配检查\ndocument.addEventListener('DOMContentLoaded', function() {\n    const newTokenInput = document.getElementById('newToken');\n    const confirmTokenInput = document.getElementById('confirmToken');\n\n    if (newTokenInput) {\n        newTokenInput.addEventListener('input', checkTokenMatch);\n    }\n\n    if (confirmTokenInput) {\n        confirmTokenInput.addEventListener('input', checkTokenMatch);\n    }\n});\n\n// 颜色格式转换工具\nfunction rgbaToHex(rgba) {\n    if (!rgba) return '#333333';\n    const match = rgba.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);\n    if (!match) return '#333333';\n    return '#' + [match[1], match[2], match[3]].map(function(x) {\n        const hex = parseInt(x).toString(16);\n        return hex.length === 1 ? '0' + hex : hex;\n    }).join('');\n}\n\nfunction hexToRgba(hex, alpha) {\n    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);\n    if (!result) return 'rgba(51, 51, 51, ' + alpha + ')';\n    return 'rgba(' + parseInt(result[1], 16) + ', ' + parseInt(result[2], 16) + ', ' + parseInt(result[3], 16) + ', ' + alpha + ')';\n}\n`
};

async function serveStaticFile(path) {
    if (path === '/' || path === '') {
        path = '/index.html';
    }

    const cleanPath = path.slice(1);

    // 安全检查
    if (cleanPath.includes('..') || cleanPath.includes('\\')) {
        return new Response('Forbidden', { status: 403 });
    }

    const ext = '.' + cleanPath.split('.').pop().toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 从内嵌文件获取
    if (STATIC_FILES[cleanPath]) {
        return new Response(STATIC_FILES[cleanPath], {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }

    // 尝试从 ASSETS 获取（Pages 部署时）
    if (typeof ASSETS !== 'undefined' && ASSETS) {
        try {
            const assetUrl = new URL(cleanPath, 'http://localhost');
            const response = await fetch(assetUrl);
            if (response.ok) {
                return new Response(response.body, {
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=31536000'
                    }
                });
            }
        } catch (e) {
            // 忽略错误，继续返回 404
        }
    }

    return new Response('File not found: ' + cleanPath, {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
    });
}
