#
# Script d'installation pour les composants Avanteam Marketplace
# Ce script télécharge et installe les packages de composants pour Process Studio
# Version améliorée qui prend en compte le targetPath du manifest
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
    [switch]$Force = $false,
    
    [Parameter(Mandatory=$false)]
    [string]$CustomTargetPath = ""
)

# Configuration
$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Créer un fichier de log pour cette session d'installation
$logFolderPath = Join-Path $env:TEMP "AvanteamMarketplace\Logs"
if (-not (Test-Path -Path $logFolderPath -PathType Container)) {
    New-Item -Path $logFolderPath -ItemType Directory -Force | Out-Null
}
$logTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFileName = "install_${ComponentId}_${Version}_${logTimestamp}.log"
$global:InstallLogPath = Join-Path $logFolderPath $logFileName

# Fonction pour écrire des messages de journal formatés
function Write-Log {
    param(
        [Parameter(Mandatory=$false)]  # Changement de Mandatory=$true à Mandatory=$false
        [string]$Message = "",         # Ajout d'une valeur par défaut
        
        [Parameter(Mandatory=$false)]
        [ValidateSet("INFO", "WARNING", "ERROR", "SUCCESS", "DEBUG", "VERBOSE", "SCRIPT")]
        [string]$Level = "INFO",
        
        [Parameter(Mandatory=$false)]
        [switch]$NoTimestamp = $false,
        
        [Parameter(Mandatory=$false)]
        [string]$LogFilePath
    )
    
    # Déterminer si on doit ajouter un timestamp
    $timestamp = ""
    if (-not $NoTimestamp) {
        $timestamp = "$(Get-Date -Format "yyyy-MM-dd HH:mm:ss") "
    }
    
    # Créer le message formaté
    $logMessage = ""
    
    # Formater le message selon le niveau
    switch ($Level) {
        "DEBUG" { 
            $logMessage = "${timestamp}[DEBUG] $Message"
            if (-not $env:MARKETPLACE_DEBUG) { return } # Ne pas afficher les messages DEBUG sauf si la variable d'environnement est définie
        }
        "VERBOSE" { 
            $logMessage = "${timestamp}[VERBOSE] $Message" 
            if (-not $VerbosePreference -eq "Continue") { return } # Ne pas afficher les messages VERBOSE sauf si la préférence est définie
        }
        "SCRIPT" {
            $logMessage = "${timestamp}[SCRIPT] $Message"
        }
        default { 
            $logMessage = "${timestamp}[$Level] $Message" 
        }
    }
    
    # Ajouter des couleurs pour la console selon le niveau
    switch ($Level) {
        "ERROR" { Write-Host -ForegroundColor Red $logMessage }
        "WARNING" { Write-Host -ForegroundColor Yellow $logMessage }
        "SUCCESS" { Write-Host -ForegroundColor Green $logMessage }
        "DEBUG" { Write-Host -ForegroundColor Magenta $logMessage }
        "VERBOSE" { Write-Host -ForegroundColor Gray $logMessage }
        "SCRIPT" { Write-Host -ForegroundColor Cyan $logMessage }
        default { Write-Host $logMessage }
    }
    
    # Si un chemin de fichier de log est spécifié, ajouter le message au fichier
    if ($LogFilePath) {
        try {
            $logMessage | Out-File -FilePath $LogFilePath -Append -Encoding UTF8 -ErrorAction SilentlyContinue
        }
        catch {
            # Ignorer les erreurs d'écriture de fichier de log
        }
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
            # Manipuler le message d'erreur pour éviter les problèmes avec les caractères spéciaux
            $errorMsg = $_.Exception.Message -replace ":", "-"
            Write-Log "Impossible de créer le répertoire: $Path - $errorMsg" -Level "ERROR"
            throw
        }
    }
}

# Fonction pour résoudre un chemin relatif en chemin absolu
function Resolve-Path-WithoutChecking {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,
        
        [Parameter(Mandatory=$true)]
        [string]$BasePath
    )
    
    # Traitement des chemins relatifs
    if ($Path.StartsWith("./") -or $Path.StartsWith("../") -or -not $Path.Contains(":")) {
        return [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($BasePath, $Path))
    }
    
    # Chemin absolu
    return $Path
}

