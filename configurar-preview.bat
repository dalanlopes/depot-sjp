@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   Depot SJP - Este script nao e mais necessario
echo ================================================
echo.
echo A Vercel nao libera as variaveis "Sensitive" (DATABASE_URL,
echo SESSION_SECRET) nem pelo comando de terminal - so dentro do proprio
echo servidor da Vercel. Por isso trocamos de estrategia.
echo.
echo Agora e so criar o arquivo .env.local manualmente, seguindo o
echo passo a passo que eu (Claude) te mandei no chat, e depois clicar
echo direto no "iniciar-preview.bat".
echo.
pause
