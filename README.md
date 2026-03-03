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
- 🔐 支持 Cloudflare Access 鉴权（生产环境）
- 🎯 可视化后台管理，无需编写代码
- 📱 支持多个头像随机显示
- 🖼️ 支持横屏/竖屏背景图片分别设置

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
npm run dev
```

访问：
- **前台主页**: http://localhost:8787/
- **后台管理**: http://localhost:8787/admin.html

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
│   └── admin-styles.css    # 后台样式
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

**结论**: 完全免费，适合个人使用。

---

## 🔒 安全说明

### 开发环境
- 默认跳过鉴权
- 方便本地调试

### 生产环境
- 使用 Cloudflare Access 保护后台
- 配置允许访问的邮箱域名
- 自动跳转到 Access 登录页

### 配置步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Zero Trust** → **Access** → **Applications**
3. 创建新应用，选择 **Self-hosted**
4. 配置允许的邮箱域名或服务 ID
5. 在 Worker 中绑定 Access 策略

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
