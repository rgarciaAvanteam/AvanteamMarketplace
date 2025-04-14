<#
.SYNOPSIS
    Script de réinitialisation complète du déploiement IIS
    
.DESCRIPTION
    Ce script arrête complètement le site web, vide les caches, remplace tous les fichiers JS et CSS 
    par des versions avec noms modifiés pour forcer le rafraîchissement du navigateur.
#>

param (
    [Parameter(Mandatory=$false)]
    [string]$SiteName = "marketplace-dev.avanteam-online.com",
    
    [Parameter(Mandatory=$false)]
    [string]$PhysicalPath = "C:\inetpub\wwwroot\marketplace-dev"
)

# Vérifier l'exécution en tant qu'administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Ce script doit être exécuté en tant qu'administrateur."
    exit 1
}

# Arrêter complètement le site et le pool d'applications
Import-Module WebAdministration
$appPoolName = "$SiteName" + "Pool"

Write-Host "Arrêt du site web et du pool d'applications..." -ForegroundColor Yellow
Stop-Website -Name $SiteName -ErrorAction SilentlyContinue
Stop-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue

# Attendre que tout soit arrêté
Write-Host "Attente de l'arrêt complet..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Générer un identifiant unique pour le cache-busting
$timestamp = Get-Date -Format "yyyyMMddHHmmss"

# Répertoires à analyser
$jsDir = Join-Path $PhysicalPath "wwwroot\js"
$cssDir = Join-Path $PhysicalPath "wwwroot\css"

# Vérifier si les répertoires existent
if (-not (Test-Path $jsDir) -or -not (Test-Path $cssDir)) {
    Write-Error "Les répertoires JS ou CSS n'existent pas. Vérifiez le chemin de déploiement."
    exit 1
}

# 1. Renommer les fichiers JS avec un suffixe de version
Write-Host "Modification des fichiers JS..." -ForegroundColor Green
$jsFiles = Get-ChildItem -Path $jsDir -Filter "*.js"
foreach ($file in $jsFiles) {
    $newName = $file.BaseName + "." + $timestamp + ".js"
    $newPath = Join-Path $jsDir $newName
    
    # Copier le fichier avec le nouveau nom
    Copy-Item -Path $file.FullName -Destination $newPath -Force
    
    # Ajouter un commentaire pour s'assurer que le contenu est différent
    $content = Get-Content -Path $newPath -Raw
    $content = "/* Version forcée: $timestamp */`n$content"
    Set-Content -Path $newPath -Value $content -Force
    
    Write-Host "Créé: $newName"
}

# 2. Renommer les fichiers CSS avec un suffixe de version
Write-Host "Modification des fichiers CSS..." -ForegroundColor Green
$cssFiles = Get-ChildItem -Path $cssDir -Filter "*.css"
foreach ($file in $cssFiles) {
    $newName = $file.BaseName + "." + $timestamp + ".css"
    $newPath = Join-Path $cssDir $newName
    
    # Copier le fichier avec le nouveau nom
    Copy-Item -Path $file.FullName -Destination $newPath -Force
    
    # Ajouter un commentaire pour s'assurer que le contenu est différent
    $content = Get-Content -Path $newPath -Raw
    $content = "/* Version forcée: $timestamp */`n$content"
    Set-Content -Path $newPath -Value $content -Force
    
    Write-Host "Créé: $newName"
}

# 3. Mettre à jour tous les fichiers HTML et CSHTML pour référencer les nouveaux fichiers
Write-Host "Mise à jour des références dans les fichiers HTML/CSHTML..." -ForegroundColor Green

# Chercher tous les fichiers HTML et CSHTML
$htmlFiles = Get-ChildItem -Path $PhysicalPath -Include "*.html","*.cshtml" -Recurse

foreach ($file in $htmlFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $modified = $false
    
    # Remplacer les références aux fichiers JS
    foreach ($jsFile in $jsFiles) {
        $oldRef = "~/js/$($jsFile.Name)"
        $newRef = "~/js/$($jsFile.BaseName).$timestamp.js"
        
        # Aussi chercher sans le ~ pour les fichiers non Razor
        $oldRefSimple = "/js/$($jsFile.Name)"
        $newRefSimple = "/js/$($jsFile.BaseName).$timestamp.js"
        
        if ($content -match [regex]::Escape($oldRef) -or $content -match [regex]::Escape($oldRefSimple)) {
            $content = $content -replace [regex]::Escape($oldRef), $newRef
            $content = $content -replace [regex]::Escape($oldRefSimple), $newRefSimple
            $modified = $true
            Write-Host "Modifié référence JS dans $($file.Name)"
        }
    }
    
    # Remplacer les références aux fichiers CSS
    foreach ($cssFile in $cssFiles) {
        $oldRef = "~/css/$($cssFile.Name)"
        $newRef = "~/css/$($cssFile.BaseName).$timestamp.css"
        
        # Aussi chercher sans le ~ pour les fichiers non Razor
        $oldRefSimple = "/css/$($cssFile.Name)"
        $newRefSimple = "/css/$($cssFile.BaseName).$timestamp.css"
        
        if ($content -match [regex]::Escape($oldRef) -or $content -match [regex]::Escape($oldRefSimple)) {
            $content = $content -replace [regex]::Escape($oldRef), $newRef
            $content = $content -replace [regex]::Escape($oldRefSimple), $newRefSimple
            $modified = $true
            Write-Host "Modifié référence CSS dans $($file.Name)"
        }
    }
    
    # Sauvegarder le fichier modifié
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -Force
    }
}

# 4. Vider les caches IIS
Write-Host "Vidage des caches IIS..." -ForegroundColor Green

# Vider le dossier de fichiers temporaires IIS
$tempFolder = "C:\inetpub\temp\IIS Temporary Compressed Files"
if (Test-Path $tempFolder) {
    Get-ChildItem -Path $tempFolder -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
}

# 5. Redémarrer le pool d'applications et le site
Write-Host "Redémarrage du pool d'applications et du site..." -ForegroundColor Green
Start-WebAppPool -Name $appPoolName
Start-Website -Name $SiteName

Write-Host "Réinitialisation terminée." -ForegroundColor Green
Write-Host "IMPORTANT: Videz le cache de votre navigateur (Ctrl+F5) ou ouvrez une nouvelle fenêtre de navigation privée." -ForegroundColor Yellow