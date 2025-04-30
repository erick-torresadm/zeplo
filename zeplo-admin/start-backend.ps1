# Script para iniciar o backend e executar testes
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " INICIAR BACKEND E EXECUTAR TESTES - ZEPLO" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o backend já está rodando na porta 8080
try {
    $testConnection = Invoke-WebRequest -Uri "http://localhost:8080" -Method Head -TimeoutSec 1 -ErrorAction SilentlyContinue
    Write-Host "Backend já está rodando na porta 8080!" -ForegroundColor Green
    $backendRunning = $true
} catch {
    if ($_.Exception.Response -ne $null) {
        Write-Host "Backend já está rodando na porta 8080!" -ForegroundColor Green
        $backendRunning = $true
    } else {
        Write-Host "Backend não está rodando. Tentando iniciar..." -ForegroundColor Yellow
        $backendRunning = $false
    }
}

if (-not $backendRunning) {
    # Obter o caminho do diretório backend
    $backendPath = (Resolve-Path -Path "$PSScriptRoot\..\backend").Path
    
    # Verificar se o diretório backend existe
    if (-not (Test-Path $backendPath)) {
        Write-Host "Erro: Diretório backend não encontrado em $backendPath" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Iniciando backend em $backendPath..." -ForegroundColor Yellow
    
    # Iniciar o backend em uma nova janela do PowerShell
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev"
    
    # Aguardar o backend iniciar
    Write-Host "Aguardando o backend iniciar..."
    
    $maxRetries = 15  # 15 tentativas com 2 segundos de intervalo = 30 segundos
    $retryCount = 0
    $backendStarted = $false
    
    while (-not $backendStarted -and $retryCount -lt $maxRetries) {
        Start-Sleep -Seconds 2
        $retryCount++
        Write-Host "Verificando se o backend está disponível (tentativa $retryCount de $maxRetries)..." -NoNewline
        
        try {
            $testConnection = Invoke-WebRequest -Uri "http://localhost:8080" -Method Head -TimeoutSec 1 -ErrorAction SilentlyContinue
            Write-Host " OK!" -ForegroundColor Green
            $backendStarted = $true
        } catch {
            if ($_.Exception.Response -ne $null) {
                Write-Host " OK (com resposta HTTP)!" -ForegroundColor Green
                $backendStarted = $true
            } else {
                Write-Host " Ainda não está disponível." -ForegroundColor Yellow
            }
        }
    }
    
    if (-not $backendStarted) {
        Write-Host ""
        Write-Host "Aviso: Não foi possível confirmar se o backend iniciou." -ForegroundColor Yellow
        Write-Host "Continuando mesmo assim, mas os testes podem falhar se o backend não estiver rodando." -ForegroundColor Yellow
    } else {
        Write-Host "Backend iniciado com sucesso!" -ForegroundColor Green
    }
}

# Configurar o arquivo .env.local
Write-Host ""
Write-Host "Configurando arquivo .env.local..." -ForegroundColor Yellow
"NEXT_PUBLIC_API_URL=http://localhost:8080/api" | Out-File -FilePath ".env.local" -Encoding UTF8
Write-Host "Arquivo .env.local atualizado com sucesso." -ForegroundColor Green

# Perguntar se quer executar os testes
Write-Host ""
$executarTestes = Read-Host "Deseja executar os testes de funcionalidade? (S/N)"

if ($executarTestes -eq "S" -or $executarTestes -eq "s") {
    Write-Host ""
    Write-Host "Executando testes de funcionalidade..." -ForegroundColor Yellow
    npm run test:backend
}

Write-Host ""
Write-Host "Configuração concluída." -ForegroundColor Green
Write-Host "Para iniciar o frontend, execute:" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor Cyan
Write-Host "" 