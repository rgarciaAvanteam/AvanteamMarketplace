#!/usr/bin/env pwsh
# Script pour mettre à jour la configuration CORS sur le serveur
param (
    [Parameter(Mandatory=$false)]
    [string]$ApiPath = "C:\inetpub\wwwroot\marketplace-dev",
    
    [Parameter(Mandatory=$false)]
    [string]$SpecificOrigin = "https://innatepharma-trial.avanteam-online.com"
)

Write-Host "Mise à jour de la configuration CORS sur le serveur..." -ForegroundColor Green

# 1. Vérifier que le répertoire existe sur le serveur
if (-not (Test-Path $ApiPath)) {
    Write-Error "Le répertoire API n'existe pas à l'emplacement: $ApiPath"
    exit 1
}

# 2. Mettre à jour le fichier appsettings.json
$appsettingsPath = Join-Path -Path $ApiPath -ChildPath "appsettings.json"
if (Test-Path $appsettingsPath) {
    Write-Host "Mise à jour du fichier appsettings.json..." -ForegroundColor Yellow
    
    # Lire le fichier
    $appsettingsContent = Get-Content -Path $appsettingsPath -Raw | ConvertFrom-Json
    
    # Vérifier si le domaine spécifique est déjà présent
    $corsSection = $appsettingsContent.Cors
    if ($corsSection -and $corsSection.AllowedOrigins) {
        $originsArray = $corsSection.AllowedOrigins
        
        # Vérifier si l'origine est déjà présente
        if ($originsArray -notcontains $SpecificOrigin) {
            # Ajouter le domaine spécifique
            $updatedOrigins = $originsArray + $SpecificOrigin
            $appsettingsContent.Cors.AllowedOrigins = $updatedOrigins
            
            # Sauvegarder les modifications
            $appsettingsContent | ConvertTo-Json -Depth 10 | Set-Content -Path $appsettingsPath
            Write-Host "Domaine '$SpecificOrigin' ajouté aux origines autorisées." -ForegroundColor Green
        }
        else {
            Write-Host "Le domaine '$SpecificOrigin' est déjà configuré dans les origines autorisées." -ForegroundColor Yellow
        }
    }
    else {
        Write-Warning "La section CORS est manquante ou incorrectement configurée dans appsettings.json."
    }
}
else {
    Write-Error "Le fichier appsettings.json n'a pas été trouvé à: $appsettingsPath"
}

# 3. Copier le logo SVG s'il n'existe pas
$imagesPath = Join-Path -Path $ApiPath -ChildPath "wwwroot\images"
if (-not (Test-Path $imagesPath)) {
    New-Item -ItemType Directory -Path $imagesPath -Force | Out-Null
    Write-Host "Dossier 'images' créé." -ForegroundColor Yellow
}

$logoPath = Join-Path -Path $imagesPath -ChildPath "marketplace-logo.svg"
if (-not (Test-Path $logoPath)) {
    $logoContent = @"
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50" viewBox="0 0 200 50">
  <rect width="200" height="50" fill="#f0f0f0"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">Marketplace</text>
</svg>
"@
    Set-Content -Path $logoPath -Value $logoContent
    Write-Host "Fichier 'marketplace-logo.svg' créé." -ForegroundColor Green
}
else {
    Write-Host "Le fichier 'marketplace-logo.svg' existe déjà." -ForegroundColor Yellow
}

# 4. Redémarrer le pool d'applications pour appliquer les changements
try {
    Import-Module WebAdministration -ErrorAction Stop
    if (Test-Path "IIS:\AppPools\AvanteamMarketplacePool") {
        Restart-WebAppPool -Name "AvanteamMarketplacePool"
        Write-Host "Pool d'applications 'AvanteamMarketplacePool' redémarré." -ForegroundColor Green
    }
    else {
        Write-Warning "Le pool d'applications 'AvanteamMarketplacePool' n'a pas été trouvé. Veuillez redémarrer manuellement."
    }
}
catch {
    Write-Warning "Impossible de redémarrer automatiquement le pool d'applications. Veuillez le redémarrer manuellement."
    Write-Warning "Erreur: $_"
}

Write-Host "Mise à jour de la configuration CORS terminée." -ForegroundColor Green
Write-Host "Veuillez vérifier que les changements ont été appliqués correctement." -ForegroundColor Green