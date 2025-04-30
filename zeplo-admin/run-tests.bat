@echo off
echo ===================================================
echo           ZEPLO TESTES DE INTEGRACAO
echo ===================================================
echo.

set /p test_type="Selecione o tipo de teste (1-frontend, 2-backend, 3-ui, 4-all): "

if "%test_type%"=="1" (
    echo Executando testes de frontend...
    npm run test:frontend
) else if "%test_type%"=="2" (
    echo Executando testes de backend...
    npm run test:backend
) else if "%test_type%"=="3" (
    echo Executando testes de UI...
    npm run test:ui
) else if "%test_type%"=="4" (
    echo Executando todos os testes...
    npm run test:all
) else (
    echo Opção inválida!
    exit /b 1
)

echo.
echo Testes concluídos!
pause 