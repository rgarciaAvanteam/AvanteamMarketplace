<#
.SYNOPSIS
    Script pour renommer les fichiers JS et CSS et mettre à jour les références dans le code HTML
    
.DESCRIPTION
    Ce script renomme les fichiers JS et CSS en leur ajoutant un timestamp, puis met à jour les références
    dans les fichiers HTML. Cela force le navigateur à charger les nouvelles versions.
    
.PARAMETER DeploymentPath
    Chemin du déploiement (par défaut: C:\inetpub\wwwroot\marketplace-dev)
    
.EXAMPLE
    .\clear-browser-cache.ps1
    
.EXAMPLE
    .\clear-browser-cache.ps1 -DeploymentPath "C:\inetpub\wwwroot\marketplace-test"
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$DeploymentPath = "C:\inetpub\wwwroot\marketplace-dev"
)

# Dossiers concernés
$jsDir = Join-Path $DeploymentPath "wwwroot\js"
$cssDir = Join-Path $DeploymentPath "wwwroot\css"
$pagesDir = Join-Path $DeploymentPath "Pages"

# Vérifier si les dossiers existent
if (-not (Test-Path $jsDir) -or -not (Test-Path $cssDir)) {
    Write-Error "Les dossiers $jsDir ou $cssDir n'existent pas"
    exit 1
}

# Créer un backup
$backupDir = Join-Path $DeploymentPath "Backup_$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
Write-Host "Backup créé dans $backupDir" -ForegroundColor Green

# Créer un timestamp pour le versioning
$timestamp = Get-Date -Format "yyyyMMddHHmmss"

# Fonction pour modifier le fichier admin.js
function Modify-AdminJs {
    $adminJsPath = Join-Path $jsDir "admin.js"
    if (-not (Test-Path $adminJsPath)) {
        Write-Warning "Le fichier admin.js n'existe pas dans $jsDir"
        return
    }
    
    # Backup du fichier
    Copy-Item -Path $adminJsPath -Destination (Join-Path $backupDir "admin.js") -Force
    
    # Lire le contenu
    $content = Get-Content -Path $adminJsPath -Raw
    
    # Ajouter un commentaire avec le timestamp en haut du fichier
    $newContent = "// Cache buster: version-$timestamp`n" + $content
    
    # Écrire le contenu modifié
    Set-Content -Path $adminJsPath -Value $newContent -Force
    Write-Host "Fichier admin.js modifié avec succès" -ForegroundColor Green
}

# Modifier le fichier admin.js
Modify-AdminJs

# Fonction pour mettre à jour index.cshtml
function Update-IndexCshtml {
    $indexPath = Join-Path $pagesDir "Admin\Index.cshtml"
    if (-not (Test-Path $indexPath)) {
        Write-Warning "Le fichier Index.cshtml n'existe pas dans $pagesDir\Admin"
        return
    }
    
    # Backup du fichier
    Copy-Item -Path $indexPath -Destination (Join-Path $backupDir "Index.cshtml") -Force
    
    # Lire le contenu
    $content = Get-Content -Path $indexPath -Raw
    
    # Remplacer les références aux fichiers CSS et JS pour inclure le timestamp
    $content = $content -replace '<link rel="stylesheet" href="~/css/marketplace.css(\?v=@DateTime\.Now\.Ticks)?" />', '<link rel="stylesheet" href="~/css/marketplace.css?v=@DateTime.Now.Ticks" />'
    $content = $content -replace '<link rel="stylesheet" href="~/css/admin.css(\?v=@DateTime\.Now\.Ticks)?" />', '<link rel="stylesheet" href="~/css/admin.css?v=@DateTime.Now.Ticks" />'
    $content = $content -replace '<script src="~/js/admin.js(\?v=@DateTime\.Now\.Ticks)?" type="text/javascript"></script>', '<script src="~/js/admin.js?v=@DateTime.Now.Ticks" type="text/javascript"></script>'
    
    # Écrire le contenu modifié
    Set-Content -Path $indexPath -Value $content -Force
    Write-Host "Fichier Index.cshtml modifié avec succès" -ForegroundColor Green
}

# Mettre à jour Index.cshtml
Update-IndexCshtml