# Fonction pour sécuriser les messages d'erreur (éviter les problèmes avec des caractères spéciaux)
function Get-SafeErrorMessage {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)
    
    if ($null -eq $ErrorRecord) { return "Erreur inconnue" }
    
    $errorMsg = $ErrorRecord.Exception.Message
    if ([string]::IsNullOrEmpty($errorMsg)) { return "Erreur sans message" }
    
    # Remplacer les caractères problématiques dans les messages d'erreur
    $errorMsg = $errorMsg -replace ":", "-"
    $errorMsg = $errorMsg -replace ";", ","
    $errorMsg = $errorMsg -replace "\$", "_"
    
    return $errorMsg
}

try {
    # Afficher les informations de début
    Write-Log "Démarrage de l'installation du composant $ComponentId v$Version" -Level "INFO" -LogFilePath $global:InstallLogPath
    Write-Log "URL du package: $ComponentPackageUrl" -Level "INFO" -LogFilePath $global:InstallLogPath
    Write-Log "Répertoire racine: $ProcessStudioRoot" -Level "INFO" -LogFilePath $global:InstallLogPath
    
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
        $errorMsg = Get-SafeErrorMessage $_
        Write-Log "Erreur de téléchargement: $errorMsg" -Level "ERROR"
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
        $errorMsg = Get-SafeErrorMessage $_
        Write-Log "Erreur d'extraction: $errorMsg" -Level "ERROR"
        exit 1
    }
    
    # Rechercher la racine du composant dans l'archive extraite
    $componentRoot = $extractDir
    
    # Rechercher le manifest.json pour obtenir des informations sur le composant
    $manifestPath = $null
    $manifestFiles = Get-ChildItem -Path $extractDir -Filter "manifest.json" -Recurse -ErrorAction SilentlyContinue
    
    if ($manifestFiles -and $manifestFiles.Count -gt 0) {
        $manifestPath = $manifestFiles[0].FullName
        Write-Log "Fichier manifest trouvé: $manifestPath" -Level "INFO"
        
        # Définir la racine du composant comme le dossier contenant le manifest
        $componentRoot = Split-Path -Parent $manifestPath
        Write-Log "Racine du composant déterminée: $componentRoot" -Level "INFO"
    }
    else {
        Write-Log "Aucun fichier manifest.json trouvé. Utilisation du répertoire extrait comme racine du composant." -Level "WARNING"
    }
    
    # Lire le manifest pour obtenir des informations sur le composant
    $targetPath = $null
    $customInstallActions = @()
    
    if ($manifestPath -and (Test-Path -Path $manifestPath -PathType Leaf)) {
        try {
            $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
            
            # Vérifier le nom du composant
            if ($manifest.name) {
                Write-Log "Nom du composant extrait du manifest: $($manifest.name)" -Level "INFO"
            }
            
            # Extraire le targetPath qui est obligatoire
            if ($manifest.installation -and $manifest.installation.targetPath) {
                $targetPath = $manifest.installation.targetPath
                Write-Log "Chemin d'installation trouvé dans le manifest: $targetPath" -Level "INFO"
            }
            else {
                Write-Log "ERREUR: targetPath obligatoire non trouvé dans le manifest!" -Level "ERROR"
                # Si pas de targetPath, abandonner l'installation
                if (-not [string]::IsNullOrEmpty($CustomTargetPath)) {
                    Write-Log "Utilisation du chemin personnalisé spécifié en paramètre comme solution de secours" -Level "WARNING"
                }
                else {
                    Write-Log "Aucun chemin d'installation défini. L'installation ne peut pas continuer." -Level "ERROR"
                    exit 1
                }
            }
            
            # Extraire les actions d'installation personnalisées s'il en existe
            if ($manifest.installation -and $manifest.installation.customActions) {
                $customInstallActions = $manifest.installation.customActions
                Write-Log "Actions d'installation personnalisées trouvées: $($customInstallActions -join ', ')" -Level "INFO"
            }
        }
        catch {
            Write-Log "Erreur lors de la lecture du manifest: $(Get-SafeErrorMessage $_)" -Level "WARNING"
            if (-not [string]::IsNullOrEmpty($CustomTargetPath)) {
                Write-Log "Utilisation du chemin personnalisé spécifié en paramètre comme solution de secours" -Level "WARNING"
            }
            else {
                Write-Log "Impossible de lire le manifest et aucun chemin d'installation défini. L'installation ne peut pas continuer." -Level "ERROR"
                exit 1
            }
        }
    }
    else {
        Write-Log "Aucun fichier manifest trouvé!" -Level "ERROR"
        if (-not [string]::IsNullOrEmpty($CustomTargetPath)) {
            Write-Log "Utilisation du chemin personnalisé spécifié en paramètre comme solution de secours" -Level "WARNING"
        }
        else {
            Write-Log "Aucun manifest et aucun chemin d'installation défini. L'installation ne peut pas continuer." -Level "ERROR"
            exit 1
        }
    }
    
    # Si un chemin personnalisé est spécifié en paramètre, l'utiliser en priorité
    if (-not [string]::IsNullOrEmpty($CustomTargetPath)) {
        $targetPath = $CustomTargetPath
        Write-Log "Utilisation du chemin d'installation personnalisé spécifié en paramètre: $targetPath" -Level "INFO"
    }
    
    # Déterminer les dossiers de destination
    # CORRECTION: Répertoire d'enregistrement dans Custom\MarketPlace\Components\[ComponentId]
    # sans le "app" en double, car ProcessStudioRoot contient déjà le chemin jusqu'à l'app
    $componentRegistryDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Custom", "MarketPlace", "Components", $ComponentId)
    Ensure-Directory -Path $componentRegistryDir
    Write-Log "Répertoire d'enregistrement du composant: $componentRegistryDir" -Level "INFO"
    
    # Déterminer le dossier d'installation cible
    # targetPath est obligatoire et doit être défini à ce stade
    if ([string]::IsNullOrEmpty($targetPath)) {
        Write-Log "ERREUR CRITIQUE: targetPath non défini alors qu'il est obligatoire!" -Level "ERROR"
        exit 1
    }
    
    # Convertir le chemin relatif en chemin absolu
    $componentInstallDir = Resolve-Path-WithoutChecking -Path $targetPath -BasePath $ProcessStudioRoot
    Write-Log "Répertoire d'installation cible (selon targetPath): $componentInstallDir" -Level "INFO"
    
    # S'assurer que le répertoire d'installation existe
    Ensure-Directory -Path $componentInstallDir
    
    # Vérifier si le composant est déjà installé
    $replacingExisting = $false
    if ((Test-Path -Path $componentInstallDir) -and (Get-ChildItem -Path $componentInstallDir -Recurse -File).Count -gt 0) {
        $replacingExisting = $true
        if (-not $Force) {
            Write-Log "Le composant est déjà installé dans: $componentInstallDir. Utilisez -Force pour remplacer." -Level "WARNING"
            
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
    }
    
    # Nettoyer le dossier de destination si force ou confirmation
    if ($replacingExisting -and ($Force -or [Environment]::UserInteractive)) {
        Write-Log "Nettoyage du dossier d'installation: $componentInstallDir" -Level "INFO"
        Remove-Item -Path "$componentInstallDir\*" -Recurse -Force
    }
    
    # Installer les fichiers du composant
    Write-Log "Installation des fichiers du composant..." -Level "INFO"
    
    # 1. Sauvegarde du manifest dans le répertoire d'enregistrement
    if ($manifestPath) {
        Write-Log "Copie du manifest vers: $componentRegistryDir" -Level "INFO"
        try {
            Copy-Item -Path $manifestPath -Destination $componentRegistryDir -Force
        }
        catch {
            Write-Log "Erreur lors de la copie du manifest: $(Get-SafeErrorMessage $_)" -Level "ERROR"
        }
    }
    
    # 2. Identifier les fichiers importants à la racine du composant (README.md, install.ps1, etc.)
    # CORRECTION: Assurons-nous de bien trouver tous les fichiers importants, même avec casse différente
    $rootFiles = @()
    
    # README.md et README.html (insensible à la casse)
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "README.md" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "README.html" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "ReadMe.md" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "ReadMe.html" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "Readme.md" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "Readme.html" -ErrorAction SilentlyContinue
    
    # Scripts d'installation et de désinstallation
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "install.ps1" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "install.bat" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "uninstall.ps1" -ErrorAction SilentlyContinue
    $rootFiles += Get-ChildItem -Path $componentRoot -Filter "uninstall.bat" -ErrorAction SilentlyContinue
    
    Write-Log "Fichiers importants trouvés: $($rootFiles.Count)" -Level "INFO"
    foreach ($file in $rootFiles) {
        Write-Log "  - $($file.Name)" -Level "INFO"
    }
    
    # Copier les fichiers importants à la fois dans le répertoire d'enregistrement et le répertoire d'installation
    foreach ($file in $rootFiles) {
        # Copier dans le répertoire d'enregistrement
        Write-Log "Copie de $($file.Name) vers le répertoire d'enregistrement" -Level "INFO"
        try {
            Copy-Item -Path $file.FullName -Destination $componentRegistryDir -Force
        }
        catch {
            Write-Log "Erreur lors de la copie de $($file.Name) vers le répertoire d'enregistrement: $(Get-SafeErrorMessage $_)" -Level "WARNING"
        }
        
        # Toujours copier aussi dans le répertoire d'installation principale, qui est le plus important
        Write-Log "Copie de $($file.Name) vers le répertoire d'installation" -Level "INFO"
        try {
            Copy-Item -Path $file.FullName -Destination $componentInstallDir -Force
        }
        catch {
            Write-Log "Erreur lors de la copie de $($file.Name) vers le répertoire d'installation: $(Get-SafeErrorMessage $_)" -Level "WARNING"
        }
    }
    
    # 3. Copier le répertoire src
    $srcDir = [System.IO.Path]::Combine($componentRoot, "src")
    if (Test-Path -Path $srcDir -PathType Container) {
        Write-Log "Copie du répertoire 'src' vers le répertoire d'installation: $componentInstallDir" -Level "INFO"
        try {
            Copy-Item -Path "$srcDir\*" -Destination $componentInstallDir -Recurse -Force
            Write-Log "Copie du répertoire 'src' réussie" -Level "SUCCESS"
        }
        catch {
            Write-Log "Erreur lors de la copie du répertoire 'src': $(Get-SafeErrorMessage $_)" -Level "ERROR"
            exit 1
        }
    }
    else {
        # Si pas de dossier src, chercher d'autres structures possibles
        Write-Log "Aucun répertoire 'src' trouvé dans la racine du composant. Recherche d'autres structures..." -Level "INFO"
        
        # Chercher les dossiers à copier dans l'ordre de priorité
        $potentialSrcDirs = @(
            # Chercher un dossier src dans les sous-dossiers
            (Get-ChildItem -Path "$componentRoot\*\src" -Directory -ErrorAction SilentlyContinue),
            # Chercher un dossier avec le nom proche du composant
            (Get-ChildItem -Path "$componentRoot\component-$ComponentId*" -Directory -ErrorAction SilentlyContinue),
            (Get-ChildItem -Path "$componentRoot\*$ComponentId*" -Directory -ErrorAction SilentlyContinue)
        )
        
        $foundSrcDir = $false
        foreach ($dirCollection in $potentialSrcDirs) {
            if ($dirCollection -and $dirCollection.Count -gt 0) {
                $selectedDir = $dirCollection[0].FullName
                Write-Log "Dossier source alternatif trouvé: $selectedDir" -Level "INFO"
                
                try {
                    Write-Log "Copie du contenu vers le répertoire d'installation: $componentInstallDir" -Level "INFO"
                    Copy-Item -Path "$selectedDir\*" -Destination $componentInstallDir -Recurse -Force
                    Write-Log "Copie réussie" -Level "SUCCESS"
                    $foundSrcDir = $true
                    break
                }
                catch {
                    $errorMsg = Get-SafeErrorMessage $_
                    Write-Log "Erreur lors de la copie depuis le dossier source: $errorMsg" -Level "WARNING"
                    # Continuer avec le prochain dossier potentiel
                }
            }
        }
        
        # Si aucun dossier source n'a été trouvé et copié, copier tout le contenu du dossier racine
        if (-not $foundSrcDir) {
            Write-Log "Aucune structure standard trouvée. Copie de tout le contenu du dossier racine." -Level "WARNING"
            try {
                # Exclure le fichier manifest.json qui a déjà été copié
                Get-ChildItem -Path $componentRoot -Exclude "manifest.json" | 
                ForEach-Object {
                    if (($_ -is [System.IO.DirectoryInfo]) -or ($rootFiles -notcontains $_)) {
                        Copy-Item -Path $_.FullName -Destination $componentInstallDir -Recurse -Force
                    }
                }
                Write-Log "Copie du contenu racine réussie" -Level "SUCCESS"
            }
            catch {
                Write-Log "Erreur lors de la copie du contenu racine: $(Get-SafeErrorMessage $_)" -Level "ERROR"
                exit 1
            }
        }
    }
    
    # Créer un fichier de référence dans le répertoire d'enregistrement si le répertoire d'installation est différent
    if ($componentInstallDir -ne $componentRegistryDir) {
        $referenceFilePath = [System.IO.Path]::Combine($componentRegistryDir, "installation-location.txt")
        Write-Log "Création du fichier de référence vers l'emplacement d'installation: $referenceFilePath" -Level "INFO"
        
        try {
            "# Ce fichier est généré automatiquement par le script d'installation" | Out-File -FilePath $referenceFilePath -Encoding utf8
            "# Il indique l'emplacement réel d'installation du composant" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
            "# Utilisé par le script de désinstallation pour localiser tous les fichiers du composant" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
            "" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
            "INSTALL_DIR=$componentInstallDir" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
            "TARGET_PATH=$targetPath" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
            "COMPONENT_ID=$ComponentId" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
            "INSTALLATION_DATE=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $referenceFilePath -Encoding utf8 -Append
        }
        catch {
            Write-Log "Erreur lors de la création du fichier de référence: $(Get-SafeErrorMessage $_)" -Level "WARNING"
        }
    }
    
    # Exécuter le script d'installation post-déploiement si disponible
    $postInstallScript = [System.IO.Path]::Combine($componentInstallDir, "install.ps1")
    if (Test-Path -Path $postInstallScript -PathType Leaf) {
        Write-Log "=======================================================================" -Level "INFO" -LogFilePath $global:InstallLogPath
        Write-Log "DÉBUT DU SCRIPT POST-INSTALLATION: $postInstallScript" -Level "INFO" -LogFilePath $global:InstallLogPath
        Write-Log "=======================================================================" -Level "INFO" -LogFilePath $global:InstallLogPath
        try {
            # CORRECTION: Sauvegarder l'emplacement actuel
            $originalLocation = Get-Location
            
            # CORRECTION: Se déplacer dans le répertoire d'installation avant d'exécuter le script
            Set-Location -Path $componentInstallDir
            Write-Log "Changement de répertoire vers: $componentInstallDir" -Level "INFO"
            
            # CORRECTION: Exécuter le script depuis le répertoire d'installation pour que les chemins relatifs fonctionnent
            # Ne pas passer le paramètre DestinationPath puisque les scripts d'installation ne l'attendent pas
            
            Write-Log "Lancement du script avec les paramètres: -ComponentId $ComponentId -Version $Version -ProcessStudioRoot '$ProcessStudioRoot'" -Level "INFO"
            
            # Capturer la sortie du script et le LASTEXITCODE
            $scriptOutput = $null
            $errorOutput = $null
            
            # Créer un bloc de script qui sera exécuté et dont la sortie sera capturée
            # ASTUCE: Ajouter des préfixes aux lignes de sortie pour que l'API puisse les identifier correctement
            # Utiliser direct-script-test.ps1 pour le diagnostic si demandé
            $diagScript = Join-Path ([System.IO.Path]::GetDirectoryName($PSCommandPath)) "direct-script-test.ps1"
            # Corriger la syntaxe de l'opérateur ternaire qui peut causer le passage du caractère ?
            $scriptToRun = if (Test-Path $diagScript -PathType Leaf) { $diagScript } else { $postInstallScript }
            
            # Logging du script à exécuter
            if ($scriptToRun -eq $diagScript) {
                Write-Log "MODE DIAGNOSTIC: Exécution du script de test direct" -Level "WARNING" -LogFilePath $global:InstallLogPath
            }
            
            $scriptWrapper = @"
            & {
                Write-Host "[SCRIPT] Début de l'exécution du script"
                Write-Host "======================================================================="
                Write-Host "[SCRIPT] DÉBUT DU SCRIPT POST-INSTALLATION: $scriptToRun"
                Write-Host "======================================================================="
                
                try {
                    # Exécution du script avec capture complète des sorties standard et d'erreur
                    `$output = & '$scriptToRun' -ComponentId "$ComponentId" -Version "$Version" -ProcessStudioRoot "$ProcessStudioRoot" 2>&1 
                    
                    # Préfixer chaque ligne avec [SCRIPT] pour l'identification
                    foreach(`$line in `$output) {
                        # Ignorer les lignes vides ou nulles
                        if ([string]::IsNullOrWhiteSpace(`$line)) {
                            Write-Host "[SCRIPT] (ligne vide)"
                            continue
                        }
                        elseif (`$line -is [System.Management.Automation.ErrorRecord]) {
                            Write-Host "[ERROR] `$line"
                        } 
                        else {
                            # Conserver les préfixes [INFO], [WARNING], etc. s'ils existent déjà
                            if (`$line -match '^\[(INFO|WARNING|ERROR|SUCCESS|SCRIPT)\]') {
                                Write-Host "`$line"
                            }
                            else {
                                Write-Host "[SCRIPT] `$line"
                            }
                        }
                    }
                    
                    `$exitCode = `$LASTEXITCODE
                    if (`$exitCode -ne 0) {
                        Write-Host "[ERROR] Le script s'est terminé avec le code d'erreur: `$exitCode"
                    }
                    else {
                        Write-Host "[SUCCESS] Script exécuté avec succès (code: 0)"
                    }
                }
                catch {
                    Write-Host "[ERROR] Exception lors de l'exécution du script: `$_"
                    `$exitCode = 1
                }
                finally {
                    Write-Host "======================================================================="
                    Write-Host "[SCRIPT] FIN DU SCRIPT POST-INSTALLATION"
                    Write-Host "======================================================================="
                }
                
                exit `$exitCode
            }
"@
            
            # Créer un fichier temporaire avec le script wrapper
            $wrapperPath = [System.IO.Path]::Combine($tempDir, "script_wrapper.ps1")
            Set-Content -Path $wrapperPath -Value $scriptWrapper
            
            # Exécuter le script wrapper pour capturer la sortie
            Write-Log "Exécution du script via un wrapper pour assurer la capture de sortie" -Level "INFO" -LogFilePath $global:InstallLogPath
            
            # Exécuter le script wrapper et capturer sa sortie
            $scriptBlock = {
                & powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$wrapperPath"
            }
            
            # Capturer la sortie standard et d'erreur
            $scriptOutput = & {
                $ErrorActionPreference = 'Continue'
                & $scriptBlock 2>&1 | ForEach-Object {
                    # Journaliser chaque ligne
                    $line = "$_"
                    Write-Log $line -NoTimestamp -LogFilePath $global:InstallLogPath
                    
                    # Renvoyer également la ligne pour la capturer dans $scriptOutput
                    $_
                }
            }
            
            # Vérifier le code de sortie
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Le script post-installation a échoué avec le code: $LASTEXITCODE" -Level "ERROR"
                # Ne pas faire échouer l'installation complètement
            }
            else {
                Write-Log "Script post-installation exécuté avec succès" -Level "SUCCESS"
            }
            
            # Afficher un résumé des lignes de sortie
            $outputLineCount = ($scriptOutput | Measure-Object).Count
            Write-Log "Le script post-installation a généré $outputLineCount lignes de sortie" -Level "INFO" -LogFilePath $global:InstallLogPath
            Write-Log "=======================================================================" -Level "INFO" -LogFilePath $global:InstallLogPath
            Write-Log "FIN DU SCRIPT POST-INSTALLATION" -Level "INFO" -LogFilePath $global:InstallLogPath
            Write-Log "=======================================================================" -Level "INFO" -LogFilePath $global:InstallLogPath
            
            # CORRECTION: Revenir à l'emplacement original
            Set-Location -Path $originalLocation
            Write-Log "Retour au répertoire original: $originalLocation" -Level "INFO"
        }
        catch {
            Write-Log "Erreur lors de l'exécution du script post-installation: $(Get-SafeErrorMessage $_)" -Level "ERROR"
            # Tenter de revenir à l'emplacement original en cas d'erreur
            try { Set-Location -Path $originalLocation } catch { }
            # Ne pas faire échouer l'installation complètement
        }
    }
    
    # Nettoyer les fichiers temporaires
    Write-Log "Nettoyage des fichiers temporaires" -Level "INFO"
    try {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    catch {
        Write-Log "Avertissement: Impossible de nettoyer les fichiers temporaires: $(Get-SafeErrorMessage $_)" -Level "WARNING"
    }
    
    # Installation terminée
    Write-Log "Installation du composant $ComponentId v$Version terminée avec succès!" -Level "SUCCESS" -LogFilePath $global:InstallLogPath
    Write-Log "Emplacement d'enregistrement: $componentRegistryDir" -Level "INFO" -LogFilePath $global:InstallLogPath
    Write-Log "Emplacement d'installation: $componentInstallDir" -Level "INFO" -LogFilePath $global:InstallLogPath
    exit 0
}
catch {
    $errorMsg = Get-SafeErrorMessage $_
    $stackTrace = ($_.ScriptStackTrace -replace ":", "-") -replace "\$", "_"
    Write-Log "Erreur non gérée: $errorMsg" -Level "ERROR"
    Write-Log "Détails du script: $stackTrace" -Level "ERROR"
    exit 1
}