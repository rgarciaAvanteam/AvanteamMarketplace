<#
.SYNOPSIS
    Script de rafraîchissement du déploiement IIS pour résoudre les problèmes de cache
    
.DESCRIPTION
    Ce script met à jour le déploiement de l'API Avanteam Marketplace sur IIS,
    en s'assurant que le cache du navigateur et le cache IIS sont vidés correctement.
    
.PARAMETER SiteName
    Nom du site web IIS (défaut: marketplace-dev.avanteam-online.com)
    
.PARAMETER PhysicalPath
    Chemin physique d'installation (défaut: C:\inetpub\wwwroot\marketplace-dev)
    
.PARAMETER ClearAssets
    Si défini, supprime complètement les dossiers css, js et images avant de copier les nouveaux fichiers
    
.EXAMPLE
    .\refresh-deployment.ps1
    
.EXAMPLE
    .\refresh-deployment.ps1 -ClearAssets -SiteName "marketplace-test.avanteam-online.com"
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$SiteName = "marketplace-dev.avanteam-online.com",
    
    [Parameter(Mandatory=$false)]
    [string]$PhysicalPath = "C:\inetpub\wwwroot\marketplace-dev",
    
    [Parameter(Mandatory=$false)]
    [switch]$ClearAssets = $false
)

# Vérifier que le script est exécuté en tant qu'administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Ce script doit être exécuté en tant qu'administrateur."
    exit 1
}

# Vérifier que le module WebAdministration est disponible
if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Write-Error "Le module WebAdministration n'est pas disponible. Assurez-vous que IIS est installé avec les outils de gestion."
    exit 1
}

# Chemin source (dossier actuel)
$sourcePath = $PSScriptRoot
Write-Host "Rafraîchissement du déploiement depuis: $sourcePath" -ForegroundColor Cyan

# Étape 1: Arrêter le site web et le pool d'applications
Write-Host "`n[1/6] Arrêt du site web et du pool d'applications..." -ForegroundColor Green

Import-Module WebAdministration
$appPoolName = "$SiteName" + "Pool"

# Arrêter le site web
if (Test-Path "IIS:\Sites\$SiteName") {
    Write-Host "Arrêt du site web $SiteName..."
    Stop-Website -Name $SiteName
} else {
    Write-Warning "Le site web $SiteName n'existe pas."
    exit 1
}

# Arrêter le pool d'applications
if (Test-Path "IIS:\AppPools\$appPoolName") {
    Write-Host "Arrêt du pool d'applications $appPoolName..."
    Stop-WebAppPool -Name $appPoolName
} else {
    Write-Warning "Le pool d'applications $appPoolName n'existe pas."
    exit 1
}

# Étape 2: Publier l'API avec un paramètre anti-cache
Write-Host "`n[2/6] Publication de l'API avec paramètre anti-cache..." -ForegroundColor Green

# Générer un identifiant unique pour le cache-busting
$cacheId = Get-Date -Format "yyyyMMddHHmmss"

# Vérifier si dotnet est disponible
$dotnetAvailable = $null -ne (Get-Command dotnet -ErrorAction SilentlyContinue)
if (-not $dotnetAvailable) {
    Write-Error "L'outil dotnet n'est pas disponible. Assurez-vous que .NET 7.0 SDK est installé."
    exit 1
}

# Publier le projet API
$publishPath = Join-Path $sourcePath "publish-refresh"
if (Test-Path $publishPath) {
    Remove-Item -Path $publishPath -Recurse -Force
}

Write-Host "Restauration des packages NuGet..."
dotnet restore "$sourcePath\AvanteamMarketplace.sln"

# Publication en mode Release
Write-Host "Publication du projet API en mode Release..."
dotnet publish "$sourcePath\src\AvanteamMarketplace.API\AvanteamMarketplace.API.csproj" -c Release -o $publishPath

if (-not (Test-Path $publishPath)) {
    Write-Error "La publication a échoué. Vérifiez les erreurs ci-dessus."
    exit 1
}

# Étape 3: Nettoyer les fichiers statiques si demandé
Write-Host "`n[3/6] Préparation du déploiement..." -ForegroundColor Green

# Vérifier si le répertoire de déploiement existe
if (-not (Test-Path $PhysicalPath)) {
    Write-Error "Le répertoire de déploiement $PhysicalPath n'existe pas."
    exit 1
}

