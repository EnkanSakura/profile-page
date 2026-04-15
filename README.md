# 个人社媒链接展示页

> **个人 Vibe Coding 测试产品** - 整个项目由 AI 生成

一个基于 Cloudflare Workers + D1 的个人社交链接展示页面，支持可视化配置管理。

---

## 🤖 AI 生成声明

本项目是一个 **Vibe Coding 测试产品**，用于探索 AI 辅助开发的完整工作流程。

| 项目 | 说明 |
|------|------|
| **生成方式** | 100% 由 AI 生成代码 |
| **AI 模型** | Qwen Code (通义千问) |
| **开发模式** | Vibe Coding - 通过自然语言对话完成开发 |
| **人工参与** | 需求描述、功能调整、最终审核 |

---

## ✨ 功能特性

- 🎨 美观现代的 UI 设计，支持毛玻璃效果和 3D 动态效果
- 🌍 响应式布局，适配桌面端和移动端
- ⚡ 基于 Cloudflare Workers 边缘计算，全球加速
- 💾 使用 Cloudflare D1 数据库持久化存储配置
- 🔐 三种认证模式：dev / key / Zero Trust
- 🎯 可视化后台管理，无需编写代码
- 📱 支持多个头像随机显示
- 🖼️ 支持横屏/竖屏背景图片分别设置

---

## 🔐 认证模式

项目支持三种认证方式，通过 `AUTH_FUNC` 环境变量切换：

| 模式 | 说明 | 配置 | 适用场景 |
|------|------|------|----------|
| **dev** | 开发模式，点击按钮直接进入 | `AUTH_FUNC=dev` | 本地开发 |
| **key** | Token 认证，输入正确 token 后进入 | `AUTH_FUNC=key` + `AUTH_KEY=xxx` | 简单保护 |
| **zerotrust** | Cloudflare Zero Trust 认证 | `AUTH_FUNC=zerotrust` | 生产环境 |

### 配置方法

在 `wrangler.toml` 中设置：

```toml
[vars]
AUTH_FUNC = "dev"  # dev | key | zerotrust

[env.production.vars]
AUTH_FUNC = "zerotrust"
AUTH_KEY = "your-secret-token"  # key 模式需要
```

---

## 🚀 快速开始

### 前置要求

- Node.js 16+ 和 npm
- Cloudflare 账号（免费套餐即可）
- Wrangler CLI

### 1. 克隆项目

```bash
git clone https://github.com/your-username/profile-page.git
cd profile-page
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 Cloudflare

登录 Cloudflare：

```bash
wrangler login
```

### 4. 创建 D1 数据库

```bash
wrangler d1 create profile-page-db
```

复制输出的 `database_id`，更新 `wrangler.toml` 中的对应字段。

### 5. 初始化数据库

```bash
# 本地开发
wrangler d1 execute profile-page-db --local --file=d1-schema.sql

# 生产环境
wrangler d1 execute profile-page-db --remote --file=d1-schema.sql
```

### 6. 本地开发

```bash
# 默认模式（使用 wrangler.toml 全局配置）
npm run dev

# dev 模式（免认证直接进入）
npm run dev:dev

# key 模式（token 认证，token=aaaaaa）
npm run dev:key

