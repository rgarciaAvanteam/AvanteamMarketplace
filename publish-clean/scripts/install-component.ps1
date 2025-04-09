<#
.SYNOPSIS
    Installe un composant du marketplace Avanteam
    
.DESCRIPTION
    Ce script télécharge et installe un composant depuis le marketplace Avanteam.
    Il est exécuté par le serveur Process Studio lors de l'installation d'un composant.
    
.PARAMETER ComponentPackageUrl
    URL du package du composant à télécharger
    
.PARAMETER ComponentId
    Identifiant du composant
    
.PARAMETER Version
    Version du composant
    
.PARAMETER ProcessStudioRoot
    Répertoire racine de Process Studio. Si non spécifié, le script tentera de le détecter automatiquement.

.PARAMETER LogPath
    Chemin du fichier de log. Par défaut, les logs sont écrits dans le dossier Logs de Process Studio.
    
.EXAMPLE
    .\install-component.ps1 -ComponentPackageUrl "https://marketplace.avanteam.fr/packages/workflow-designer/1.2.0.zip" -ComponentId "workflow-designer" -Version "1.2.0"
#>
param (
    [Parameter(Mandatory=$true)]
    [string]$ComponentPackageUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$ComponentId,
    
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$ProcessStudioRoot = "",
    
    [Parameter(Mandatory=$false)]
    [string]$LogPath = ""
)

