/**
 * 将独立页面文件嵌入到 workers.js 中
 * 使用方法：node scripts/embed-files.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const WORKERS_FILE = path.join(ROOT_DIR, 'workers.js');

// 定义文件映射关系
const FILE_MAPPINGS = {
    'index.html': 'index.html',
    'styles.css': 'styles.css',
    'app.js': 'app.js',
    'admin.html': 'admin.html',
    'admin.css': 'admin.css',
    'admin.js': 'admin.js',
    'admin/auth.html': 'admin/auth.html',
    'admin/auth.css': 'admin/auth.css',
    'admin/auth.js': 'admin/auth.js'
};

// 读取文件内容并转换为模板字符串
function readFileAsTemplate(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // 转义：反斜杠、反引号、美元符号、换行
    return content
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\r\n/g, '\\n')
        .replace(/\n/g, '\\n');
}

// 查找 STATIC_FILES 中某个文件的起始和结束位置
function findFileBounds(content, filename) {
    const startMarker = `'${filename}': `;
    const startIndex = content.indexOf(startMarker);
    
    if (startIndex === -1) {
        return null;
    }
    
    // 内容开始位置（跳过 `'filename': ` 和开头的反引号）
    const contentStart = startIndex + startMarker.length + 1;
    
    // 查找结束反引号
    let endIndex = -1;
    for (let i = contentStart; i < content.length; i++) {
        if (content[i] === '`' && content[i - 1] !== '\\') {
            endIndex = i;
            break;
        }
    }
    
    if (endIndex === -1) {
        return null;
    }
    
    return {
        start: startIndex,
        end: endIndex,
        contentStart: contentStart
    };
}

// 主函数
function embedFiles() {
    console.log('开始嵌入文件到 workers.js...\n');
    
    // 读取 workers.js
    let workersContent = fs.readFileSync(WORKERS_FILE, 'utf-8');
    
    let updateCount = 0;
    let errorCount = 0;
    
    // 对每个文件执行替换
    for (const [key, filePath] of Object.entries(FILE_MAPPINGS)) {
        const fullPath = path.join(ROOT_DIR, filePath);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`✗ 文件不存在：${filePath}`);
            errorCount++;
            continue;
        }
        
        const newContent = readFileAsTemplate(fullPath);
        const bounds = findFileBounds(workersContent, key);
        
        if (bounds) {
            // 替换内容：保留 `'filename': ` 和开头的反引号，以及结束反引号
            const before = workersContent.substring(0, bounds.contentStart);
            const after = workersContent.substring(bounds.end);
            workersContent = before + newContent + after;
            console.log(`✓ 更新：${key}`);
            updateCount++;
        } else {
            console.log(`✗ 未找到条目：${key}`);
            errorCount++;
        }
    }
    
    // 写回文件
    fs.writeFileSync(WORKERS_FILE, workersContent, 'utf-8');
    
    console.log('\n✓ 文件嵌入完成！');
    console.log(`已更新：${WORKERS_FILE}`);
    console.log(`成功：${updateCount} 个文件`);
    console.log(`失败：${errorCount} 个文件`);
    
    if (errorCount === 0) {
        console.log('\n提示：请运行 node -c workers.js 检查语法');
    }
}

// 运行
embedFiles();