# zerotrust 模式（免认证直接进入）
npm run dev:zerotrust
```

访问：
- **前台主页**: http://localhost:8787/
- **后台管理**: http://localhost:8787/admin.html
- **认证页**: http://localhost:8787/admin

### 7. 部署到生产环境

```bash
npm run deploy
```

---

## 📋 配置说明

### 后台管理功能

访问 `/admin.html` 进入后台管理界面，可以配置：

#### 基本信息
- **用户名**: 显示在主页的名称
- **个人简介**: 个人描述文字
- **头像列表**: 支持多个头像 URL，每次加载随机显示

#### 社交链接
- **名称**: 链接显示名称（如 GitHub）
- **URL**: 链接地址
- **图标**: Font Awesome 图标类名
- **背景颜色**: 链接卡片背景色
- **排序**: 支持上移/下移调整顺序

#### 外观设置
- **横屏背景**: 桌面端背景图片 URL
- **竖屏背景**: 移动端背景图片 URL（可选）
- **背景遮罩透明度**: 0-1，控制背景明暗
- **毛玻璃模糊强度**: 0-30px，卡片背景模糊效果
- **卡片透明度**: 0-1，控制卡片透明程度
- **页脚文字**: 页面底部版权信息

#### 动态效果
- **启用 3D 效果**: 开关控制
- **3D 翻转强度**: 0-2，鼠标移动时卡片翻转强度
- **背景视差强度**: 0-2，背景图片视差效果强度
- **恢复时间**: 100-2000ms，鼠标离开后恢复原位的时间

#### 安全设置
- **禁止右键菜单**: 防止简单复制
- **禁止开发者工具**: 禁用 F12 等快捷键

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存配置 |

### 配置保存逻辑

- ✅ **智能检测**: 只保存有改动的配置项
- ✅ **无改动提示**: 没有改动时提示"无需保存"
- ✅ **部分更新**: 只发送改动的配置到服务器

---

## 🏗️ 技术栈

### 前端
- **HTML5** - 页面结构
- **CSS3** - 样式和动画效果
- **JavaScript (ES6+)** - 交互逻辑

### 后端
- **Cloudflare Workers** - 无服务器运行时
- **Cloudflare D1** - SQLite 数据库
- **Cloudflare Pages** - 静态资源托管（可选）

### 开发工具
- **Wrangler** - Cloudflare 开发工具
- **Font Awesome** - 图标库

### 部署
- **Cloudflare** - 全球边缘网络
- **GitHub Actions** - 自动部署（可选）

---

## 📁 项目结构

```
profile-page/
├── 前台文件
│   ├── index.html          # 主页
│   ├── styles.css          # 前台样式
│   └── app.js              # 前台脚本
│
├── 后台文件
│   ├── admin.html          # 管理后台
│   ├── admin.js            # 后台脚本
│   └── admin.css    # 后台样式
│
├── Cloudflare Workers
│   ├── workers.js          # Workers 主文件
│   ├── wrangler.toml       # Workers 配置
│   └── d1-schema.sql       # D1 数据库结构
│
├── 配置文件
│   ├── package.json        # NPM 依赖
│   └── .gitignore          # Git 忽略规则
│
└── README.md               # 项目说明
```

---

## 🔌 API 接口

| 接口 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/config` | GET | 获取所有配置 | 否 |
| `/api/config/:group` | GET | 获取指定配置组 | 否 |
| `/api/update` | POST | 更新配置组 | 是 |
| `/api/reset` | POST | 重置为默认配置 | 是 |

### 请求示例

**更新配置**:
```bash
curl -X POST https://your-domain.workers.dev/api/update \
  -H "Content-Type: application/json" \
  -d '{
    "group": "profile",
    "data": {
      "username": "@YourName",
      "bio": "新的简介",
      "avatarUrls": ["https://..."]
    }
  }'
```

---

## 💰 费用说明

### Cloudflare 免费套餐

| 资源 | 免费额度 | 说明 |
|------|---------|------|
| **Workers** | 100,000 次/天 | 足够个人使用 |
| **D1 存储** | 5 GB | 配置数据占用极小 |
| **D1 读取** | 500 万次/月 | - |
| **D1 写入** | 100 万次/月 | - |
| **KV 存储** | 1 GB | 配置缓存 |
| **KV 读取** | 100,000 次/天 | - |

**结论**: 完全免费，适合个人使用。

---

## 🔧 缓存配置

项目使用两种缓存方式：

### 1. KV 缓存（配置数据）

**用途**：缓存配置数据，减少 D1 读取

**配置步骤**：

1. 创建 KV namespace：
```bash
wrangler kv:namespace create CONFIG_CACHE
```

2. 复制输出的 `id`，更新 `wrangler.toml` 中的 `your-kv-namespace-id`

