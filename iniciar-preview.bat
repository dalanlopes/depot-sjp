@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Depot SJP - Preview local (PRODUCAO)
echo ============================================
echo.
echo ATENCAO: este preview usa o banco de dados REAL. Qualquer coisa que
echo voce importar, criar ou excluir aqui reflete em producao tambem.
echo Para testar sem risco, use o "iniciar-preview-teste.bat".
echo.

if not exist ".env.producao.local" (
  echo [ATENCAO] Nao encontrei o arquivo .env.producao.local nesta pasta.
  echo Me chama no chat que eu recrio.
  echo.
  pause
  exit /b
)

copy /y ".env.producao.local" ".env.local" >nul

if not exist "node_modules" (
  echo Primeira vez rodando - instalando as dependencias, so vai levar um minuto...
  call npm install
)

echo.
echo Iniciando o preview local (producao)...
echo Vai abrir sozinho no navegador em alguns segundos.
echo Para PARAR o preview, so fechar esta janela.
echo.

start "" cmd /c "timeout /t 4 >nul && start http://localhost:3000"
call npm run dev

pause
