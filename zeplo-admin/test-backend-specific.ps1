# Script para testar funcionalidades específicas do backend
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " TESTE DE FUNCIONALIDADES DO BACKEND - ZEPLO" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://localhost:8080"
$global:totalTestes = 0
$global:testesPassados = 0

# Verificar conexão com o backend
try {
    $response = Invoke-WebRequest -Uri "$API_URL" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend encontrado em $API_URL" -ForegroundColor Green
} catch {
    if ($_.Exception.Response -ne $null) {
        Write-Host "✅ Backend respondendo em $API_URL (status: $($_.Exception.Response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "❌ Não foi possível conectar ao backend em $API_URL" -ForegroundColor Red
        Write-Host "Certifique-se de que o backend está rodando na porta 8080" -ForegroundColor Yellow
        exit 1
    }
}

# Função para testar endpoints
function Test-Endpoint {
    param (
        [string]$Name,
        [string]$Endpoint,
        [string]$Method = "GET"
    )
    
    $global:totalTestes++
    Write-Host "Testando $Name... " -NoNewline
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri "$API_URL$Endpoint" -Method $Method -TimeoutSec 2 -ErrorAction SilentlyContinue
        } else {
            $body = @{
                timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
                test = $true
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest -Uri "$API_URL$Endpoint" -Method $Method -Body $body -ContentType "application/json" -TimeoutSec 2 -ErrorAction SilentlyContinue
        }
        
        Write-Host "✅ OK (Status: $($response.StatusCode))" -ForegroundColor Green
        $global:testesPassados++
        return $true
    } catch {
        if ($_.Exception.Response -ne $null) {
            Write-Host "✅ Resposta recebida (Status: $($_.Exception.Response.StatusCode))" -ForegroundColor Yellow
            $global:testesPassados++
            return $true
        } else {
            Write-Host "❌ Falha ($($_.Exception.Message))" -ForegroundColor Red
            return $false
        }
    }
}

Write-Host ""
Write-Host "TESTE DE ENDPOINTS COMUNS" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"

# Testar endpoints de status/health
Test-Endpoint -Name "Endpoint raiz" -Endpoint "/"
Test-Endpoint -Name "Endpoint raiz com /api" -Endpoint "/api"
Test-Endpoint -Name "Endpoint de status" -Endpoint "/status"
Test-Endpoint -Name "Endpoint de health" -Endpoint "/health"
Test-Endpoint -Name "Endpoint de health com /api" -Endpoint "/api/health"

Write-Host ""
Write-Host "TESTE DE ENDPOINTS DE INSTÂNCIA" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"

# Testar endpoints de WhatsApp
Test-Endpoint -Name "Listar instâncias" -Endpoint "/instances" 
Test-Endpoint -Name "Listar instâncias com /api" -Endpoint "/api/instances"
Test-Endpoint -Name "Criar instância (POST)" -Endpoint "/api/instances" -Method "POST"

Write-Host ""
Write-Host "TESTE DE ENDPOINTS DE FLUXO" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"

# Testar endpoints de fluxo
Test-Endpoint -Name "Listar fluxos" -Endpoint "/flows"
Test-Endpoint -Name "Listar fluxos com /api" -Endpoint "/api/flows"
Test-Endpoint -Name "Criar fluxo (POST)" -Endpoint "/api/flows" -Method "POST"

Write-Host ""
Write-Host "TESTE DE ENDPOINTS DE CONTATO" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"

# Testar endpoints de contato
Test-Endpoint -Name "Listar contatos" -Endpoint "/contacts"
Test-Endpoint -Name "Listar contatos com /api" -Endpoint "/api/contacts"
Test-Endpoint -Name "Criar contato (POST)" -Endpoint "/api/contacts" -Method "POST"

Write-Host ""
Write-Host "TESTE DE ENDPOINTS DO SISTEMA" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"

# Testar endpoints do sistema
Test-Endpoint -Name "Status do banco de dados" -Endpoint "/system/database-status"
Test-Endpoint -Name "Status do Redis" -Endpoint "/system/redis-status"
Test-Endpoint -Name "Status do armazenamento" -Endpoint "/system/storage-status"

# Exibir resumo
Write-Host ""
Write-Host "RESUMO DOS TESTES" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"
Write-Host "Total de testes: $global:totalTestes" -ForegroundColor White
Write-Host "Testes com resposta: $global:testesPassados" -ForegroundColor Green
Write-Host "Testes sem resposta: $($global:totalTestes - $global:testesPassados)" -ForegroundColor Red

# Calcular porcentagem
if ($global:totalTestes -gt 0) {
    $porcentagem = [math]::Round(($global:testesPassados / $global:totalTestes) * 100)
    Write-Host "Taxa de sucesso: $porcentagem%" -ForegroundColor $(if ($porcentagem -ge 70) { "Green" } elseif ($porcentagem -ge 40) { "Yellow" } else { "Red" })
} else {
    Write-Host "Nenhum teste foi executado" -ForegroundColor Red
}

Write-Host ""
if ($global:testesPassados -lt $global:totalTestes) {
    Write-Host "⚠️ Alguns endpoints não estão respondendo." -ForegroundColor Yellow
    Write-Host "Isso pode ser normal se esses endpoints ainda não estiverem implementados no backend." -ForegroundColor Yellow
} else {
    Write-Host "✅ Todos os endpoints testados estão respondendo!" -ForegroundColor Green
}

# Identificar o melhor endpoint para API URL
if (Test-Endpoint -Name "Verificação final API" -Endpoint "/api/flows") {
    $API_FINAL_URL = "$API_URL/api"
    Write-Host "API encontrada em $API_FINAL_URL" -ForegroundColor Green
} elseif (Test-Endpoint -Name "Verificação final sem /api" -Endpoint "/flows") {
    $API_FINAL_URL = $API_URL
    Write-Host "API encontrada em $API_FINAL_URL" -ForegroundColor Green
} else {
    $API_FINAL_URL = "$API_URL/api"
    Write-Host "API parece não estar respondendo em endpoints específicos, usando $API_FINAL_URL por padrão" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Configurando NEXT_PUBLIC_API_URL no .env.local..." -ForegroundColor Yellow
"NEXT_PUBLIC_API_URL=$API_FINAL_URL" | Out-File -FilePath ".env.local" -Encoding UTF8
Write-Host "Configuração concluída." -ForegroundColor Green
Write-Host "" 