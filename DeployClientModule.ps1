<#
.SYNOPSIS
    Script de déploiement du module client Avanteam Marketplace dans Process Studio
    
.DESCRIPTION
    Ce script déploie le module client Avanteam Marketplace dans une instance de Process Studio.
    Il copie les fichiers nécessaires, génère une clé API et configure le Web.config.
    
.PARAMETER ProcessStudioPath
    Chemin d'installation de Process Studio (défaut: C:\ProcessStudio)
    
.PARAMETER CustomPath
    Chemin personnalisé pour l'installation du module client. Si spécifié, remplace ProcessStudioPath.
    Alias: TargetPath
    
.PARAMETER ApiUrl
    URL de l'API Marketplace (défaut: https://marketplace-dev.avanteam-online.com/api/marketplace)
    
.EXAMPLE
    # Installation dans le chemin par défaut de Process Studio
    .\DeployClientModule.ps1 -ProcessStudioPath "D:\ProcessStudio" -ApiUrl "https://mon-serveur.com/api/marketplace"
    
.EXAMPLE
    # Installation dans un chemin personnalisé
    .\DeployClientModule.ps1 -CustomPath "I:\AVANTEAM\POC\TRIAL INNATEPHARMA\Avanteam Process Suite\PStudio.Net.Web\app\Custom\MarketPlace" -ApiUrl "https://marketplace-dev.avanteam-online.com/api/marketplace"
    
.EXAMPLE
    # Installation avec le paramètre alias TargetPath
    .\DeployClientModule.ps1 -TargetPath "C:\ProcessStudio\Custom\MonMarketplace" -ApiUrl "https://marketplace-dev.avanteam-online.com/api/marketplace"
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$ProcessStudioPath = "C:\ProcessStudio",
    
    [Parameter(Mandatory=$false)]
    [Alias("TargetPath")]  # Ajoute un alias pour la compatibilité
    [string]$CustomPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "https://marketplace-dev.avanteam-online.com/api/marketplace"
)

# Déterminer le chemin de destination
if ($CustomPath) {
    # Si un chemin personnalisé est fourni, l'utiliser directement
    $destinationPath = $CustomPath
    
    # Vérifier que le dossier parent existe
    $parentPath = Split-Path -Parent $destinationPath
    if (-not (Test-Path $parentPath)) {
        Write-Error "Le dossier parent du chemin de destination n'existe pas: $parentPath"
        exit 1
    }
} else {
    # Vérifier que le chemin de Process Studio existe
    if (-not (Test-Path $ProcessStudioPath)) {
        Write-Error "Le chemin d'installation de Process Studio n'existe pas: $ProcessStudioPath"
        exit 1
    }
    
    # Utiliser le chemin par défaut
    $destinationPath = Join-Path $ProcessStudioPath "Custom\AvanteamMarketplace"
}
if (-not (Test-Path $destinationPath)) {
    Write-Host "Création du répertoire $destinationPath..."
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
}
else {
    Write-Host "Le répertoire $destinationPath existe déjà. Les fichiers seront remplacés."
}

# Chemin source (dossier actuel)
$sourcePath = $PSScriptRoot
Write-Host "Déploiement depuis: $sourcePath"
Write-Host "Déploiement vers: $destinationPath"

# Liste des dossiers et fichiers à exclure de la copie
$excludeItems = @(
    "src",
    "*.sln",
    "*.suo",
    "*.user",
    ".vs",
    ".git",
    "bin",
    "obj",
    "publish",
    "node_modules",
    "DeployClientModule.ps1",
    "DEPLOYMENT.md"
)

# Copier les fichiers
Write-Host "Copie des fichiers..."

