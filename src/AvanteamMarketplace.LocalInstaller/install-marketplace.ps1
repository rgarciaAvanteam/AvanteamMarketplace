#
# Script d'installation du client Marketplace Avanteam
# Ce script configure les parametres de connexion au Marketplace central
#

param(
    [Parameter(Mandatory=$false)]
    [string]$ProcessStudioRoot = "C:\ProcessStudio",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "https://marketplace-dev.avanteam-online.com/api/marketplace"
)

# Configuration
$ErrorActionPreference = "Stop"

# Message d'accueil
Write-Host ""
Write-Host "Installation du client Marketplace Avanteam" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Determiner le chemin racine
if (-not (Test-Path $ProcessStudioRoot)) {
    # Si le chemin par defaut n'existe pas, demander confirmation
    Write-Host "Le chemin specifie n'existe pas: $ProcessStudioRoot" -ForegroundColor Yellow
    $newPath = Read-Host "Veuillez saisir le chemin complet vers votre installation de Process Studio"
    
    if ([string]::IsNullOrEmpty($newPath) -or -not (Test-Path $newPath)) {
        Write-Host "Chemin invalide. Installation annulee." -ForegroundColor Red
        exit 1
    }
    
    $ProcessStudioRoot = $newPath
}

# Identifier les chemins importants
$appPath = Join-Path $ProcessStudioRoot "app"
$customPath = Join-Path $appPath "Custom\MarketPlace" 
$webConfigPath = Join-Path $customPath "Web.config"

# Verifier l'existence du dossier Custom/MarketPlace
if (-not (Test-Path $customPath)) {
    Write-Host "Le dossier Custom\MarketPlace n'existe pas. Creation du dossier..." -ForegroundColor Yellow
    New-Item -Path $customPath -ItemType Directory -Force | Out-Null
}

# Verifier l'existence du Web.config dans Custom/MarketPlace
if (-not (Test-Path $webConfigPath)) {
    Write-Host "Le fichier Web.config n'existe pas dans Custom\MarketPlace. Creation d'un fichier de base..." -ForegroundColor Yellow
    
    # Creer un Web.config de base
    @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <appSettings>
    <add key="MarketplaceApiUrl" value="$ApiUrl" />
    <add key="MarketplaceApiKey" value="" />
  </appSettings>
</configuration>
"@ | Out-File -FilePath $webConfigPath -Encoding utf8
}

# Afficher les instructions pour configurer la cle API
Write-Host ""
Write-Host "Configuration de la cle API:" -ForegroundColor Green
Write-Host "Pour configurer la cle API apres l'avoir obtenue de l'administrateur Avanteam:" -ForegroundColor White
Write-Host ""
Write-Host "1. Ouvrez le fichier Web.config dans Custom\MarketPlace:" -ForegroundColor White
Write-Host "   $webConfigPath" -ForegroundColor Cyan
Write-Host "2. Trouvez la ligne: <add key=""MarketplaceApiKey"" value="""" />" -ForegroundColor White
Write-Host "3. Remplacez la valeur vide par la cle API fournie par Avanteam" -ForegroundColor White
Write-Host "4. Sauvegardez le fichier" -ForegroundColor White
Write-Host ""
Write-Host "La cle API est necessaire pour que votre instance puisse s'authentifier aupres" -ForegroundColor White
Write-Host "du Marketplace central et telecharger/installer des composants." -ForegroundColor White
Write-Host ""

# Proposer de generer une cle API
$generateKey = Read-Host "Voulez-vous generer une nouvelle cle API maintenant? (o/n)"
if ($generateKey -eq "o" -or $generateKey -eq "O") {
    # Generer une cle API
    function Generate-ApiKey {
        $random = New-Object byte[] 36
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($random)
        $apiKey = [Convert]::ToBase64String($random).Replace('+', '-').Replace('/', '_').Replace('=', '')
        return $apiKey
    }
    
    # Generer et sauvegarder la cle
    $apiKey = Generate-ApiKey
    
    # Lire le Web.config
    [xml]$webConfig = Get-Content $webConfigPath
    
    # Mettre a jour la cle API
    $apiKeyNode = $webConfig.configuration.appSettings.add | Where-Object { $_.key -eq "MarketplaceApiKey" }
    if ($apiKeyNode -ne $null) {
        $apiKeyNode.value = $apiKey
    } else {
        $newNode = $webConfig.CreateElement("add")
        $newNode.SetAttribute("key", "MarketplaceApiKey")
        $newNode.SetAttribute("value", $apiKey)
        $webConfig.configuration.appSettings.AppendChild($newNode) | Out-Null
    }
    
    # Sauvegarder le Web.config
    $webConfig.Save($webConfigPath)
    
    Write-Host ""
    Write-Host "Cle API generee: $($apiKey.Substring(0, 10))..." -ForegroundColor Green
    Write-Host "La cle complete a ete sauvegardee dans le fichier Web.config." -ForegroundColor Green
    Write-Host "IMPORTANT: Veuillez transmettre cette cle a l'administrateur Avanteam." -ForegroundColor Yellow
    
    # Exporter la cle dans un fichier
    $keyFile = Join-Path $customPath "apikey.txt"
    $apiKey | Out-File -FilePath $keyFile -Encoding utf8
    Write-Host "La cle a egalement ete exportee dans le fichier: $keyFile" -ForegroundColor Cyan
}

# Verifier si le module est correctement installe
Write-Host ""
Write-Host "Verification de l'installation du client Marketplace..." -ForegroundColor Cyan

$installSuccess = $true
$missingItems = @()

# Verifier les fichiers essentiels
$requiredFiles = @(
    "Web.config"
)

foreach ($file in $requiredFiles) {
    $filePath = Join-Path $customPath $file
    if (-not (Test-Path $filePath)) {
        $installSuccess = $false
        $missingItems += $file
    }
}

if ($installSuccess) {
    Write-Host "Le client Marketplace est correctement installe!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez maintenant utiliser l'API Installer pour installer des composants depuis le Marketplace." -ForegroundColor White
    Write-Host "URL de l'API Installer: http://votre-serveur/app/api-installer" -ForegroundColor Cyan
} else {
    Write-Host "L'installation du client Marketplace est incomplete." -ForegroundColor Red
    Write-Host "Elements manquants:" -ForegroundColor Red
    foreach ($item in $missingItems) {
        Write-Host "  - $item" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Installation terminee." -ForegroundColor Cyan