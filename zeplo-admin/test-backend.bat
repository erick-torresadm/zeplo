@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

echo =================================================
echo  TESTE DE CONEXAO COM O BACKEND - ZEPLO
echo =================================================
echo.

:: Definir portas para testar
set "PORTAS_COMUNS=8080 3001 3000 4000 5000 8000"

echo Testando conexao com o backend...
echo.

:: Verificar se o backend está rodando em localhost:8080
echo Testando conexao em http://localhost:8080/api...
set "API_URL="

:: Tentar obter status da porta 8080 com /api
curl -s --head --connect-timeout 2 "http://localhost:8080/api" > temp-status.txt 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Backend encontrado em http://localhost:8080/api
    set "API_URL=http://localhost:8080/api"
    goto :ConnectionFound
)

:: Tentar obter status da porta 8080 sem /api
echo Testando conexao em http://localhost:8080...
curl -s --head --connect-timeout 2 "http://localhost:8080" > temp-status.txt 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Backend encontrado em http://localhost:8080
    set "API_URL=http://localhost:8080"
    goto :ConnectionFound
)

:: Se ainda não encontrou, testar endpoints específicos na porta 8080
echo Testando endpoints especificos na porta 8080...
curl -s -o nul --connect-timeout 2 "http://localhost:8080/health" 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Backend encontrado em http://localhost:8080
    set "API_URL=http://localhost:8080"
    goto :ConnectionFound
)

curl -s -o nul --connect-timeout 2 "http://localhost:8080/api/health" 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Backend encontrado em http://localhost:8080/api
    set "API_URL=http://localhost:8080/api"
    goto :ConnectionFound
)

echo [INFO] Backend nao encontrado na porta 8080, tentando outras portas...

:: Testar outras portas comuns
for %%p in (%PORTAS_COMUNS%) do (
    if not "%%p" == "8080" (
        echo Testando http://localhost:%%p...
        curl -s --head --connect-timeout 1 "http://localhost:%%p" > temp-status.txt 2>nul
        IF !ERRORLEVEL! EQU 0 (
            echo [SUCESSO] Backend encontrado em http://localhost:%%p
            set "API_URL=http://localhost:%%p"
            goto :ConnectionFound
        )
        
        echo Testando http://localhost:%%p/api...
        curl -s --head --connect-timeout 1 "http://localhost:%%p/api" > temp-status.txt 2>nul
        IF !ERRORLEVEL! EQU 0 (
            echo [SUCESSO] Backend encontrado em http://localhost:%%p/api
            set "API_URL=http://localhost:%%p/api"
            goto :ConnectionFound
        )
    )
)

:: Remover arquivo temporário
if exist temp-status.txt del temp-status.txt

:: Caso nenhuma porta funcionou
echo.
echo [AVISO] Nao foi possivel detectar o backend automaticamente.
echo Verificando se o processo do backend esta rodando...

:: Verificar se o processo está rodando
tasklist | findstr node.exe > nul
IF %ERRORLEVEL% EQU 0 (
    echo [INFO] Processo node.exe esta rodando.
    echo [INFO] O backend pode estar rodando, mas nao respondendo nas portas comuns.
) else (
    echo [ERRO] Nenhum processo node.exe encontrado. O backend pode nao estar em execucao.
)
echo.

:: Perguntar por uma porta personalizada
set /p PORTA_PERSONALIZADA="Digite uma porta personalizada (Enter para sair): "

:: Se o usuário digitou uma porta personalizada, testar
if defined PORTA_PERSONALIZADA (
    if not "%PORTA_PERSONALIZADA%"=="" (
        echo Testando http://localhost:%PORTA_PERSONALIZADA%...
        curl -s --head --connect-timeout 2 "http://localhost:%PORTA_PERSONALIZADA%" > nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            echo [SUCESSO] Backend encontrado em http://localhost:%PORTA_PERSONALIZADA%
            set "API_URL=http://localhost:%PORTA_PERSONALIZADA%"
            goto :ConnectionFound
        )

        echo Testando http://localhost:%PORTA_PERSONALIZADA%/api...
        curl -s --head --connect-timeout 2 "http://localhost:%PORTA_PERSONALIZADA%/api" > nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            echo [SUCESSO] Backend encontrado em http://localhost:%PORTA_PERSONALIZADA%/api
            set "API_URL=http://localhost:%PORTA_PERSONALIZADA%/api"
            goto :ConnectionFound
        )
        
        echo [ERRO] Nao foi possivel conectar ao backend na porta %PORTA_PERSONALIZADA%.
    )
)

echo.
echo [ERRO] Backend nao encontrado ou nao esta respondendo.
echo Sugestoes:
echo 1. Verifique se o backend esta em execucao
echo 2. Execute 'cd backend' e depois 'npm run dev' em outro terminal
echo 3. Verifique se nao ha firewalls bloqueando as conexoes
echo.
echo Para iniciar manualmente, abra outro terminal e execute:
echo cd %CD%\..\backend
echo npm run dev
echo.
exit /b 1

:ConnectionFound
echo.
echo [SUCESSO] Conexao com o backend estabelecida em %API_URL%
echo.

:: Salvar em .env.local
echo Salvando configuracao em .env.local...
echo NEXT_PUBLIC_API_URL=%API_URL%> .env.local
echo [SUCESSO] Arquivo .env.local atualizado.

:: Executar testes funcionais
echo.
echo Deseja executar os testes de funcionalidade? (S/N)
set /p EXECUTAR_TESTES="Sua escolha: "

if /i "%EXECUTAR_TESTES%" == "S" (
    echo.
    echo Executando testes funcionais...
    call npm run test:backend
) else (
    echo.
    echo Configuracao concluida. Para iniciar o frontend:
    echo npm run dev
)

echo.
echo Processo concluido.
exit /b 0 