# Créer les dossiers de destination
$folders = @("App_LocalResources", "css", "images", "js", "scripts")
foreach ($folder in $folders) {
    $folderPath = Join-Path $destinationPath $folder
    if (-not (Test-Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    }
}

# Fonction pour copier les fichiers en excluant certains éléments
function Copy-ItemsRecursively {
    param (
        [string]$Source,
        [string]$Destination,
        [array]$Exclude
    )
    
    # Obtenir tous les éléments du dossier source
    $items = Get-ChildItem -Path $Source -Force
    
    foreach ($item in $items) {
        $excluded = $false
        
        # Vérifier si l'élément est à exclure
        foreach ($pattern in $Exclude) {
            if ($item.Name -like $pattern) {
                $excluded = $true
                break
            }
        }
        
        if (-not $excluded) {
            $destPath = Join-Path $Destination $item.Name
            
            if ($item.PSIsContainer) {
                # C'est un dossier, vérifier s'il est dans la liste des dossiers à inclure
                if ($folders -contains $item.Name) {
                    # Créer le dossier destination s'il n'existe pas
                    if (-not (Test-Path $destPath)) {
                        New-Item -ItemType Directory -Path $destPath -Force | Out-Null
                    }
                    
                    # Copier le contenu du dossier récursivement
                    Copy-ItemsRecursively -Source $item.FullName -Destination $destPath -Exclude $Exclude
                }
            }
            else {
                # C'est un fichier, le copier directement
                Copy-Item -Path $item.FullName -Destination $destPath -Force
            }
        }
    }
}

# Copier les fichiers spécifiques
Copy-Item -Path (Join-Path $sourcePath "Default.aspx") -Destination $destinationPath -Force
Copy-Item -Path (Join-Path $sourcePath "Default.aspx.cs") -Destination $destinationPath -Force
Copy-Item -Path (Join-Path $sourcePath "Web.config") -Destination $destinationPath -Force
Copy-Item -Path (Join-Path $sourcePath "README.md") -Destination $destinationPath -Force

# Copier les dossiers spécifiques
Copy-ItemsRecursively -Source (Join-Path $sourcePath "App_LocalResources") -Destination (Join-Path $destinationPath "App_LocalResources") -Exclude $excludeItems
Copy-ItemsRecursively -Source (Join-Path $sourcePath "css") -Destination (Join-Path $destinationPath "css") -Exclude $excludeItems
Copy-ItemsRecursively -Source (Join-Path $sourcePath "js") -Destination (Join-Path $destinationPath "js") -Exclude $excludeItems
Copy-ItemsRecursively -Source (Join-Path $sourcePath "scripts") -Destination (Join-Path $destinationPath "scripts") -Exclude $excludeItems

# Copier les images s'il y en a
if (Test-Path (Join-Path $sourcePath "images")) {
    Copy-ItemsRecursively -Source (Join-Path $sourcePath "images") -Destination (Join-Path $destinationPath "images") -Exclude $excludeItems
}

# Mettre à jour le Web.config avec l'URL de l'API
Write-Host "Configuration de l'URL de l'API dans Web.config: $ApiUrl"
$webConfigPath = Join-Path $destinationPath "Web.config"
[xml]$webConfig = Get-Content $webConfigPath

# Mettre à jour l'URL de l'API
$apiUrlNode = $webConfig.configuration.appSettings.add | Where-Object { $_.key -eq "MarketplaceApiUrl" }
if ($apiUrlNode -ne $null) {
    $apiUrlNode.value = $ApiUrl
}
else {
    $newNode = $webConfig.CreateElement("add")
    $newNode.SetAttribute("key", "MarketplaceApiUrl")
    $newNode.SetAttribute("value", $ApiUrl)
    $webConfig.configuration.appSettings.AppendChild($newNode) | Out-Null
}

# Sauvegarder le Web.config
$webConfig.Save($webConfigPath)

# Générer une clé API
Write-Host "Génération d'une clé API..."
$generateApiKeyScript = Join-Path $destinationPath "scripts\generate-api-key.ps1"
if (Test-Path $generateApiKeyScript) {
    & $generateApiKeyScript -WebConfigPath $webConfigPath
}
else {
    Write-Warning "Le script de génération de clé API n'a pas été trouvé: $generateApiKeyScript"
}

Write-Host "Déploiement terminé avec succès!" -ForegroundColor Green
Write-Host "Le module Avanteam Marketplace est maintenant disponible à l'adresse:"
Write-Host "http://votre-serveur/Custom/AvanteamMarketplace/Default.aspx" -ForegroundColor Cyan
Write-Host ""
Write-Host "N'oubliez pas de redémarrer l'application Process Studio pour prendre en compte les changements."