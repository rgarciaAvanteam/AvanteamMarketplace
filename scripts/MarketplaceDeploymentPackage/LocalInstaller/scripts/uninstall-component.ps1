#
# Script de désinstallation pour les composants Avanteam Marketplace
# Ce script supprime les composants installés par Process Studio
# Version améliorée qui prend en compte le targetPath du manifest
#


param(
    [Parameter(Mandatory=$true)]
    [string]$ComponentId,
    
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
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Ajouter des couleurs pour la console
    switch ($Level) {
        "ERROR" { Write-Host -ForegroundColor Red $logMessage }
        "WARNING" { Write-Host -ForegroundColor Yellow $logMessage }
        "SUCCESS" { Write-Host -ForegroundColor Green $logMessage }
        default { Write-Host $logMessage }
    }
}

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

try {
    # Afficher les informations de début
    Write-Log "Démarrage de la désinstallation du composant $ComponentId" -Level "INFO"
    Write-Log "Répertoire racine: $ProcessStudioRoot" -Level "INFO"
    
    # Vérifier l'existence du répertoire racine
    if (-not (Test-Path -Path $ProcessStudioRoot -PathType Container)) {
        Write-Log "Le répertoire racine de Process Studio n'existe pas: $ProcessStudioRoot" -Level "ERROR"
        exit 1
    }
    
    # CORRECTION: Déterminer le dossier du composant (nouvel emplacement sous Custom\MarketPlace)
    # sans le 'app' en double, car ProcessStudioRoot contient déjà le chemin jusqu'à l'app
    $componentDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Custom", "MarketPlace", "Components", $ComponentId)
    $componentInstalled = Test-Path -Path $componentDir -PathType Container
    
    # Vérifier aussi l'ancien emplacement pour la compatibilité
    $oldComponentDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Components", $ComponentId)
    $oldComponentInstalled = Test-Path -Path $oldComponentDir -PathType Container
    
    if ($oldComponentInstalled) {
        Write-Log "Le composant est installé à l'ancien emplacement: $oldComponentDir" -Level "WARNING"
        # Si le composant n'est pas trouvé au nouvel emplacement mais à l'ancien, utiliser l'ancien
        if (-not $componentInstalled) {
            $componentDir = $oldComponentDir
            $componentInstalled = $true
            Write-Log "Utilisation de l'ancien emplacement pour cette désinstallation" -Level "INFO"
        }
    }
    
    # Chercher le fichier manifest.json pour des informations sur le composant
    $manifestPath = [System.IO.Path]::Combine($componentDir, "manifest.json")
    $hasManifest = $componentInstalled -and (Test-Path -Path $manifestPath -PathType Leaf)
    $componentName = "Composant $ComponentId"
    $customInstallPath = $null
    
    # Lire le manifest pour trouver les informations du composant et les emplacements personnalisés
    if ($hasManifest) {
        try {
            Write-Log "Lecture du manifest pour obtenir les informations du composant" -Level "INFO"
            $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
            
            if ($manifest.name) {
                $componentName = $manifest.name
                Write-Log "Nom du composant extrait du manifest: $componentName" -Level "INFO"
            }
            
            # Extraire l'emplacement d'installation personnalisé du manifest
            if ($manifest.installation -and $manifest.installation.targetPath) {
                $customTargetPath = $manifest.installation.targetPath
                Write-Log "Chemin d'installation personnalisé trouvé dans le manifest: $customTargetPath" -Level "INFO"
                
                # Convertir le chemin relatif en chemin absolu
                $customInstallPath = Resolve-Path-WithoutChecking -Path $customTargetPath -BasePath $ProcessStudioRoot
                Write-Log "Chemin d'installation personnalisé résolu: $customInstallPath" -Level "INFO"
                
                # Vérifier si l'emplacement personnalisé existe
                if (Test-Path -Path $customInstallPath -PathType Container) {
                    Write-Log "Le composant est installé à l'emplacement personnalisé: $customInstallPath" -Level "INFO"
                } else {
                    Write-Log "L'emplacement personnalisé n'existe pas: $customInstallPath" -Level "WARNING"
                    $customInstallPath = $null
                }
            }
            
            # Traiter les dépendances ou les références spécifiques ici si nécessaire
            if ($manifest.dependencies -and $manifest.dependencies.Count -gt 0) {
                Write-Log "Ce composant a des dépendances. Assurez-vous que sa suppression ne perturbera pas d'autres composants." -Level "WARNING"
                foreach ($dep in $manifest.dependencies) {
                    Write-Log "  - Dépendance: $($dep.name) (ID: $($dep.id))" -Level "INFO"
                }
                
                if (-not $Force) {
                    Write-Log "Utilisez -Force pour désinstaller malgré les dépendances" -Level "WARNING"
                    # Si interactif, demander confirmation
                    if ([Environment]::UserInteractive) {
                        $confirmation = Read-Host "Voulez-vous continuer la désinstallation malgré les dépendances ? (o/n)"
                        if ($confirmation -ne "o") {
                            Write-Log "Désinstallation annulée par l'utilisateur" -Level "INFO"
                            exit 0
                        }
                    }
                    else {
                        Write-Log "Désinstallation annulée en raison de dépendances. Utilisez -Force pour forcer la désinstallation." -Level "WARNING"
                        exit 0
                    }
                }
            }
        }
        catch {
            Write-Log "Erreur lors de la lecture du manifest: $($_.Exception.Message)" -Level "WARNING"
        }
    }
    
    # Vérifier si le composant est déjà désinstallé à l'emplacement personnalisé
    if (-not $customInstallPath) {
        # Si le composant était installé à l'emplacement standard, pas besoin de chercher ailleurs
        if ($componentInstalled) {
            Write-Log "Le composant est installé à l'emplacement standard, pas d'autre emplacement à vérifier" -Level "INFO"
        }
        else {
            Write-Log "Recherche d'autres emplacements possibles d'installation..." -Level "INFO"
        }
    }
    
    # Vérifier si le composant est installé (emplacement standard, personnalisé ou par défaut)
    if (-not $componentInstalled -and -not $customInstallPath) {
        Write-Log "Le composant $ComponentId n'est pas installé (ni dans l'emplacement standard, ni dans un emplacement personnalisé, ni dans l'emplacement par défaut)" -Level "ERROR"
        exit 0
    }
    
    # Vérifier pour un script de désinstallation personnalisé
    $uninstallScript = [System.IO.Path]::Combine($componentDir, "uninstall.ps1")
    if (Test-Path -Path $uninstallScript -PathType Leaf) {
        Write-Log "Exécution du script de désinstallation personnalisé: $uninstallScript" -Level "INFO"
        try {
            # CORRECTION: Sauvegarder l'emplacement actuel
            $originalLocation = Get-Location
            
            # CORRECTION: Se déplacer dans le répertoire du composant avant d'exécuter le script
            Set-Location -Path $componentDir
            Write-Log "Changement de répertoire vers: $componentDir" -Level "INFO"
            
            # Exécuter le script de désinstallation depuis le répertoire du composant
            Write-Log "Lancement du script avec les paramètres: -ComponentId $ComponentId -ProcessStudioRoot $ProcessStudioRoot" -Level "INFO"
            & $uninstallScript -ComponentId $ComponentId -ProcessStudioRoot $ProcessStudioRoot
            
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Le script de désinstallation personnalisé a échoué avec le code: $LASTEXITCODE" -Level "ERROR"
                # Continuer avec la désinstallation normale si le script personnalisé échoue
            }
            else {
                Write-Log "Script de désinstallation personnalisé exécuté avec succès" -Level "SUCCESS"
            }
            
            # CORRECTION: Revenir à l'emplacement original
            Set-Location -Path $originalLocation
            Write-Log "Retour au répertoire original: $originalLocation" -Level "INFO"
        }
        catch {
            Write-Log "Erreur lors de l'exécution du script de désinstallation personnalisé: $($_.Exception.Message)" -Level "ERROR"
            # Tenter de revenir à l'emplacement original en cas d'erreur
            try { Set-Location -Path $originalLocation } catch { }
            # Continuer avec la désinstallation normale si le script personnalisé échoue
        }
    }
    
    # Créer une sauvegarde avant la suppression
    $backupDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Backups", "Components", "$ComponentId-$(Get-Date -Format 'yyyyMMdd-HHmmss')")
    Write-Log "Création d'une sauvegarde dans: $backupDir" -Level "INFO"
    
    try {
        # Créer le répertoire parent s'il n'existe pas
        $parentDir = [System.IO.Path]::GetDirectoryName($backupDir)
        if (-not (Test-Path -Path $parentDir -PathType Container)) {
            New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
        }
        
        # Copier tous les fichiers du composant dans la sauvegarde
        if ($componentInstalled) {
            Copy-Item -Path $componentDir -Destination "$backupDir\standard" -Recurse -Force
            Write-Log "Sauvegarde de l'emplacement standard créée avec succès" -Level "SUCCESS"
        }
        
        # Si un emplacement personnalisé existe, le sauvegarder aussi
        if ($customInstallPath) {
            Copy-Item -Path $customInstallPath -Destination "$backupDir\custom" -Recurse -Force
            Write-Log "Sauvegarde de l'emplacement personnalisé créée avec succès" -Level "SUCCESS"
        }
    }
    catch {
        Write-Log "Erreur lors de la création de la sauvegarde: $($_.Exception.Message)" -Level "ERROR"
        if (-not $Force) {
            Write-Log "Désinstallation annulée en raison de l'échec de la sauvegarde. Utilisez -Force pour ignorer cette étape." -Level "ERROR"
            exit 1
        }
        else {
            Write-Log "Continuation de la désinstallation sans sauvegarde (Force=true)" -Level "WARNING"
        }
    }
    
    # Supprimer le composant dans l'emplacement standard
    if ($componentInstalled) {
        Write-Log "Suppression du composant $componentName ($ComponentId) depuis l'emplacement standard: $componentDir" -Level "INFO"
        try {
            Remove-Item -Path $componentDir -Recurse -Force
            Write-Log "Désinstallation de l'emplacement standard réussie" -Level "SUCCESS"
        }
        catch {
            Write-Log "Erreur lors de la suppression du composant (emplacement standard): $($_.Exception.Message)" -Level "ERROR"
            # Ne pas quitter, essayer de supprimer l'emplacement personnalisé
        }
    }
    
    # Supprimer le composant dans l'emplacement personnalisé ou par défaut
    if ($customInstallPath) {
        Write-Log "Suppression du composant $componentName ($ComponentId) depuis l'emplacement: $customInstallPath" -Level "INFO"
        try {
            Remove-Item -Path $customInstallPath -Recurse -Force
            Write-Log "Désinstallation de l'emplacement personnalisé réussie" -Level "SUCCESS"
            
            # CORRECTION: Vérifier si les dossiers parents sont vides et peuvent être supprimés
            # Sans le 'app' en double
            $componentsDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Custom", "MarketPlace", "Components")
            if (Test-Path -Path $componentsDir -PathType Container) {
                $remainingItems = Get-ChildItem -Path $componentsDir -ErrorAction SilentlyContinue
                if ($remainingItems -eq $null -or $remainingItems.Count -eq 0) {
                    Write-Log "Le répertoire Components est maintenant vide, tentative de suppression..." -Level "INFO"
                    try {
                        Remove-Item -Path $componentsDir -Force
                        Write-Log "Répertoire Components supprimé" -Level "SUCCESS"
                        
                        # CORRECTION: Vérifier si MarketPlace est également vide
                        # Sans le 'app' en double
                        $marketPlaceDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Custom", "MarketPlace")
                        $remainingItems = Get-ChildItem -Path $marketPlaceDir -ErrorAction SilentlyContinue
                        if ($remainingItems -eq $null -or $remainingItems.Count -eq 0) {
                            Write-Log "Le répertoire MarketPlace est maintenant vide, tentative de suppression..." -Level "INFO"
                            try {
                                Remove-Item -Path $marketPlaceDir -Force
                                Write-Log "Répertoire MarketPlace supprimé" -Level "SUCCESS"
                            }
                            catch {
                                Write-Log "Impossible de supprimer le répertoire MarketPlace vide: $($_.Exception.Message)" -Level "WARNING"
                            }
                        }
                    }
                    catch {
                        Write-Log "Impossible de supprimer le répertoire Components vide: $($_.Exception.Message)" -Level "WARNING"
                    }
                }
            }
        }
        catch {
            Write-Log "Erreur lors de la suppression du composant (emplacement personnalisé): $($_.Exception.Message)" -Level "ERROR"
            exit 1
        }
    }
    
    # Vérifier les fichiers de configuration ou les références externes à nettoyer
    Write-Log "Nettoyage des références externes (si applicable)" -Level "INFO"
    
    # Exemple: supprimer une entrée de configuration si elle existe
    $configPath = [System.IO.Path]::Combine($ProcessStudioRoot, "Config", "components.json")
    if (Test-Path -Path $configPath -PathType Leaf) {
        try {
            $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
            $newConfig = $config | Where-Object { $_.id -ne $ComponentId }
            
            # Sauvegarder uniquement si la configuration a changé
            if (($config | ConvertTo-Json) -ne ($newConfig | ConvertTo-Json)) {
                $newConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath
                Write-Log "Configuration mise à jour: entrée du composant supprimée" -Level "SUCCESS"
            }
        }
        catch {
            Write-Log "Erreur lors de la mise à jour de la configuration: $($_.Exception.Message)" -Level "WARNING"
        }
    }
    
    # Désinstallation terminée
    Write-Log "Désinstallation du composant $componentName (ID: $ComponentId) terminée avec succès!" -Level "SUCCESS"
    Write-Log "Une sauvegarde a été créée dans: $backupDir" -Level "INFO"
    exit 0
}
catch {
    Write-Log "Erreur non gérée: $($_.Exception.Message)" -Level "ERROR"
    Write-Log "Détails: $($_.Exception.StackTrace)" -Level "ERROR"
    exit 1
}