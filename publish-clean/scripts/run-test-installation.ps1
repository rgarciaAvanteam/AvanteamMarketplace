# Création d'un test d'installation
Write-Host "Création d'un test d'installation..." -ForegroundColor Cyan

# Créer un fichier de test qui servira de package fictif
$testPackageDir = Join-Path $env:TEMP "AvanteamMarketplaceTest"
$testPackageFile = Join-Path $testPackageDir "test-component.zip"
$testManifest = @"
{
    "name": "test-component",
    "displayName": "Composant de test",
    "version": "1.0.0",
    "author": "Avanteam",
    "description": "Composant de test pour vérifier l'installation",
    "category": "Test",
    "installation": {
        "targetPath": "Components/test-component"
    }
}
"@

# Créer un script d'installation personnalisé
$testInstallScript = @"
param (
    [Parameter(Mandatory=`$true)]
    [string]`$ProcessStudioRoot,
    
    [Parameter(Mandatory=`$false)]
    [string]`$ComponentId = "",
    
    [Parameter(Mandatory=`$false)]
    [string]`$Version = ""
)

Write-Host "Script d'installation personnalisé démarré"
Write-Host "ProcessStudioRoot: `$ProcessStudioRoot"
Write-Host "ComponentId: `$ComponentId"
Write-Host "Version: `$Version"

# Créer un fichier de test supplémentaire
`$testFile = Join-Path `$ProcessStudioRoot "Components/test-component/custom-script-file.txt"
Set-Content -Path `$testFile -Value "Ce fichier a été créé par le script d'installation personnalisé."

Write-Host "Fichier de test créé: `$testFile"
Write-Host "Script d'installation personnalisé terminé avec succès"

return `$true
"@

# Créer le répertoire temporaire
if (-not (Test-Path $testPackageDir)) {
    New-Item -ItemType Directory -Path $testPackageDir -Force | Out-Null
}

# Créer un répertoire pour le contenu du ZIP
$contentDir = Join-Path $testPackageDir "content"
if (Test-Path $contentDir) {
    Remove-Item -Path $contentDir -Recurse -Force
}
New-Item -ItemType Directory -Path $contentDir -Force | Out-Null

# Créer le fichier manifest.json
Set-Content -Path (Join-Path $contentDir "manifest.json") -Value $testManifest -Encoding UTF8

# Créer le script d'installation personnalisé
Set-Content -Path (Join-Path $contentDir "install.ps1") -Value $testInstallScript -Encoding UTF8

# Créer un fichier de test
Set-Content -Path (Join-Path $contentDir "test-file.txt") -Value "Ceci est un fichier de test" -Encoding UTF8

# Créer un dossier src
$srcDir = Join-Path $contentDir "src"
New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
Set-Content -Path (Join-Path $srcDir "component.js") -Value "console.log('Composant de test');" -Encoding UTF8
Set-Content -Path (Join-Path $srcDir "component.css") -Value ".test-component { color: blue; }" -Encoding UTF8

# Créer des sous-répertoires pour tester la copie récursive
$subDir = Join-Path $srcDir "sub-directory"
New-Item -ItemType Directory -Path $subDir -Force | Out-Null
Set-Content -Path (Join-Path $subDir "sub-file.js") -Value "console.log('Fichier dans sous-répertoire');" -Encoding UTF8

# Créer le ZIP
if (Test-Path $testPackageFile) {
    Remove-Item -Path $testPackageFile -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($contentDir, $testPackageFile)

Write-Host "Package de test créé: $testPackageFile" -ForegroundColor Green
Write-Host "Structure du package:"
Write-Host "- manifest.json"
Write-Host "- install.ps1 (script personnalisé)"
Write-Host "- test-file.txt"
Write-Host "- src/"
Write-Host "  - component.js"
Write-Host "  - component.css"
Write-Host "  - sub-directory/"
Write-Host "    - sub-file.js"

# Obtenir le répertoire parent du script (où se trouve ce script)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Déterminer le ProcessStudioRoot (la racine du site web)
# Dans votre cas, c'est 2 niveaux au-dessus de notre script
# Si le script est dans app/Custom/MarketPlace/scripts,
# alors ProcessStudioRoot est app/
$appRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))
Write-Host "Répertoire racine détecté: $appRoot" -ForegroundColor Cyan

# Exécuter le script d'installation
$installScript = Join-Path $scriptDir "install-component.ps1"

Write-Host ""
Write-Host "Exécution du script d'installation..." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan
Write-Host "ProcessStudioRoot: $appRoot" -ForegroundColor Cyan
Write-Host "TargetPath du manifest: Components/test-component" -ForegroundColor Cyan
Write-Host "Chemin d'installation attendu: $(Join-Path $appRoot "Components/test-component")" -ForegroundColor Cyan

# Paramètres pour test local (simuler ou non l'environnement réel)
$useRealRoot = $true  # Changer à $false pour utiliser un environnement de test isolé

if ($useRealRoot) {
    # Utiliser le vrai répertoire racine (ATTENTION: cela modifiera votre environnement réel)
    $testProcessStudioRoot = $appRoot
} else {
    # Utiliser un répertoire de test isolé (plus sûr pour les tests)
    $testProcessStudioRoot = Join-Path $testPackageDir "WebRoot"
    if (-not (Test-Path $testProcessStudioRoot)) {
        New-Item -ItemType Directory -Path $testProcessStudioRoot -Force | Out-Null
    }
}

# Exécuter le script
& $installScript -ComponentPackageUrl "file:///$testPackageFile" -ComponentId "test-component" -Version "1.0.0" -ProcessStudioRoot $testProcessStudioRoot

Write-Host ""
Write-Host "Test terminé!" -ForegroundColor Green
Write-Host "Vérification de l'installation:"

# Vérifier les fichiers installés
$installedPath = Join-Path $testProcessStudioRoot "Components/test-component"
if (Test-Path $installedPath) {
    Write-Host "Répertoire d'installation créé: $installedPath" -ForegroundColor Green
    
    $installedFiles = Get-ChildItem -Path $installedPath -Recurse | Select-Object -ExpandProperty FullName
    Write-Host "Fichiers installés ($($installedFiles.Count)):" -ForegroundColor Green
    foreach ($file in $installedFiles) {
        Write-Host "  - $file" -ForegroundColor White
    }
    
    $customScriptFile = Join-Path $installedPath "custom-script-file.txt"
    if (Test-Path $customScriptFile) {
        Write-Host "Fichier créé par le script personnalisé trouvé: $customScriptFile" -ForegroundColor Green
        $content = Get-Content -Path $customScriptFile -Raw
        Write-Host "Contenu: $content" -ForegroundColor White
    } else {
        Write-Host "ERREUR: Fichier du script personnalisé non trouvé: $customScriptFile" -ForegroundColor Red
    }
} else {
    Write-Host "ERREUR: Répertoire d'installation non trouvé: $installedPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "Vérifiez le dossier Logs pour les résultats détaillés." -ForegroundColor Cyan