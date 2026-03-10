// 后台认证页面脚本
let authMethod = null;
let authError = null;

document.addEventListener("DOMContentLoaded", function() {
    loadAuthConfig();
    setupEventListeners();
});

// 从 API 加载认证配置
function loadAuthConfig() {
    fetch("/api/auth-config")
        .then(function(r) {
            if (r.ok) return r.json();
            throw new Error("网络响应失败");
        })
        .then(function(data) {
            if (!data || !data.success || !data.config) {
                showError("认证配置加载失败，请刷新页面");
                return;
            }

            var config = data.config;

            // 检查是否有配置错误
            if (config.error) {
                showError(config.error);
                return;
            }

            authMethod = config.authMethod;

            // 检查 AUTH_FUNC 是否有有效值
            if (!authMethod || (authMethod !== 'dev' && authMethod !== 'key' && authMethod !== 'zerotrust')) {
                showError("服务器认证方式配置无效，请联系管理员");
                return;
            }

            // key 模式：检查 AUTH_KEY 是否配置
            if (authMethod === 'key' && !config.token && !config.hasAuthKey) {
                showError("服务器未配置 AUTH_KEY，请联系管理员");
                return;
            }

            // 根据认证模式更新界面
            updateUIForAuth();
        })
        .catch(function(err) {
            console.error("加载认证配置失败:", err);
            showError("认证配置加载失败，请刷新页面");
        });
}

// 更新界面显示
function updateUIForAuth() {
    var devHint = document.getElementById("devHint");
    var devBtn = document.getElementById("devBtn");
    var tokenInputGroup = document.getElementById("tokenInputGroup");
    var zerotrustHint = document.getElementById("zerotrustHint");
    var zerotrustBtn = document.getElementById("zerotrustBtn");
    var submitBtn = document.getElementById("submitBtn");
    var formTitle = document.querySelector(".subtitle");

    // 隐藏所有元素
    if (devHint) devHint.style.display = "none";
    if (devBtn) devBtn.style.display = "none";
    if (tokenInputGroup) tokenInputGroup.style.display = "none";
    if (zerotrustHint) zerotrustHint.style.display = "none";
    if (zerotrustBtn) zerotrustBtn.style.display = "none";
    if (submitBtn) submitBtn.style.display = "none";

    if (authMethod === 'dev') {
        // dev 模式：显示直接进入按钮
        if (formTitle) formTitle.textContent = "开发环境，点击按钮直接进入后台";
        if (devHint) devHint.style.display = "flex";
        if (devBtn) devBtn.style.display = "flex";

    } else if (authMethod === 'key') {
        // key 模式：显示 token 输入框和确认按钮
        if (formTitle) formTitle.textContent = "请输入 Token 以访问后台管理系统";
        if (tokenInputGroup) tokenInputGroup.style.display = "block";
        if (submitBtn) submitBtn.style.display = "flex";

    } else if (authMethod === 'zerotrust') {
        // zerotrust 模式：显示进入按钮（cloudflare 已认证）
        if (formTitle) formTitle.textContent = "Cloudflare Zero Trust 认证通过，点击进入后台";
        if (zerotrustHint) zerotrustHint.style.display = "flex";
        if (zerotrustBtn) zerotrustBtn.style.display = "flex";
    }
}

// 设置事件监听
function setupEventListeners() {
    var tokenInput = document.getElementById("token");
    if (tokenInput) {
        tokenInput.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAuth();
            }
        });
    }
}

// dev 模式：直接进入后台
function devEnter() {
    showNotification("已进入管理后台", "success");
    setTimeout(function() {
        window.location.href = "/admin.html?dev=true";
    }, 1000);
}

// zerotrust 模式：直接进入后台（cloudflare 已认证）
function zerotrustEnter() {
    showNotification("已进入管理后台", "success");
    setTimeout(function() {
        window.location.href = "/admin.html?zerotrust=true";
    }, 1000);
}

// key 模式：验证 token 并进入后台
function handleAuth() {
    var tokenInput = document.getElementById("token");
    var token = tokenInput ? tokenInput.value.trim() : "";

    if (!token) {
        showNotification("请输入 Token", "error");
        if (tokenInput) tokenInput.focus();
        return;
    }

    if (token.length < 6) {
        showNotification("Token 长度至少为 6 位", "error");
        if (tokenInput) tokenInput.focus();
        return;
    }

    // 调用 API 验证 token
    fetch("/api/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token })
    })
    .then(function(r) {
        if (r.ok) return r.json();
        throw new Error("验证失败");
    })
    .then(function(data) {
        if (data && data.valid) {
            showNotification("认证成功，正在跳转...", "success");
            setTimeout(function() {
                window.location.href = "/admin.html?token=" + encodeURIComponent(token);
            }, 1000);
        } else {
            var errorMsg = data && data.error ? data.error : "Token 错误，请重新输入";
            showNotification(errorMsg, "error");
            if (tokenInput) {
                tokenInput.value = "";
                tokenInput.focus();
            }
        }
    })
    .catch(function(err) {
        console.error("Token 验证失败:", err);
        showNotification("Token 验证失败，请重试", "error");
        if (tokenInput) {
            tokenInput.value = "";
            tokenInput.focus();
        }
    });
}

// 显示错误信息
function showError(message) {
    authError = message;
    var notification = document.getElementById("notification");
    if (notification) {
        notification.textContent = message;
        notification.className = "auth-notification error show";
    }
    // 隐藏表单
    var form = document.getElementById("authForm");
    if (form) form.style.display = "none";
}

// 显示通知
function showNotification(message, type) {
    var notification = document.getElementById("notification");
    if (notification) {
        notification.textContent = message;
        notification.className = "auth-notification " + type + " show";
        setTimeout(function() {
            notification.classList.remove("show");
        }, 3000);
    }
}
