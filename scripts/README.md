# 文件同步脚本使用说明

## 概述

这两个脚本用于在独立文件和 workers.js 内嵌文件之间同步页面代码。

## 使用方法

### 1. 提取文件（workers.js → 独立文件）

```bash
npm run extract
# 或
node scripts/extract-files.cjs
```

**功能**：
- 从 `workers.js` 的 `STATIC_FILES` 对象中提取内嵌文件
- 创建独立的 HTML、CSS、JS 文件
- 方便查看和编辑代码

**提取的文件**：
- `index.html` - 主页
- `admin.html` - 后台管理页
- `admin/auth.html` - 认证页面
- `admin/auth.css` - 认证页面样式
- `admin/auth.js` - 认证页面脚本

### 2. 嵌入文件（独立文件 → workers.js）

```bash
npm run embed
# 或
node scripts/embed-files.cjs
```

**功能**：
- 读取独立的页面文件
- 更新 `workers.js` 中的 `STATIC_FILES` 对象
- 准备部署

**注意**：
- 嵌入后需要检查语法：`node -c workers.js`
- 建议嵌入前先测试语法

## 工作流程

### 开发时
1. 使用 `npm run extract` 提取文件
2. 编辑独立文件
3. 使用 `npm run embed` 嵌入到 workers.js
4. 检查语法：`node -c workers.js`
5. 测试和部署

### 部署前
1. 确保所有修改都已嵌入到 workers.js
2. 检查 workers.js 语法：`node -c workers.js`
3. 部署：`npm run deploy`

## 注意事项

1. **不要同时修改两边的文件**
   - 只编辑独立文件，然后嵌入
   - 或只编辑 workers.js，然后提取

2. **部署使用 workers.js**
   - Cloudflare Workers 只使用 workers.js
   - 独立文件仅用于开发便利

3. **版本控制**
   - 建议将独立文件加入版本控制
   - workers.js 也会包含内嵌文件

## 添加新文件

如需添加新的页面文件，在两个脚本中的文件列表里添加：

```javascript
// extract-files.cjs
const FILES_TO_EXTRACT = [
    'index.html',
    'your-file.html',  // 添加这里
    // ...
];

// embed-files.cjs
const FILE_MAPPINGS = {
    'index.html': 'index.html',
    'your-file.html': 'your-file.html',  // 添加这里
    // ...
};
```