# Créer un script HTML de test
function Create-TestHtml {
    $testHtmlPath = Join-Path $DeploymentPath "wwwroot\cache-test.html"
    
    $html = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Cache - $timestamp</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
        h1 { color: #0066cc; }
        pre { background: #f5f5f5; padding: 1rem; border-radius: 5px; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>Test Cache - Marketplace</h1>
    <p>Cette page a été générée le <strong>$(Get-Date)</strong> avec le timestamp <code>$timestamp</code>.</p>
    
    <h2>Instructions</h2>
    <ol>
        <li>Si vous voyez cette page, le serveur fonctionne correctement.</li>
        <li>Appuyez sur <kbd>Ctrl+F5</kbd> pour forcer le rechargement complet de la page.</li>
        <li>Vérifiez que le timestamp affiché ci-dessus correspond à l'heure actuelle.</li>
        <li>Retournez à l'application principale et appuyez sur <kbd>Ctrl+F5</kbd> là aussi.</li>
    </ol>
    
    <h2>Liens de test</h2>
    <ul>
        <li><a href="/admin" target="_blank">Administration du Marketplace</a></li>
        <li><a href="/js/admin.js?v=$timestamp" target="_blank">Vérifier admin.js</a></li>
        <li><a href="/css/admin.css?v=$timestamp" target="_blank">Vérifier admin.css</a></li>
    </ul>
    
    <h2>Cache Status</h2>
    <pre id="cache-info">Le cache du navigateur sera analysé via JavaScript...</pre>
    
    <script>
        // Tester l'état du cache du navigateur
        window.addEventListener('load', function() {
            const cacheInfo = document.getElementById('cache-info');
            
            // Vérifier si la page a été chargée depuis le cache
            const pageLoadedFromCache = performance.getEntriesByType('navigation')[0].transferSize === 0;
            
            // Vérifier la date de la dernière mise à jour
            const pageTimestamp = '$timestamp';
            const currentTime = new Date().getTime();
            const pageTime = new Date(parseInt(pageTimestamp.substring(0, 4)), 
                                      parseInt(pageTimestamp.substring(4, 6)) - 1, 
                                      parseInt(pageTimestamp.substring(6, 8)),
                                      parseInt(pageTimestamp.substring(8, 10)),
                                      parseInt(pageTimestamp.substring(10, 12)),
                                      parseInt(pageTimestamp.substring(12, 14))).getTime();
            
            const timeDifference = Math.floor((currentTime - pageTime) / 1000);
            
            let result = '';
            result += 'Chargée depuis le cache: ' + (pageLoadedFromCache ? '<span class="error">Oui</span>' : '<span class="success">Non</span>') + '<br>';
            result += 'Timestamp de la page: ' + pageTimestamp + '<br>';
            result += 'Âge de la page: ' + timeDifference + ' secondes<br>';
            
            // Vérifier les en-têtes de cache pour les ressources clés
            const resources = ['/js/admin.js', '/css/admin.css', '/css/marketplace.css'];
            
            result += '<br><strong>Ressources chargées:</strong><br>';
            
            const resourcePromises = resources.map(resource => {
                return fetch(resource + '?check=' + Math.random(), { method: 'HEAD' })
                    .then(response => {
                        const cacheControl = response.headers.get('cache-control') || 'Non spécifié';
                        return resource + ': ' + cacheControl;
                    })
                    .catch(error => resource + ': Erreur - ' + error.message);
            });
            
            Promise.all(resourcePromises)
                .then(resourceResults => {
                    result += resourceResults.join('<br>');
                    cacheInfo.innerHTML = result;
                });
        });
    </script>
</body>
</html>
"@

    Set-Content -Path $testHtmlPath -Value $html -Force
    Write-Host "Fichier de test HTML créé: $testHtmlPath" -ForegroundColor Green
    Write-Host "URL de test: http://votre-domaine/cache-test.html" -ForegroundColor Cyan
}

# Créer un fichier HTML de test
Create-TestHtml

Write-Host "`nOpérations terminées avec succès !" -ForegroundColor Green
Write-Host "1. Backup créé dans $backupDir" -ForegroundColor Cyan
Write-Host "2. Fichier admin.js modifié avec un marqueur anti-cache" -ForegroundColor Cyan
Write-Host "3. Index.cshtml mis à jour avec des paramètres anti-cache" -ForegroundColor Cyan
Write-Host "4. Fichier de test HTML créé à $DeploymentPath\wwwroot\cache-test.html" -ForegroundColor Cyan
Write-Host "`nActions à réaliser:" -ForegroundColor Yellow
Write-Host "1. Redémarrez le pool d'application IIS (restart-pool.bat)" -ForegroundColor Yellow
Write-Host "2. Effacez le cache de votre navigateur (Ctrl+F5)" -ForegroundColor Yellow
Write-Host "3. Testez l'application pour voir si le problème de cache est résolu" -ForegroundColor Yellow