3. 本地开发使用独立 namespace：
```bash
wrangler kv:namespace create CONFIG_CACHE --preview
```

### 2. Cache API（静态资源）

**用途**：缓存静态资源（图片、CSS、JS）

**配置**：无需额外配置，自动使用 Cloudflare 边缘缓存

**缓存策略**：
- 图片资源：缓存 1 年
- HTML/CSS/JS：缓存 1 小时
- API 响应：不缓存

---

## 🔒 安全说明

### 认证模式详解

#### 1. dev 模式（开发环境）
- **认证方式**：免认证
- **界面显示**：⚡ 快速进入按钮
- **跳转 URL**：`/admin.html?dev=true`
- **适用场景**：本地开发调试

#### 2. key 模式（Token 认证）
- **认证方式**：输入正确 token
- **界面显示**：🔑 Token 输入框 + 认证按钮
- **验证逻辑**：调用 `/api/validate-token` API
- **环境变量**：`AUTH_FUNC=key` + `AUTH_KEY=your-token`
- **适用场景**：简单保护，防止未授权访问

#### 3. zerotrust 模式（Cloudflare Zero Trust）
- **认证方式**：Cloudflare Access 外部认证
- **界面显示**：☁️ 进入后台按钮
- **跳转 URL**：`/admin.html`
- **认证流程**：
  1. 用户访问受保护的资源
  2. Cloudflare Access 拦截并验证用户身份
  3. 验证通过后允许访问 Worker
  4. 点击按钮直接进入后台
- **环境变量**：`AUTH_FUNC=zerotrust`
- **适用场景**：生产环境，企业级安全

### 配置步骤

#### Zero Trust 配置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Zero Trust** → **Access** → **Applications**
3. 创建新应用，选择 **Self-hosted**
4. 配置 Worker 路由：`me.enkansakura.top/*`
5. 配置允许的邮箱域名或服务 ID
6. 在 `wrangler.toml` 中设置 `AUTH_FUNC=zerotrust`

#### Token 认证配置

1. 设置环境变量：
```toml
[env.production.vars]
AUTH_FUNC = "key"
AUTH_KEY = "your-secret-token"
```

2. 通过 `wrangler secret` 设置敏感信息：
```bash
wrangler secret put AUTH_KEY --env production
```

### 错误处理

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| 服务器认证方式配置无效 | `AUTH_FUNC` 未设置或值无效 | 检查环境变量配置 |
| 服务器未配置 AUTH_KEY | `AUTH_FUNC=key` 但未设置 `AUTH_KEY` | 设置 `AUTH_KEY` 环境变量 |
| Token 错误 | 输入的 token 不匹配 | 检查 token 是否正确 |
| 认证配置加载失败 | 网络问题或 API 错误 | 刷新页面重试 |

---

## 🧪 测试与验证

### 本地测试

```bash
# 启动开发服务器
npm run dev

# 查看数据库
wrangler d1 execute profile-page-db --local --command="SELECT * FROM config"
```

### 生产验证

```bash
# 查看远程数据库
wrangler d1 execute profile-page-db --remote --command="SELECT * FROM config"

# 查看日志
wrangler tail
```

---

## 📝 常见问题

### Q: 本地开发时保存配置提示失败？

**A**: 确保已执行数据库初始化：
```bash
wrangler d1 execute profile-page-db --local --file=d1-schema.sql
```

### Q: 修改配置后页面没有变化？

**A**: 
1. 确认保存成功（看到"配置已保存！"提示）
2. 刷新前台页面（Ctrl+F5 强制刷新）
3. 清除浏览器缓存

### Q: 如何重置所有配置？

**A**: 
1. 访问后台管理
2. 点击"重置为默认配置"
3. 或手动执行：
```bash
wrangler d1 execute profile-page-db --remote --file=d1-schema.sql
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- **AI 模型**: Qwen Code (通义千问) - 生成全部代码
- **图标**: [Font Awesome](https://fontawesome.com/)
- **平台**: [Cloudflare](https://www.cloudflare.com/)

---

**🎉 享受构建你的美丽个人页！**
