#
# Script de désinstallation pour les composants Avanteam Marketplace
# Ce script supprime les composants installés par Process Studio
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
    $logMessage = "[$Level] $Message"
    
    # Ajouter des couleurs pour la console
    switch ($Level) {
        "ERROR" { Write-Host -ForegroundColor Red $logMessage }
        "WARNING" { Write-Host -ForegroundColor Yellow $logMessage }
        "SUCCESS" { Write-Host -ForegroundColor Green $logMessage }
        default { Write-Host $logMessage }
    }
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
    
    # Déterminer le dossier du composant
    $componentDir = [System.IO.Path]::Combine($ProcessStudioRoot, "Components", $ComponentId)
    
    # Vérifier si le composant est installé
    if (-not (Test-Path -Path $componentDir -PathType Container)) {
        Write-Log "Le composant $ComponentId n'est pas installé dans: $componentDir" -Level "WARNING"
        exit 0
    }
    
    # Vérifier pour un script de désinstallation personnalisé
    $uninstallScript = [System.IO.Path]::Combine($componentDir, "uninstall.ps1")
    if (Test-Path -Path $uninstallScript -PathType Leaf) {
        Write-Log "Exécution du script de désinstallation personnalisé: $uninstallScript" -Level "INFO"
        try {
            & $uninstallScript -ComponentId $ComponentId -ProcessStudioRoot $ProcessStudioRoot
            
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Le script de désinstallation personnalisé a échoué avec le code: $LASTEXITCODE" -Level "ERROR"
                # Continuer avec la désinstallation normale si le script personnalisé échoue
            }
            else {
                Write-Log "Script de désinstallation personnalisé exécuté avec succès" -Level "SUCCESS"
            }
        }
        catch {
            Write-Log "Erreur lors de l'exécution du script de désinstallation personnalisé: $($_.Exception.Message)" -Level "ERROR"
            # Continuer avec la désinstallation normale si le script personnalisé échoue
        }
    }
    
    # Recherche du fichier manifest.json pour des informations sur le composant
    $manifestPath = [System.IO.Path]::Combine($componentDir, "manifest.json")
    $hasManifest = Test-Path -Path $manifestPath -PathType Leaf
    $componentName = "Composant $ComponentId"
    
    if ($hasManifest) {
        try {
            $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
            if ($manifest.name) {
                $componentName = $manifest.name
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
        Copy-Item -Path $componentDir -Destination $backupDir -Recurse -Force
        Write-Log "Sauvegarde créée avec succès" -Level "SUCCESS"
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
    
    # Supprimer le composant
    Write-Log "Suppression du composant $componentName ($ComponentId) depuis: $componentDir" -Level "INFO"
    try {
        Remove-Item -Path $componentDir -Recurse -Force
        Write-Log "Désinstallation réussie" -Level "SUCCESS"
    }
    catch {
        Write-Log "Erreur lors de la suppression du composant: $($_.Exception.Message)" -Level "ERROR"
        exit 1
    }
    
    # Vérifier les fichiers de configuration ou les références externes à nettoyer
    # Cela dépendrait de la structure spécifique de l'application
    # Par exemple, vous pourriez avoir besoin de supprimer des entrées dans:
    # - Base de données
    # - Fichiers de configuration globaux
    # - Registre Windows
    
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