# Si ClearAssets est défini, supprimer les dossiers css, js et images
if ($ClearAssets) {
    Write-Host "Suppression des fichiers statiques existants..."
    $staticFolders = @("css", "js", "images")
    
    foreach ($folder in $staticFolders) {
        $folderPath = Join-Path $PhysicalPath "wwwroot\$folder"
        if (Test-Path $folderPath) {
            Write-Host "Suppression du dossier $folderPath"
            Remove-Item -Path $folderPath -Recurse -Force
        }
    }
}

# Étape 4: Mettre à jour les fichiers
Write-Host "`n[4/6] Mise à jour des fichiers..." -ForegroundColor Green

# Copier les fichiers publiés (sauf web.config pour préserver la configuration IIS)
Write-Host "Copie des fichiers vers $PhysicalPath..."
Get-ChildItem -Path $publishPath | Where-Object { $_.Name -ne "web.config" } | Copy-Item -Destination $PhysicalPath -Recurse -Force

# Copier le fichier web.config s'il n'existe pas déjà dans le répertoire de déploiement
$webConfigPath = Join-Path $PhysicalPath "web.config"
if (-not (Test-Path $webConfigPath)) {
    Copy-Item -Path (Join-Path $publishPath "web.config") -Destination $PhysicalPath -Force
    Write-Host "Création du fichier web.config puisqu'il n'existait pas."
} else {
    Write-Host "Le fichier web.config existe déjà, conservation de la configuration existante."
}

# Mettre à jour les fichiers critiques avec des modifications anti-cache
$assetFiles = @(
    "wwwroot\js\admin.js",
    "wwwroot\js\marketplace.js",
    "wwwroot\css\admin.css",
    "wwwroot\css\marketplace.css"
)

foreach ($file in $assetFiles) {
    $filePath = Join-Path $PhysicalPath $file
    if (Test-Path $filePath) {
        # Ajouter un commentaire avec un timestamp pour forcer le cache-busting
        $content = Get-Content -Path $filePath -Raw
        $content = "/* Cache-busting: $cacheId */`n$content"
        Set-Content -Path $filePath -Value $content -Force
        Write-Host "Mise à jour anti-cache pour $file"
    } else {
        Write-Warning "Le fichier $file n'existe pas dans le répertoire de déploiement."
    }
}

# Étape 5: Nettoyer le cache IIS
Write-Host "`n[5/6] Nettoyage du cache IIS..." -ForegroundColor Green

# Nettoyer le cache de sortie du site (output cache)
try {
    Write-Host "Nettoyage du cache de sortie IIS..."
    Clear-WebConfiguration -Filter "/system.webServer/caching/profiles/add" -PSPath "IIS:\Sites\$SiteName"
    
    # Supprimer les fichiers temporaires IIS
    $iisTemp = "C:\inetpub\temp\IIS Temporary Compressed Files"
    if (Test-Path $iisTemp) {
        Write-Host "Suppression des fichiers compressés temporaires IIS..."
        Remove-Item -Path "$iisTemp\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Warning "Impossible de nettoyer complètement le cache IIS: $_"
}

# Étape 6: Redémarrer le site web
Write-Host "`n[6/6] Redémarrage du site web..." -ForegroundColor Green

Start-WebAppPool -Name $appPoolName
Start-Website -Name $SiteName

# Vérifier que le site web est en cours d'exécution
$site = Get-Website -Name $SiteName
if ($site.State -eq "Started") {
    Write-Host "`nLe site web $SiteName a été redémarré avec succès." -ForegroundColor Green
    Write-Host "Les problèmes de cache devraient être résolus." -ForegroundColor Green
} else {
    Write-Warning "Le site web $SiteName n'a pas pu être démarré."
}

# Informations finales
$protocol = "https"
$port = 443
Write-Host "`nMise à jour terminée avec succès!" -ForegroundColor Green
Write-Host "L'API Avanteam Marketplace est maintenant disponible aux adresses suivantes:"
Write-Host "Interface d'administration: $protocol://$SiteName/admin" -ForegroundColor Cyan
Write-Host "Documentation Swagger: $protocol://$SiteName/swagger" -ForegroundColor Cyan

Write-Host "`nPour vérifier que les changements sont bien pris en compte:" -ForegroundColor Yellow
Write-Host "1. Videz le cache de votre navigateur (Ctrl+F5 ou Cmd+Shift+R)" -ForegroundColor Yellow
Write-Host "2. Vérifiez la date du commentaire anti-cache dans la source des fichiers JS/CSS" -ForegroundColor Yellow
Write-Host "3. Inspectez la réponse HTTP pour vérifier les en-têtes de cache" -ForegroundColor Yellow