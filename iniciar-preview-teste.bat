@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Depot SJP - Preview local (BANCO DE TESTE)
echo ============================================
echo.
echo Este preview usa um banco de dados SEPARADO, so pra teste. Fique a
echo vontade pra importar planilhas, criar, editar e excluir - nada disso
echo afeta a producao. Os dados aqui sao uma copia da producao tirada em
echo 11/08/2026 (pode pedir pra eu atualizar essa copia quando quiser).
echo.
echo Login: dalan.lopes@valedotibagi.com.br
echo Senha: Teste2026!
echo.

if not exist ".env.teste.local" (
  echo [ATENCAO] Nao encontrei o arquivo .env.teste.local nesta pasta.
  echo Me chama no chat que eu recrio.
  echo.
  pause
  exit /b
)

copy /y ".env.teste.local" ".env.local" >nul

if not exist "node_modules" (
  echo Primeira vez rodando - instalando as dependencias, so vai levar um minuto...
  call npm install
)

echo.
echo Iniciando o preview local (teste)...
echo Vai abrir sozinho no navegador em alguns segundos.
echo Para PARAR o preview, so fechar esta janela.
echo.

start "" cmd /c "timeout /t 4 >nul && start http://localhost:3000"
call npm run dev

pause
