<#
.SYNOPSIS
    Script d'installation de l'API locale pour le Marketplace Avanteam
    
.DESCRIPTION
    Ce script installe l'API locale pour l'installation de composants du Marketplace Avanteam
    Il configure les fichiers nécessaires dans le dossier de Process Studio
    
.PARAMETER ProcessStudioRoot
    Répertoire racine de Process Studio. Si non spécifié, le script utilisera le répertoire courant.
    
.PARAMETER LocalInstallerBinPath
    Chemin vers le répertoire contenant les fichiers compilés de l'API locale
    
.EXAMPLE
    .\setup-local-installer.ps1 -ProcessStudioRoot "C:\inetpub\wwwroot\ProcessStudio"
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$ProcessStudioRoot = "",
    
    [Parameter(Mandatory=$false)]
    [string]$LocalInstallerBinPath = ""
)

# Si le répertoire racine n'est pas spécifié, utiliser le répertoire courant
if ([string]::IsNullOrEmpty($ProcessStudioRoot)) {
    $ProcessStudioRoot = (Get-Location).Path
    Write-Host "Répertoire racine non spécifié, utilisation du répertoire courant: $ProcessStudioRoot" -ForegroundColor Yellow
}

# Si le chemin du bin n'est pas spécifié, utiliser le répertoire par défaut
if ([string]::IsNullOrEmpty($LocalInstallerBinPath)) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $LocalInstallerBinPath = Join-Path $scriptDir "bin\Release\net6.0\publish"
    Write-Host "Chemin du bin non spécifié, utilisation du chemin par défaut: $LocalInstallerBinPath" -ForegroundColor Yellow
}

# Vérifier que le répertoire racine existe
if (!(Test-Path $ProcessStudioRoot)) {
    Write-Host "Erreur: Le répertoire racine de Process Studio n'existe pas: $ProcessStudioRoot" -ForegroundColor Red
    exit 1
}

# Vérifier que le répertoire bin existe
if (!(Test-Path $LocalInstallerBinPath)) {
    Write-Host "Erreur: Le répertoire bin de l'API locale n'existe pas: $LocalInstallerBinPath" -ForegroundColor Red
    Write-Host "Veuillez compiler l'API locale avec: dotnet publish -c Release" -ForegroundColor Red
    exit 1
}

# Créer les répertoires nécessaires
$apiDir = Join-Path $ProcessStudioRoot "Custom\MarketPlace\api"
$scriptsDir = Join-Path $ProcessStudioRoot "Custom\MarketPlace\scripts"
$logsDir = Join-Path $ProcessStudioRoot "Custom\MarketPlace\logs"

function EnsureDirectoryExists($path) {
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "Répertoire créé: $path" -ForegroundColor Green
    } else {
        Write-Host "Répertoire existant: $path" -ForegroundColor Cyan
    }
}

# Créer les répertoires
EnsureDirectoryExists $apiDir
EnsureDirectoryExists $scriptsDir
EnsureDirectoryExists $logsDir

# Copier les fichiers de l'API locale
Write-Host "Copie des fichiers de l'API locale..." -ForegroundColor Cyan
Copy-Item -Path "$LocalInstallerBinPath\*" -Destination $apiDir -Recurse -Force

# Copier le script d'installation des composants
$installScriptSource = Join-Path $PSScriptRoot "..\AvanteamMarketplace.API\scripts\install-component.ps1"
if (Test-Path $installScriptSource) {
    Write-Host "Copie du script d'installation des composants..." -ForegroundColor Cyan
    Copy-Item -Path $installScriptSource -Destination $scriptsDir -Force
} else {
    Write-Host "Avertissement: Script d'installation non trouvé: $installScriptSource" -ForegroundColor Yellow
    Write-Host "Vous devrez copier manuellement le script install-component.ps1 dans le répertoire $scriptsDir" -ForegroundColor Yellow
}

# Créer un fichier readme
$readmePath = Join-Path $ProcessStudioRoot "Custom\MarketPlace\README.md"
$readmeContent = @"
# API Locale pour l'installation de composants Marketplace

Cette API locale permet l'installation automatisée des composants du Marketplace Avanteam.

## Structure

- `/Custom/MarketPlace/api/` - API locale d'installation
- `/Custom/MarketPlace/scripts/` - Scripts PowerShell pour l'installation
- `/Custom/MarketPlace/logs/` - Logs d'installation

## Utilisation

L'API est utilisée par l'interface web du Marketplace et ne nécessite pas d'interaction directe.

Pour tester si l'API est correctement installée, accédez à:
http://votreserveur/Custom/MarketPlace/api/status

## Support

Pour toute assistance, contactez Avanteam:
- Email: support@avanteam.fr
- Site web: https://avanteam.fr
"@

Set-Content -Path $readmePath -Value $readmeContent
Write-Host "Fichier README créé: $readmePath" -ForegroundColor Green

Write-Host ""
Write-Host "Installation terminée avec succès!" -ForegroundColor Green
Write-Host "L'API locale est maintenant disponible à l'adresse: http://votreserveur/Custom/MarketPlace/api/status" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Assurez-vous que le module ASP.NET Core est installé sur IIS" -ForegroundColor Yellow
Write-Host "IMPORTANT: Assurez-vous que le compte d'application IIS a les permissions pour exécuter PowerShell" -ForegroundColor Yellow