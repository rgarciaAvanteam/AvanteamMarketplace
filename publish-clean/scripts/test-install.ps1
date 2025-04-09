param(
    [string]$packageUrl,
    [string]$componentId,
    [string]$version
)

# Vérifions que nous pouvons créer un log
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $scriptDir "Logs"
if (\!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$logFile = Join-Path $logDir "manual-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$testContent = "Test d'exécution manuelle du script d'installation
Package URL: $packageUrl
Component ID: $componentId
Version: $version
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"

Set-Content -Path $logFile -Value $testContent
Write-Host "Log créé à $logFile" -ForegroundColor Green

# Afficher un message sur la sortie standard
Write-Host "Script exécuté avec succès pour le composant $componentId v$version" -ForegroundColor Cyan

