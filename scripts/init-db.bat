@echo off
chcp 65001 >nul
echo ============================================
echo D1 数据库初始化脚本
echo ============================================
echo.
echo 此脚本将初始化 Cloudflare D1 数据库
echo.
echo 数据库：profile-page-db
echo Database ID: 9cff7945-9742-4e5c-90ac-bb83286de74f
echo.
echo ============================================
echo.
echo 正在初始化远程数据库...
echo.
npx wrangler d1 execute profile-page-db --remote --file=d1-schema.sql
echo.
echo 初始化完成！
echo.
echo 提示：如果看到错误，请检查：
echo 1. 数据库是否已创建
echo 2. wrangler.toml 中的 database_id 是否正确
echo 3. 是否已登录 Cloudflare (npx wrangler login)
echo.
pause
