#
# Script d'installation pour les composants Avanteam Marketplace
# Ce script télécharge et installe les packages de composants pour Process Studio
#

param(
    [Parameter(Mandatory=$true)]
    [string]$ComponentPackageUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$ComponentId,
    
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$ProcessStudioRoot = "C:\Program Files\Avanteam\ProcessStudio",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Fonction pour écrire des messages de journal formatés
function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet("INFO", "WARNING", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$Level] $Message"
    
    Write-Host $logMessage
    
    # Ajouter des couleurs pour la console
    switch ($Level) {
        "ERROR" { Write-Host -ForegroundColor Red $logMessage }
        "WARNING" { Write-Host -ForegroundColor Yellow $logMessage }
        "SUCCESS" { Write-Host -ForegroundColor Green $logMessage }
        default { Write-Host $logMessage }
    }
}

# Fonction pour nettoyer le chemin
function Clean-Path {
    param([string]$Path)
    return $Path.TrimEnd('\', '/')
}

# Fonction pour vérifier l'existence d'un dossier et le créer si nécessaire
function Ensure-Directory {
    param([string]$Path)
    
    if (-not (Test-Path -Path $Path -PathType Container)) {
        try {
            New-Item -Path $Path -ItemType Directory -Force | Out-Null
            Write-Log "Répertoire créé: $Path" -Level "INFO"
        }
        catch {
            Write-Log "Impossible de créer le répertoire: $Path - $($_.Exception.Message)" -Level "ERROR"
            throw
        }
    }
}

try {
    # Afficher les informations de début
    Write-Log "Démarrage de l'installation du composant $ComponentId v$Version" -Level "INFO"
    Write-Log "URL du package: $ComponentPackageUrl" -Level "INFO"
    Write-Log "Répertoire racine: $ProcessStudioRoot" -Level "INFO"
    
    # Vérifier l'existence du répertoire racine
    if (-not (Test-Path -Path $ProcessStudioRoot -PathType Container)) {
        Write-Log "Le répertoire racine de Process Studio n'existe pas: $ProcessStudioRoot" -Level "ERROR"
        exit 1
    }
    
    # Créer des répertoires temporaires
    $tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "AvanteamMarketplace", "temp_$([Guid]::NewGuid().ToString('N'))")
    Ensure-Directory -Path $tempDir
    Write-Log "Répertoire temporaire créé: $tempDir" -Level "INFO"
    
    # Télécharger le package
    $packagePath = [System.IO.Path]::Combine($tempDir, "component-package.zip")
    Write-Log "Téléchargement du package depuis: $ComponentPackageUrl" -Level "INFO"
    
    try {
        # Vérifier si l'URL est un chemin de fichier local
        if ($ComponentPackageUrl.StartsWith("file://")) {
            $localPath = $ComponentPackageUrl.Substring(7)
            Write-Log "Utilisation du fichier local: $localPath" -Level "INFO"
            
            if (Test-Path -Path $localPath -PathType Leaf) {
                Copy-Item -Path $localPath -Destination $packagePath -Force
            }
            else {
                Write-Log "Le fichier local n'existe pas: $localPath" -Level "ERROR"
                exit 1
            }
        }
        else {
            # Télécharger depuis l'URL
            $webClient = New-Object System.Net.WebClient
            $webClient.DownloadFile($ComponentPackageUrl, $packagePath)
        }
        
        Write-Log "Téléchargement réussi: $packagePath" -Level "SUCCESS"
    }
    catch {
        Write-Log "Erreur de téléchargement: $($_.Exception.Message)" -Level "ERROR"
        exit 1
    }
    
    # Vérifier le fichier téléchargé
    if (-not (Test-Path -Path $packagePath) -or (Get-Item $packagePath).Length -eq 0) {
        Write-Log "Le fichier téléchargé est vide ou n'existe pas" -Level "ERROR"
        exit 1
    }
    
    # Extraire l'archive
    $extractDir = [System.IO.Path]::Combine($tempDir, "extracted")
    Ensure-Directory -Path $extractDir
    
    Write-Log "Extraction du package dans: $extractDir" -Level "INFO"
    try {
        Expand-Archive -Path $packagePath -DestinationPath $extractDir -Force
        Write-Log "Extraction réussie" -Level "SUCCESS"
    }
    catch {
        Write-Log "Erreur d'extraction: $($_.Exception.Message)" -Level "ERROR"
        exit 1
    }
    
    # Déterminer le dossier source dans l'archive
    $srcDir = $null
    
    # Chercher un dossier src, sinon prendre le dossier racine
    if (Test-Path -Path "$extractDir\src") {
        $srcDir = "$extractDir\src"
    }
    elseif (Test-Path -Path "$extractDir\*\src") {
        $srcDir = (Get-ChildItem -Path "$extractDir\*\src" -Directory)[0].FullName
    }
    else {
        # Chercher un dossier avec le nom du composant
        $possibleFolders = @(
            "$extractDir\component-$ComponentId",
            "$extractDir\component-HishikawaDiagram*",
            "$extractDir\*ishikawa*",
            "$extractDir\*Ishikawa*"
        )
        
        foreach ($folder in $possibleFolders) {
            $matchingFolders = Get-ChildItem -Path $folder -Directory -ErrorAction SilentlyContinue
            if ($matchingFolders -and $matchingFolders.Count -gt 0) {
                if (Test-Path -Path "$($matchingFolders[0].FullName)\src") {
                    $srcDir = "$($matchingFolders[0].FullName)\src"
                    break
                }
                else {
                    $srcDir = $matchingFolders[0].FullName
                    break
                }
            }
        }
        
        # Si toujours pas trouvé, prendre le premier dossier dans l'archive
        if (-not $srcDir) {
            $firstLevel = Get-ChildItem -Path $extractDir -Directory
            if ($firstLevel.Count -gt 0) {
                if (Test-Path -Path "$($firstLevel[0].FullName)\src") {
                    $srcDir = "$($firstLevel[0].FullName)\src"
                }
                else {
                    $srcDir = $firstLevel[0].FullName
                }
            }
            else {
                $srcDir = $extractDir
            }
        }
    }
    
    Write-Log "Dossier source déterminé: $srcDir" -Level "INFO"
    
    # Vérifier qu'il y a des fichiers dans le dossier source
    $sourceFiles = Get-ChildItem -Path $srcDir -Recurse -File
    if ($sourceFiles.Count -eq 0) {
        Write-Log "Aucun fichier trouvé dans le dossier source: $srcDir" -Level "ERROR"
        exit 1
    }
    
    # Déterminer le dossier de destination
    $componentDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Components", $ComponentId)
    Ensure-Directory -Path $componentDir
    
    Write-Log "Chemin de destination complet: $componentDir" -Level "INFO"
    
    # Vérifier si le composant est déjà installé
    if ((Test-Path -Path $componentDir) -and (Get-ChildItem -Path $componentDir -Recurse -File).Count -gt 0 -and -not $Force) {
        Write-Log "Le composant est déjà installé dans: $componentDir. Utilisez -Force pour remplacer." -Level "WARNING"
        
        # Demander confirmation si interactif
        if ([Environment]::UserInteractive) {
            $confirmation = Read-Host "Voulez-vous remplacer ce composant ? (o/n)"
            if ($confirmation -ne "o") {
                Write-Log "Installation annulée par l'utilisateur" -Level "INFO"
                exit 0
            }
        }
        else {
            Write-Log "Installation automatique: remplacement du composant existant" -Level "INFO"
        }
    }
    
    # Nettoyer le dossier de destination si force ou confirmation
    if ((Test-Path -Path $componentDir) -and ((Get-ChildItem -Path $componentDir -Recurse -File).Count -gt 0) -and ($Force -or [Environment]::UserInteractive)) {
        Write-Log "Nettoyage du dossier de destination: $componentDir" -Level "INFO"
        Remove-Item -Path "$componentDir\*" -Recurse -Force
    }
    
    # Copier les fichiers
    Write-Log "Copie des fichiers vers: $componentDir" -Level "INFO"
    try {
        Copy-Item -Path "$srcDir\*" -Destination $componentDir -Recurse -Force
        Write-Log "Copie réussie" -Level "SUCCESS"
    }
    catch {
        Write-Log "Erreur lors de la copie des fichiers: $($_.Exception.Message)" -Level "ERROR"
        exit 1
    }
    
    # Exécuter le script d'installation post-déploiement si disponible
    $postInstallScript = [System.IO.Path]::Combine($componentDir, "install.ps1")
    if (Test-Path -Path $postInstallScript -PathType Leaf) {
        Write-Log "Exécution du script post-installation: $postInstallScript" -Level "INFO"
        try {
            & $postInstallScript -ComponentId $ComponentId -Version $Version -DestinationPath $componentDir -ProcessStudioRoot $ProcessStudioRoot
            
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Le script post-installation a échoué avec le code: $LASTEXITCODE" -Level "ERROR"
                # Ne pas faire échouer l'installation complètement
            }
            else {
                Write-Log "Script post-installation exécuté avec succès" -Level "SUCCESS"
            }
        }
        catch {
            Write-Log "Erreur lors de l'exécution du script post-installation: $($_.Exception.Message)" -Level "ERROR"
            # Ne pas faire échouer l'installation complètement
        }
    }
    
    # Nettoyer les fichiers temporaires
    Write-Log "Nettoyage des fichiers temporaires" -Level "INFO"
    try {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    catch {
        Write-Log "Avertissement: Impossible de nettoyer les fichiers temporaires: $($_.Exception.Message)" -Level "WARNING"
    }
    
    # Installation terminée
    Write-Log "Installation du composant $ComponentId v$Version terminée avec succès!" -Level "SUCCESS"
    exit 0
}
catch {
    Write-Log "Erreur non gérée: $($_.Exception.Message)" -Level "ERROR"
    Write-Log "Détails: $($_.Exception.StackTrace)" -Level "ERROR"
    exit 1
}