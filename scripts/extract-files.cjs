/**
 * 从 workers.js 中提取内嵌文件到独立文件
 * 用于方便查看和编辑代码
 * 
 * 使用方法：node scripts/extract-files.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const WORKERS_FILE = path.join(ROOT_DIR, 'workers.js');

// 定义要提取的文件列表
const FILES_TO_EXTRACT = [
    'index.html',
    'styles.css',
    'admin.html',
    'admin.css',
    'admin.js',
    'admin/auth.html',
    'admin/auth.css',
    'admin/auth.js'
];

// 从模板字符串中还原内容
function unescapeContent(escaped) {
    return escaped
        .replace(/\\n/g, '\n')
        .replace(/\\\$/g, '$')
        .replace(/\\`/g, '`')
        .replace(/\\\\/g, '\\');
}

// 提取 STATIC_FILES 中的文件内容
function extractFile(workersContent, filename) {
    // 简单查找：'filename': `
    const startMarker = `'${filename}': `;
    const startIndex = workersContent.indexOf(startMarker);
    
    if (startIndex === -1) {
        return null;
    }
    
    // 查找内容开始位置（跳过 `'filename': ` 和开头的反引号）
    let contentStart = startIndex + startMarker.length + 1; // +1 跳过开头的反引号
    let content = '';
    let foundEnd = false;
    
    for (let i = contentStart; i < workersContent.length; i++) {
        const char = workersContent[i];
        const prevChar = workersContent[i - 1];
        
        // 检查是否遇到结束反引号（前面没有反斜杠转义）
        if (char === '`' && prevChar !== '\\') {
            foundEnd = true;
            break;
        } else {
            content += char;
        }
    }
    
    if (!foundEnd) {
        return null;
    }
    
    return unescapeContent(content);
}

// 确保目录存在
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`创建目录：${dir}`);
    }
}

// 主函数
function extractFiles() {
    console.log('开始从 workers.js 提取文件...\n');
    
    // 读取 workers.js
    if (!fs.existsSync(WORKERS_FILE)) {
        console.error(`错误：找不到 ${WORKERS_FILE}`);
        return;
    }
    
    const workersContent = fs.readFileSync(WORKERS_FILE, 'utf-8');
    
    let extractedCount = 0;
    let errorCount = 0;
    
    // 提取每个文件
    for (const filename of FILES_TO_EXTRACT) {
        const content = extractFile(workersContent, filename);
        
        if (content) {
            const outputPath = path.join(ROOT_DIR, filename);
            ensureDir(outputPath);
            
            try {
                fs.writeFileSync(outputPath, content, 'utf-8');
                console.log(`✓ 提取：${filename}`);
                extractedCount++;
            } catch (err) {
                console.error(`✗ 写入失败：${filename} - ${err.message}`);
                errorCount++;
            }
        } else {
            console.log(`✗ 未找到：${filename}`);
            errorCount++;
        }
    }
    
    console.log(`\n提取完成！`);
    console.log(`成功：${extractedCount} 个文件`);
    console.log(`失败：${errorCount} 个文件`);
    console.log(`\n提示：提取的文件仅用于查看和编辑，修改后请手动更新到 workers.js`);
}

// 运行
extractFiles();
