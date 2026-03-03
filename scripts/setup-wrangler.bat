@echo off
chcp 65001 >nul
echo ============================================
echo Wrangler 本地配置脚本
echo ============================================
echo.
echo 此脚本将帮助你配置本地 wrangler.toml 文件
echo.
echo 数据库：profile-page-db
echo.
echo ============================================
echo.

REM 检查 wrangler.toml 是否存在
if exist "wrangler.toml" (
    echo wrangler.toml 已存在
    set /p "overwrite=是否重新配置？(Y/N): "
    if /i not "%overwrite%"=="Y" (
        echo 已跳过
        goto :end
    )
)

echo.
echo 请输入 D1 Database ID:
echo 提示：运行 "npx wrangler d1 list" 查看数据库列表
set /p "DATABASE_ID=Database ID: "

if "%DATABASE_ID%"=="" (
    echo 错误：Database ID 不能为空
    goto :end
)

echo.
echo 正在生成 wrangler.toml...

(
echo # Cloudflare Workers + Pages 混合部署配置
echo # 架构：Workers 提供 API + D1 存储 + Pages 托管静态文件
echo.
echo name = "profile-page"
echo main = "workers.js"
echo compatibility_date = "2024-09-19"
echo.
echo # D1 数据库绑定
echo [[d1_databases]]
echo binding = "PROFILE_DB"
echo database_name = "profile-page-db"
echo database_id = "%DATABASE_ID%"
echo.
echo # 环境变量
echo [vars]
echo ENVIRONMENT = "dev"
echo PROFILE_PAGE_TITLE = "EnkanSakura Profile"
echo.
echo # 开发环境配置
echo [env.dev]
echo name = "profile-page-dev"
echo [env.dev.vars]
echo ENVIRONMENT = "dev"
echo.
echo # 生产环境配置
echo [env.production]
echo name = "profile-page-prod"
echo [[env.production.d1_databases]]
echo binding = "PROFILE_DB"
echo database_name = "profile-page-db"
echo database_id = "%DATABASE_ID%"
echo [env.production.vars]
echo ENVIRONMENT = "production"
echo.
echo # 注意：AUTH_KEY 是敏感信息，使用 wrangler secret put 设置
) > wrangler.toml

echo.
echo wrangler.toml 配置完成！
echo.
echo 下一步：
echo 1. 设置 AUTH_KEY: npx wrangler secret put AUTH_KEY --env production
echo 2. 初始化数据库：npx wrangler d1 execute profile-page-db --remote --file=d1-schema.sql
echo 3. 本地开发：npm run dev
echo.

:end
pause
