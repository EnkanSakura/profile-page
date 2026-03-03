@echo off
chcp 65001 >nul
echo ============================================
echo Cloudflare Workers AUTH_KEY 设置脚本
echo ============================================
echo.
echo 此脚本将帮助你在 Cloudflare Workers 中设置 AUTH_KEY 密钥
echo.
echo 请按照以下步骤操作：
echo.
echo 1. 首先设置生产环境 AUTH_KEY：
echo    npx wrangler secret put AUTH_KEY --env production
echo.
echo 2. （可选）设置开发环境 AUTH_KEY：
echo    npx wrangler secret put AUTH_KEY --env dev
echo.
echo ============================================
echo.
set /p "run=是否现在设置生产环境 AUTH_KEY? (Y/N): "
if /i "%run%"=="Y" (
    echo.
    echo 正在启动设置...
    echo 提示：输入密钥时不会显示字符，输入完成后按回车
    echo.
    npx wrangler secret put AUTH_KEY --env production
    echo.
    echo 设置完成！
) else (
    echo 已跳过
)

echo.
echo 提示：
echo - 密钥长度建议至少 12 位
echo - 包含大小写字母、数字和特殊符号
echo - 不要使用容易猜测的密码
echo.
pause
