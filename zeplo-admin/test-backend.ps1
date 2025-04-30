# Script para testar conexao com o backend
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " TESTE DE CONEXAO COM O BACKEND - ZEPLO" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Definir portas para testar
$PortasComuns = @(8080, 3001, 3000, 4000, 5000, 8000)

Write-Host "Testando conexao com o backend..." -ForegroundColor Yellow
Write-Host ""

# Função para testar conexão em uma URL
function Test-Connection-Url {
    param (
        [string]$Url
    )
    
    try {
        Write-Host "Testando $Url..." -NoNewline
        $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        Write-Host " OK!" -ForegroundColor Green
        return $true
    } catch {
        if ($_.Exception.Response -ne $null) {
            # Se recebemos uma resposta, mesmo que seja um erro HTTP, o servidor está respondendo
            Write-Host " Resposta com status $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
            return $true
        } else {
            Write-Host " Falha" -ForegroundColor Red
            return $false
        }
    }
}

# Testar porta 8080 primeiro
$ApiUrl = $null

# Testar com prefixo /api
if (Test-Connection-Url -Url "http://localhost:8080/api") {
    $ApiUrl = "http://localhost:8080/api"
}

# Testar sem prefixo /api se falhou
if ($ApiUrl -eq $null -and (Test-Connection-Url -Url "http://localhost:8080")) {
    $ApiUrl = "http://localhost:8080"
}

# Testar endpoints específicos na porta 8080
if ($ApiUrl -eq $null) {
    Write-Host "Testando endpoints específicos na porta 8080..." -ForegroundColor Yellow
    
    if (Test-Connection-Url -Url "http://localhost:8080/health") {
        $ApiUrl = "http://localhost:8080"
    } elseif (Test-Connection-Url -Url "http://localhost:8080/api/health") {
        $ApiUrl = "http://localhost:8080/api"
    }
}

# Se não encontramos na porta 8080, testar outras portas
if ($ApiUrl -eq $null) {
    Write-Host "Backend não encontrado na porta 8080, testando outras portas..." -ForegroundColor Yellow
    
    foreach ($porta in $PortasComuns) {
        if ($porta -ne 8080) {
            if (Test-Connection-Url -Url "http://localhost:$porta") {
                $ApiUrl = "http://localhost:$porta"
                break
            }
            
            if (Test-Connection-Url -Url "http://localhost:$porta/api") {
                $ApiUrl = "http://localhost:$porta/api"
                break
            }
        }
    }
}

# Se ainda não encontramos, verificar se o backend está rodando
if ($ApiUrl -eq $null) {
    Write-Host ""
    Write-Host "Não foi possível detectar o backend em nenhuma porta comum." -ForegroundColor Yellow
    Write-Host "Verificando se o processo do backend está rodando..." -ForegroundColor Yellow
    
    $nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcess) {
        Write-Host "Processo Node.js está rodando. O backend pode estar em execução em uma porta não padrão." -ForegroundColor Yellow
    } else {
        Write-Host "Nenhum processo Node.js encontrado. O backend pode não estar em execução." -ForegroundColor Red
    }
    
    Write-Host ""
    $portaPersonalizada = Read-Host "Digite uma porta personalizada (Enter para sair)"
    
    if ($portaPersonalizada) {
        if (Test-Connection-Url -Url "http://localhost:$portaPersonalizada") {
            $ApiUrl = "http://localhost:$portaPersonalizada"
        } elseif (Test-Connection-Url -Url "http://localhost:$portaPersonalizada/api") {
            $ApiUrl = "http://localhost:$portaPersonalizada/api"
        } else {
            Write-Host "Não foi possível conectar na porta $portaPersonalizada." -ForegroundColor Red
        }
    }
}

# Verificar se encontramos o backend
if ($ApiUrl -eq $null) {
    Write-Host ""
    Write-Host "ERRO: Backend não encontrado ou não está respondendo." -ForegroundColor Red
    Write-Host "Sugestões:" -ForegroundColor Yellow
    Write-Host "1. Verifique se o backend está em execução" -ForegroundColor Yellow
    Write-Host "2. Execute 'cd ../backend' e depois 'npm run dev' em outro terminal" -ForegroundColor Yellow
    Write-Host "3. Verifique se não há firewalls bloqueando as conexões" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para iniciar manualmente, abra outro terminal e execute:" -ForegroundColor Yellow
    Write-Host "cd $($pwd)\..\backend" -ForegroundColor Cyan
    Write-Host "npm run dev" -ForegroundColor Cyan
    Write-Host ""
    exit 1
} else {
    Write-Host ""
    Write-Host "SUCESSO: Conexão com o backend estabelecida em $ApiUrl" -ForegroundColor Green
    Write-Host ""
    
    # Salvar em .env.local
    Write-Host "Salvando configuração em .env.local..." -ForegroundColor Yellow
    "NEXT_PUBLIC_API_URL=$ApiUrl" | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "Arquivo .env.local atualizado com sucesso." -ForegroundColor Green
    
    # Perguntar se quer executar os testes
    Write-Host ""
    $executarTestes = Read-Host "Deseja executar os testes de funcionalidade? (S/N)"
    
    if ($executarTestes -eq "S" -or $executarTestes -eq "s") {
        Write-Host ""
        Write-Host "Executando testes de funcionalidade..." -ForegroundColor Yellow
        npm run test:backend
    } else {
        Write-Host ""
        Write-Host "Configuração concluída. Para iniciar o frontend:" -ForegroundColor Green
        Write-Host "npm run dev" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "Processo concluído." -ForegroundColor Green
} 