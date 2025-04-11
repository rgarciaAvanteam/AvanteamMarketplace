param (
    [Parameter(Mandatory=$true)]
    [string]$ProcessStudioRoot,
    
    [Parameter(Mandatory=$false)]
    [string]$ComponentId,
    
    [Parameter(Mandatory=$false)]
    [string]$Version
)

# Afficher des informations de démarrage
Write-Host "Installation du composant: $ComponentId v$Version"
Write-Host "Répertoire racine: $ProcessStudioRoot"

# Définir les chemins possibles vers FormularDesigner.xml
$possiblePaths = @(
    (Join-Path -Path $ProcessStudioRoot -ChildPath "FormularDesigner.xml"),
    (Join-Path -Path $ProcessStudioRoot -ChildPath "Custom\FormularDesigner.xml"),
    (Join-Path -Path $ProcessStudioRoot -ChildPath "Configuration\FormularDesigner.xml")
)

# Vérifier tous les chemins possibles
$xmlFilePath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path -Path $path) {
        $xmlFilePath = $path
        Write-Host "Fichier FormularDesigner.xml trouvé: $xmlFilePath"
        break
    }
}

# Vérifier si le fichier a été trouvé
if (-not $xmlFilePath) {
    Write-Host "ERREUR: Fichier FormularDesigner.xml introuvable dans les emplacements vérifiés:"
    foreach ($path in $possiblePaths) {
        Write-Host "- $path"
    }
    exit 1
}

# Créer une sauvegarde
$backupPath = "$xmlFilePath.install.bak"
Copy-Item -Path $xmlFilePath -Destination $backupPath -Force
Write-Host "Sauvegarde créée: $backupPath"

# Vérifier si la directive existe déjà
$xmlContent = Get-Content -Path $xmlFilePath -Raw
if ($xmlContent -match '<RegisterDirective[^>]*TagName="NomComposant"[^>]*>') {
    Write-Host "La directive pour ce composant existe déjà."
    exit 0
}

# Trouver où insérer la nouvelle directive
$insertPoint = $xmlContent.LastIndexOf('</RegisterDirectives>')
if ($insertPoint -eq -1) {
    Write-Host "ERREUR: Balise </RegisterDirectives> non trouvée."
    exit 1
}

# Créer la nouvelle directive
$newDirective = @"

  <RegisterDirective Assembly="Avanteam.Components.dll" Type="Avanteam.Components.MyComponent" TagName="NomComposant"><![CDATA[(MonComposant)]]></RegisterDirective>
"@

# Insérer la directive
$updatedContent = $xmlContent.Insert($insertPoint, $newDirective)

# Écrire le contenu mis à jour dans le fichier
Set-Content -Path $xmlFilePath -Value $updatedContent

# Vérifier le résultat
if ((Get-Content -Path $xmlFilePath -Raw) -match '<RegisterDirective[^>]*TagName="NomComposant"[^>]*>') {
    Write-Host "Installation terminée avec succès!"
    Write-Host "La directive pour le composant a été ajoutée."
} else {
    Write-Host "ERREUR: L'installation a échoué. La directive n'a pas été correctement ajoutée."
    Write-Host "Restauration de la sauvegarde..."
    Copy-Item -Path $backupPath -Destination $xmlFilePath -Force
    exit 1
}

# Créer un fichier uninstall.ps1 dans le répertoire du composant pour permettre une désinstallation personnalisée
$uninstallScriptPath = Join-Path -Path (Get-Location) -ChildPath "uninstall.ps1"

# Créer le contenu du script de désinstallation
$uninstallContent = @"
param (
    [Parameter(Mandatory=`$true)]
    [string]`$ProcessStudioRoot,
    
    [Parameter(Mandatory=`$true)]
    [string]`$ComponentId
)

# Afficher des informations de démarrage
Write-Host "Désinstallation du composant: `$ComponentId"
Write-Host "Répertoire racine: `$ProcessStudioRoot"

# Définir les chemins possibles vers FormularDesigner.xml
`$possiblePaths = @(
    (Join-Path -Path `$ProcessStudioRoot -ChildPath "FormularDesigner.xml"),
    (Join-Path -Path `$ProcessStudioRoot -ChildPath "Custom\FormularDesigner.xml"),
    (Join-Path -Path `$ProcessStudioRoot -ChildPath "Configuration\FormularDesigner.xml")
)

# Vérifier tous les chemins possibles
`$xmlFilePath = `$null
foreach (`$path in `$possiblePaths) {
    if (Test-Path -Path `$path) {
        `$xmlFilePath = `$path
        Write-Host "Fichier FormularDesigner.xml trouvé: `$xmlFilePath"
        break
    }
}

# Vérifier si le fichier a été trouvé
if (-not `$xmlFilePath) {
    Write-Host "ERREUR: Fichier FormularDesigner.xml introuvable dans les emplacements vérifiés:"
    foreach (`$path in `$possiblePaths) {
        Write-Host "- `$path"
    }
    exit 1
}

# Vérifier si la directive existe
`$xmlContent = Get-Content -Path `$xmlFilePath -Raw
if (-not (`$xmlContent -match '<RegisterDirective[^>]*TagName="NomComposant"[^>]*>')) {
    Write-Host "La directive pour ce composant n'existe pas dans le fichier FormularDesigner.xml."
    exit 0
}

# Créer une sauvegarde
`$backupPath = "`$xmlFilePath.uninstall.bak"
Copy-Item -Path `$xmlFilePath -Destination `$backupPath -Force
Write-Host "Sauvegarde créée: `$backupPath"

# Supprimer la directive (en utilisant une expression régulière)
`$pattern = '<RegisterDirective[^>]*TagName="NomComposant"[^>]*>(\s*)<!\[CDATA\[\(MonComposant\)\]\]>(\s*)</RegisterDirective>'
`$updatedContent = `$xmlContent -replace `$pattern, ''

# Nettoyer les lignes vides consécutives
`$updatedContent = `$updatedContent -replace '(\r?\n){3,}', "`n`n"

# Écrire le contenu mis à jour dans le fichier
Set-Content -Path `$xmlFilePath -Value `$updatedContent

# Vérifier le résultat
if ((Get-Content -Path `$xmlFilePath -Raw) -match '<RegisterDirective[^>]*TagName="NomComposant"[^>]*>') {
    Write-Host "ERREUR: La désinstallation a échoué. La directive n'a pas été correctement supprimée."
    Write-Host "Restauration de la sauvegarde..."
    Copy-Item -Path `$backupPath -Destination `$xmlFilePath -Force
    exit 1
} else {
    Write-Host "Désinstallation terminée avec succès!"
    Write-Host "La directive pour le composant a été supprimée."
}

# Autres actions de désinstallation personnalisées peuvent être ajoutées ici
# Par exemple, la suppression d'entrées dans la base de données, etc.

Write-Host "Désinstallation personnalisée terminée."

# Si la désinstallation s'est bien passée, renvoyer un code de sortie 0
exit 0
"@

# Écrire le script de désinstallation
Set-Content -Path $uninstallScriptPath -Value $uninstallContent
Write-Host "Script de désinstallation créé: $uninstallScriptPath"

# Autres actions d'installation personnalisées peuvent être ajoutées ici
# Par exemple, l'ajout d'entrées dans la base de données, etc.

Write-Host "Installation personnalisée terminée."

# Si l'installation s'est bien passée, renvoyer un code de sortie 0
exit 0