# Fonction pour écrire les logs
function Write-InstallLog {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [ValidateSet("INFO", "WARNING", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    
    # Formater le message avec la date et le niveau
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Afficher dans la console avec couleur appropriée
    switch ($Level) {
        "INFO"    { Write-Host $logMessage -ForegroundColor Cyan }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "ERROR"   { Write-Host $logMessage -ForegroundColor Red }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
    }
    
    # Écrire dans le fichier de log
    Add-Content -Path $script:logFile -Value $logMessage
    
    # Si c'est une erreur, ajouter au journal des erreurs
    if ($Level -eq "ERROR") {
        $script:hasErrors = $true
        $script:errorMessages += $logMessage
    }
}

# Variables globales pour le suivi des erreurs
$script:hasErrors = $false
$script:errorMessages = @()

# Définir les chemins
$TempDirectory = Join-Path $env:TEMP "AvanteamMarketplace"
$ComponentDirectory = Join-Path $TempDirectory $ComponentId
$PackageZipFile = Join-Path $TempDirectory "$ComponentId-$Version.zip"

# Créer un ID d'installation unique pour traçabilité
$installId = [guid]::NewGuid().ToString().Substring(0, 8)

# Si ProcessStudioRoot n'est pas spécifié, essayer de le détecter
if ([string]::IsNullOrEmpty($ProcessStudioRoot)) {
    # Monter dans les répertoires parents jusqu'à trouver programs.ini
    $currentPath = (Get-Location).Path
    
    while ($currentPath -ne "") {
        if (Test-Path (Join-Path $currentPath "programs.ini")) {
            $ProcessStudioRoot = $currentPath
            break
        }
        
        # Monter d'un niveau
        $currentPath = Split-Path $currentPath -Parent
    }
    
    if ([string]::IsNullOrEmpty($ProcessStudioRoot)) {
        throw "Impossible de détecter le répertoire racine de Process Studio. Veuillez le spécifier avec -ProcessStudioRoot."
    }
}

# Configurer le chemin de log
if ([string]::IsNullOrEmpty($LogPath)) {
    # Obtenir le répertoire où se trouve le script lui-même
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    Write-Host "Répertoire du script: $scriptDirectory" -ForegroundColor Cyan
    
    # Créer un répertoire Logs au même niveau que le script
    $LogDirectory = Join-Path $scriptDirectory "Logs"
    try {
        if (-not (Test-Path $LogDirectory)) {
            New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
            Write-Host "Répertoire de logs créé: $LogDirectory" -ForegroundColor Cyan
        }
        $script:logFile = Join-Path $LogDirectory "Install-$ComponentId-$Version-$installId.log"
    }
    catch {
        # En cas d'échec, utiliser un emplacement alternatif (dossier temp)
        $fallbackLogDir = Join-Path $env:TEMP "AvanteamMarketplaceLogs"
        if (-not (Test-Path $fallbackLogDir)) {
            New-Item -ItemType Directory -Path $fallbackLogDir -Force | Out-Null
        }
        $script:logFile = Join-Path $fallbackLogDir "Install-$ComponentId-$Version-$installId.log"
        Write-Host "Impossible de créer le répertoire de logs à côté du script. Utilisation du répertoire alternatif: $fallbackLogDir" -ForegroundColor Yellow
    }
    
    # Vérifier si on peut écrire dans le fichier
    try {
        $testContent = "Test d'écriture dans le fichier de log"
        Set-Content -Path $script:logFile -Value $testContent -ErrorAction Stop
        Write-Host "Fichier de log créé et accessible: $($script:logFile)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "AVERTISSEMENT: Impossible d'écrire dans le fichier de log $($script:logFile). Erreur: $_" -ForegroundColor Red
        # Créer un fichier dans le dossier temporaire avec un nom aléatoire
        $script:logFile = Join-Path $env:TEMP "Install-$ComponentId-$([guid]::NewGuid().ToString()).log"
        Write-Host "Utilisation du fichier de log alternatif: $($script:logFile)" -ForegroundColor Yellow
    }
} else {
    $script:logFile = $LogPath
    Write-Host "Utilisation du fichier de log spécifié: $LogPath" -ForegroundColor Cyan
}

try {
    # Démarrer l'installation
    Write-InstallLog "Démarrage de l'installation du composant $ComponentId v$Version (ID: $installId)" -Level "INFO"
    Write-InstallLog "Répertoire racine de Process Studio: $ProcessStudioRoot" -Level "INFO"
    Write-InstallLog "URL du package: $ComponentPackageUrl" -Level "INFO"
    
    # Créer le répertoire temporaire
    if (-not (Test-Path $TempDirectory)) {
        New-Item -ItemType Directory -Path $TempDirectory -Force | Out-Null
        Write-InstallLog "Répertoire temporaire créé: $TempDirectory" -Level "INFO"
    }
    
    # Télécharger le package
    Write-InstallLog "Téléchargement du package..." -Level "INFO"
    try {
        $ProgressPreference = 'SilentlyContinue' # Désactiver la barre de progression pour accélérer le téléchargement
        $startTime = Get-Date
        Invoke-WebRequest -Uri $ComponentPackageUrl -OutFile $PackageZipFile
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        $ProgressPreference = 'Continue'
        
        # Vérifier si le fichier existe et a une taille correcte
        if (Test-Path $PackageZipFile) {
            $fileSize = (Get-Item $PackageZipFile).Length / 1KB
            Write-InstallLog "Package téléchargé avec succès en $($duration.ToString("0.00")) secondes. Taille: $($fileSize.ToString("0.00")) KB" -Level "INFO"
        } else {
            throw "Le fichier téléchargé n'existe pas"
        }
    }
    catch {
        Write-InstallLog "Erreur lors du téléchargement du package: $_" -Level "ERROR"
        throw "Erreur lors du téléchargement du package: $_"
    }
    
    # Extraire le package
    Write-InstallLog "Extraction du package..." -Level "INFO"
    try {
        if (Test-Path $ComponentDirectory) {
            Remove-Item -Path $ComponentDirectory -Recurse -Force
            Write-InstallLog "Ancien répertoire temporaire du composant supprimé" -Level "INFO"
        }
        New-Item -ItemType Directory -Path $ComponentDirectory -Force | Out-Null
        
        Expand-Archive -Path $PackageZipFile -DestinationPath $ComponentDirectory -Force
        Write-InstallLog "Package extrait avec succès dans $ComponentDirectory" -Level "INFO"
        
        # Liste des fichiers extraits pour le débogage
        $extractedFiles = Get-ChildItem -Path $ComponentDirectory -Recurse | Select-Object -ExpandProperty FullName
        Write-InstallLog "Fichiers extraits: $($extractedFiles.Count) fichiers trouvés" -Level "INFO"
        foreach ($file in $extractedFiles) {
            Write-InstallLog "  - $file" -Level "INFO"
        }
    }
    catch {
        Write-InstallLog "Erreur lors de l'extraction du package: $_" -Level "ERROR"
        throw "Erreur lors de l'extraction du package: $_"
    }
    
    # Vérifier si le manifest est dans un sous-dossier (cas des packages avec un dossier racine)
    $manifestFile = Join-Path $ComponentDirectory "manifest.json"
    if (-not (Test-Path $manifestFile)) {
        Write-InstallLog "manifest.json non trouvé à la racine, recherche dans les sous-dossiers..." -Level "INFO"
        $manifestFiles = Get-ChildItem -Path $ComponentDirectory -Filter "manifest.json" -Recurse
        if ($manifestFiles.Count -gt 0) {
            $manifestFile = $manifestFiles[0].FullName
            Write-InstallLog "manifest.json trouvé dans: $manifestFile" -Level "INFO"
            
            # Ajuster le répertoire du composant au dossier contenant le manifest
            $ComponentDirectory = Split-Path $manifestFile -Parent
            Write-InstallLog "Répertoire du composant ajusté à: $ComponentDirectory" -Level "INFO"
        } else {
            Write-InstallLog "Le fichier manifest.json n'a pas été trouvé dans le package" -Level "ERROR"
            throw "Le fichier manifest.json n'a pas été trouvé dans le package."
        }
    }
    
    # Lire le manifest
    try {
        $manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
        Write-InstallLog "Manifest lu avec succès" -Level "INFO"
        Write-InstallLog "Nom du composant: $($manifest.name)" -Level "INFO"
        Write-InstallLog "Version: $($manifest.version)" -Level "INFO"
        Write-InstallLog "Auteur: $($manifest.author)" -Level "INFO"
        
        # Vérifier la version
        if ($manifest.version -ne $Version) {
            Write-InstallLog "Avertissement: La version du manifest ($($manifest.version)) ne correspond pas à la version demandée ($Version)" -Level "WARNING"
        }
    }
    catch {
        Write-InstallLog "Erreur lors de la lecture du manifest: $_" -Level "ERROR"
        throw "Erreur lors de la lecture du manifest: $_"
    }
    
    # Déterminer le répertoire cible
    $targetPath = $manifest.installation.targetPath
    if ([string]::IsNullOrEmpty($targetPath)) {
        $targetPath = "Components/$ComponentId"
        Write-InstallLog "Aucun chemin cible spécifié dans le manifest, utilisation de la valeur par défaut: $targetPath" -Level "INFO"
    } else {
        Write-InstallLog "Chemin cible spécifié dans le manifest: $targetPath" -Level "INFO"
    }
    
    # Chemin complet de destination (directement à la racine du site client)
    $destinationPath = Join-Path $ProcessStudioRoot $targetPath
    Write-InstallLog "Chemin de destination complet: $destinationPath" -Level "INFO"
    
    # Créer le répertoire de destination s'il n'existe pas
    if (-not (Test-Path $destinationPath)) {
        Write-InstallLog "Création du répertoire de destination: $destinationPath" -Level "INFO"
        New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
    }
    else {
        Write-InstallLog "Le répertoire de destination existe déjà, sauvegarde et suppression du contenu précédent" -Level "INFO"
        
        # Créer un répertoire de backup
        $backupDir = "$destinationPath.bak-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
        if (Test-Path $destinationPath) {
            try {
                # Copier l'ancien contenu dans le répertoire de backup
                Copy-Item -Path $destinationPath -Destination $backupDir -Recurse -Force
                Write-InstallLog "Sauvegarde de l'ancienne version créée dans: $backupDir" -Level "INFO"
                
                # Supprimer l'ancien contenu
                Get-ChildItem -Path $destinationPath -Recurse | Remove-Item -Recurse -Force
                Write-InstallLog "Ancien contenu supprimé avec succès" -Level "INFO"
            }
            catch {
                Write-InstallLog "Erreur lors de la sauvegarde/suppression de l'ancien contenu: $_" -Level "WARNING"
                # Continuer malgré l'erreur
            }
        }
    }
    
    # Copier les fichiers
    Write-InstallLog "Copie des fichiers vers $destinationPath..." -Level "INFO"
    try {
        # Créer d'abord tous les répertoires parents nécessaires s'ils n'existent pas
        $parentDir = Split-Path -Parent $destinationPath
        if (-not (Test-Path $parentDir)) {
            Write-InstallLog "Création des répertoires parents: $parentDir" -Level "INFO"
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }
        
        $sourceDirectory = Join-Path $ComponentDirectory "src"
        if (Test-Path $sourceDirectory) {
            Write-InstallLog "Dossier 'src' trouvé, copie du contenu directement vers $destinationPath" -Level "INFO"
            $sourceFiles = Get-ChildItem -Path "$sourceDirectory\*" -Recurse
            Write-InstallLog "Nombre de fichiers à copier: $($sourceFiles.Count)" -Level "INFO"
            
            # Lister les fichiers qui seront copiés
            foreach ($file in $sourceFiles) {
                $relativePath = $file.FullName.Substring($sourceDirectory.Length)
                Write-InstallLog "Fichier à copier: src$relativePath" -Level "INFO"
            }
            
            Copy-Item -Path "$sourceDirectory\*" -Destination $destinationPath -Recurse -Force
        }
        else {
            Write-InstallLog "Pas de dossier 'src', copie de tous les fichiers sauf ceux exclus" -Level "INFO"
            $excludedFiles = @("manifest.json", "install.ps1", "CHANGELOG.md", "README.md")
            Write-InstallLog "Fichiers exclus: $($excludedFiles -join ', ')" -Level "INFO"
            
            $filesToCopy = Get-ChildItem -Path $ComponentDirectory -Exclude $excludedFiles
            Write-InstallLog "Nombre de fichiers/dossiers à copier: $($filesToCopy.Count)" -Level "INFO"
            foreach ($item in $filesToCopy) {
                Write-InstallLog "Copie de: $($item.FullName)" -Level "INFO"
                Copy-Item -Path $item.FullName -Destination $destinationPath -Recurse -Force
            }
        }
        
        # Vérifier les fichiers copiés
        $copiedFiles = Get-ChildItem -Path $destinationPath -Recurse -ErrorAction SilentlyContinue
        $copiedCount = if ($null -eq $copiedFiles) { 0 } else { $copiedFiles.Count }
        Write-InstallLog "Installation terminée, $copiedCount fichiers copiés" -Level "INFO"
    }
    catch {
        Write-InstallLog "Erreur lors de la copie des fichiers: $_" -Level "ERROR"
        throw "Erreur lors de la copie des fichiers: $_"
    }
    
    # Exécuter le script d'installation personnalisé si présent
    $installScript = Join-Path $ComponentDirectory "install.ps1"
    if (Test-Path $installScript) {
        Write-InstallLog "Script d'installation personnalisé trouvé: $installScript" -Level "INFO"
        try {
            Write-InstallLog "Exécution du script d'installation personnalisé..." -Level "INFO"
            
            # Sortir le contenu du script d'installation pour le log
            $installScriptContent = Get-Content -Path $installScript -Raw
            Write-InstallLog "Contenu du script d'installation:" -Level "INFO"
            Write-InstallLog "------------------------------------------------------" -Level "INFO"
            foreach ($line in $installScriptContent -split "`n") {
                Write-InstallLog $line -Level "INFO"
            }
            Write-InstallLog "------------------------------------------------------" -Level "INFO"
            
            # Exécuter le script avec le répertoire racine en paramètre
            $currentLocation = Get-Location
            Write-InstallLog "Emplacement actuel: $currentLocation" -Level "INFO"
            
            # Créer un fichier de log dédié pour la sortie du script d'installation personnalisé
            $customScriptLogFile = Join-Path $script:logFile.Directory "Install-$ComponentId-$Version-$installId-CustomScript.log"
            Write-InstallLog "Log dédié pour le script personnalisé: $customScriptLogFile" -Level "INFO"
            
            # Exécuter le script personnalisé avec paramètres et redirection de sortie
            $scriptCommand = "& '$installScript' -ProcessStudioRoot '$ProcessStudioRoot' -ComponentId '$ComponentId' -Version '$Version' *> '$customScriptLogFile'"
            Write-InstallLog "Commande d'exécution: $scriptCommand" -Level "INFO"
            
            # Exécuter via Invoke-Expression pour capturer toute la sortie
            $output = Invoke-Expression -Command $scriptCommand
            
            # Vérifier si le fichier de log existe et l'ajouter à notre log principal
            if (Test-Path $customScriptLogFile) {
                $customOutput = Get-Content -Path $customScriptLogFile -Raw
                Write-InstallLog "Sortie du script personnalisé:" -Level "INFO"
                Write-InstallLog "------------------------------------------------------" -Level "INFO"
                Write-InstallLog $customOutput -Level "INFO"
                Write-InstallLog "------------------------------------------------------" -Level "INFO"
            }
            
            Write-InstallLog "Script d'installation personnalisé exécuté avec succès" -Level "SUCCESS"
        }
        catch {
            Write-InstallLog "Erreur lors de l'exécution du script d'installation personnalisé: $_" -Level "WARNING"
            Write-InstallLog $_.ScriptStackTrace -Level "WARNING"
            # Ne pas échouer l'installation complète si le script échoue
        }
    } else {
        Write-InstallLog "Aucun script d'installation personnalisé trouvé" -Level "INFO"
    }
    
    # Nettoyer les fichiers temporaires
    Write-InstallLog "Nettoyage des fichiers temporaires..." -Level "INFO"
    try {
        if (Test-Path $ComponentDirectory) {
            Remove-Item -Path $ComponentDirectory -Recurse -Force
        }
        if (Test-Path $PackageZipFile) {
            Remove-Item -Path $PackageZipFile -Force
        }
        Write-InstallLog "Fichiers temporaires supprimés avec succès" -Level "INFO"
    }
    catch {
        Write-InstallLog "Erreur lors du nettoyage des fichiers temporaires: $_" -Level "WARNING"
        # Ne pas échouer l'installation si le nettoyage échoue
    }
    
    # Terminer l'installation
    if ($script:hasErrors) {
        Write-InstallLog "Installation du composant $ComponentId v$Version terminée avec des erreurs. Voir le journal pour plus de détails." -Level "ERROR"
        Write-InstallLog "Résumé des erreurs:" -Level "ERROR"
        foreach ($errorMsg in $script:errorMessages) {
            Write-InstallLog $errorMsg -Level "ERROR"
        }
        throw "L'installation s'est terminée avec des erreurs. Voir le journal pour plus de détails: $($script:logFile)"
    } else {
        Write-InstallLog "Installation du composant $ComponentId v$Version terminée avec succès!" -Level "SUCCESS"
        Write-InstallLog "Journal d'installation complet disponible dans: $($script:logFile)" -Level "INFO"
    }
    
    # Retourner le chemin du log pour l'interface
    return @{
        Success = $true
        LogFile = $script:logFile
        InstallId = $installId
        ComponentId = $ComponentId
        Version = $Version
        DestinationPath = $destinationPath
    }
}
catch {
    # Capture et log de l'erreur finale
    $errorMessage = "ERREUR CRITIQUE: $_"
    if ($null -ne $script:logFile -and $script:logFile -ne "") {
        Add-Content -Path $script:logFile -Value "[$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] [ERROR] $errorMessage"
    }
    # Retourner l'échec
    return @{
        Success = $false
        Error = $errorMessage
        LogFile = $script:logFile
        InstallId = $installId
    }
}