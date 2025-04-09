<#
.SYNOPSIS
    Script de déploiement de l'API Avanteam Marketplace sur IIS
    
.DESCRIPTION
    Ce script publie et déploie l'API Avanteam Marketplace sur IIS.
    Il configure la base de données, le site web, les certificats et les droits d'accès.
    Inclut la configuration de l'interface d'administration et la documentation Swagger améliorée.
    
.PARAMETER SiteName
    Nom du site web IIS (défaut: AvanteamMarketplaceAPI)
    
.PARAMETER PhysicalPath
    Chemin physique d'installation (défaut: C:\inetpub\wwwroot\AvanteamMarketplaceAPI)
    
.PARAMETER Port
    Port du site web (défaut: 443)
    
.PARAMETER SqlServer
    Nom du serveur SQL Server (défaut: localhost)
    
.PARAMETER SqlDatabase
    Nom de la base de données (défaut: AvanteamMarketplace)
    
.PARAMETER SqlUser
    Utilisateur SQL Server (défaut: utilise l'authentification Windows)
    
.PARAMETER SqlPassword
    Mot de passe SQL Server (défaut: vide)
    
.PARAMETER CertThumbprint
    Empreinte du certificat SSL (optionnel)

.PARAMETER AdminKey
    Clé d'administration pour l'API (si non spécifiée, une clé aléatoire sera générée)

.PARAMETER GithubPAT
    Token d'accès personnel GitHub pour l'intégration des composants

.PARAMETER UseDebugConfig
    Active le mode Debug pour le déploiement (compilation en mode Debug au lieu de Release)
    
.EXAMPLE
    # Déploiement en production
    .\DeployApiToIIS.ps1 -SqlServer "SQL-PROD" -SqlDatabase "AvanteamMarketplaceDB" -CertThumbprint "ABC123DEF456GHI789" -AdminKey "votre-clé-admin" -GithubPAT "ghp_votre_token_github"

.EXAMPLE
    # Déploiement en mode Debug pour développement/tests
    .\DeployApiToIIS.ps1 -SqlServer "SQL-DEV" -SqlDatabase "AvanteamMarketplaceDB" -UseDebugConfig
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$SiteName = "marketplace-dev.avanteam-online.com",
    
    [Parameter(Mandatory=$false)]
    [string]$PhysicalPath = "C:\inetpub\wwwroot\marketplace-dev",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 443,
    
    [Parameter(Mandatory=$false)]
    [string]$HostHeader = "marketplace-dev.avanteam-online.com",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServer = "localhost",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlDatabase = "AvanteamMarketplace",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlUser = "",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlPassword = "",
    
    [Parameter(Mandatory=$false)]
    [string]$CertThumbprint = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminKey = "",
    
    [Parameter(Mandatory=$false)]
    [string]$GithubPAT = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiBaseUrl = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$UseDebugConfig = $false
)

# Vérifier que le script est exécuté en tant qu'administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Ce script doit être exécuté en tant qu'administrateur."
    exit 1
}

# Vérifier que le module WebAdministration est disponible
if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Write-Error "Le module WebAdministration n'est pas disponible. Assurez-vous que IIS est installé avec les outils de gestion."
    exit 1
}

# Chemin source (dossier actuel)
$sourcePath = $PSScriptRoot
Write-Host "Déploiement depuis: $sourcePath" -ForegroundColor Cyan

# Étape 1: Publier l'API
Write-Host "`n[1/7] Publication de l'API..." -ForegroundColor Green

# Vérifier si dotnet est disponible
$dotnetAvailable = $null -ne (Get-Command dotnet -ErrorAction SilentlyContinue)
if (-not $dotnetAvailable) {
    Write-Error "L'outil dotnet n'est pas disponible. Assurez-vous que .NET 7.0 SDK est installé."
    exit 1
}

# Publier le projet API
$publishPath = Join-Path $sourcePath "publish"
if (Test-Path $publishPath) {
    Remove-Item -Path $publishPath -Recurse -Force
}

Write-Host "Restauration des packages NuGet..."
dotnet restore "$sourcePath\AvanteamMarketplace.sln"

# Déterminer la configuration de build
$configuration = if ($UseDebugConfig) { "Debug" } else { "Release" }
Write-Host "Publication du projet API en mode $configuration..."
dotnet publish "$sourcePath\src\AvanteamMarketplace.API\AvanteamMarketplace.API.csproj" -c $configuration -o $publishPath

if (-not (Test-Path $publishPath)) {
    Write-Error "La publication a échoué. Vérifiez les erreurs ci-dessus."
    exit 1
}

# Étape 2: Préparer le répertoire de déploiement
Write-Host "`n[2/7] Préparation du répertoire de déploiement..." -ForegroundColor Green

if (-not (Test-Path $PhysicalPath)) {
    Write-Host "Création du répertoire $PhysicalPath..."
    New-Item -ItemType Directory -Path $PhysicalPath -Force | Out-Null
}
else {
    Write-Host "Le répertoire $PhysicalPath existe déjà. Les fichiers seront remplacés."
    Get-ChildItem -Path $PhysicalPath -Recurse | Remove-Item -Recurse -Force
}

# Copier les fichiers publiés
Write-Host "Copie des fichiers vers $PhysicalPath..."
Copy-Item -Path "$publishPath\*" -Destination $PhysicalPath -Recurse -Force

# Étape 3: Configurer la chaîne de connexion, appliquer les migrations et remplacer les jetons
Write-Host "`n[3/7] Configuration de la base de données et des paramètres de sécurité..." -ForegroundColor Green

$appSettingsPath = Join-Path $PhysicalPath "appsettings.json"
$appSettingsProdPath = Join-Path $PhysicalPath "appsettings.Production.json"

if (-not (Test-Path $appSettingsPath)) {
    Write-Error "Le fichier appsettings.json n'a pas été trouvé dans le répertoire de déploiement."
    exit 1
}

# Construire la chaîne de connexion - format spécifique qui a été testé et fonctionne correctement
# Note: Pour les serveurs nommés type "serveur\instance", assurez-vous d'échapper les backslashes dans le JSON (\\)
if ($SqlServer -match '\\') {
    # Serveur avec instance nommée - format qui a fonctionné: Server=AVT-BP-SQL-REC\\AVT,1433
    $SqlServerEscaped = $SqlServer -replace '\\', '\\\\'
    $connectionString = "Server=$SqlServerEscaped;Database=$SqlDatabase;"
} else {
    # Serveur sans instance nommée ou adresse IP
    $connectionString = "Server=$SqlServer;Database=$SqlDatabase;"
}

if ([string]::IsNullOrEmpty($SqlUser)) {
    $connectionString += "Trusted_Connection=True;"
}
else {
    $connectionString += "User ID=$SqlUser;Password=$SqlPassword;"
}
$connectionString += "MultipleActiveResultSets=true;TrustServerCertificate=True;Encrypt=False"

Write-Host "Chaîne de connexion: $connectionString"

# Mettre à jour le fichier appsettings.json
$json = Get-Content $appSettingsPath -Raw | ConvertFrom-Json
$json.ConnectionStrings.DefaultConnection = $connectionString

# Configurer l'environnement de production
$json | Add-Member -NotePropertyName "Environment" -NotePropertyValue "Production" -Force

# Configurer l'URL de base de l'API si fournie
if (-not [string]::IsNullOrEmpty($ApiBaseUrl)) {
    $json | Add-Member -NotePropertyName "ApiBaseUrl" -NotePropertyValue $ApiBaseUrl -Force
    Write-Host "URL de base de l'API configurée: $ApiBaseUrl"
} else {
    # Utiliser une URL basée sur le HostHeader si non fournie
    $defaultApiBaseUrl = "https://$HostHeader"
    $json | Add-Member -NotePropertyName "ApiBaseUrl" -NotePropertyValue $defaultApiBaseUrl -Force
    Write-Host "URL de base de l'API configurée par défaut: $defaultApiBaseUrl"
}

$json | ConvertTo-Json -Depth 10 | Set-Content $appSettingsPath

# Remplacer les jetons de sécurité dans tous les fichiers appsettings*.json
Write-Host "Remplacement des jetons de sécurité dans les fichiers de configuration..."

# Générer une clé d'administration aléatoire si non spécifiée
if ([string]::IsNullOrEmpty($AdminKey)) {
    $AdminKey = [System.Guid]::NewGuid().ToString()
    Write-Host "Clé d'administration générée: $AdminKey" -ForegroundColor Yellow
    Write-Host "CONSERVEZ CETTE CLÉ EN LIEU SÛR" -ForegroundColor Red
}

# Vérifier si un token GitHub a été fourni
if ([string]::IsNullOrEmpty($GithubPAT)) {
    Write-Warning "Aucun token GitHub n'a été fourni. L'intégration GitHub ne fonctionnera pas sans un token valide."
}

# Remplacer les jetons dans tous les fichiers appsettings*.json
$configFiles = Get-ChildItem -Path $PhysicalPath -Filter "appsettings*.json" -Recurse
foreach ($file in $configFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $content = $content.Replace('#{MARKETPLACE_ADMIN_KEY}#', $AdminKey)
    $content = $content.Replace('#{GITHUB_PAT}#', $GithubPAT)
    Set-Content -Path $file.FullName -Value $content
    Write-Host "Jetons remplacés dans $($file.Name)"
}

# Configurer l'environnement en fonction du mode Debug
if ($UseDebugConfig) {
    Write-Host "Configuration de l'environnement de développement..."
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    
    # Ajouter web.config pour le mode debug - en mode inprocess qui a été testé et fonctionne correctement
    $webConfigContent = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Development" />
          <environmentVariable name="ASPNETCORE_DETAILEDERRORS" value="1" />
        </environmentVariables>
      </aspNetCore>
      <httpErrors errorMode="Detailed" />
    </system.webServer>
  </location>
</configuration>
"@
    $webConfigPath = Join-Path $PhysicalPath "web.config"
    Set-Content -Path $webConfigPath -Value $webConfigContent
    
    # Créer le dossier logs pour les erreurs de démarrage
    $logsPath = Join-Path $PhysicalPath "logs"
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Host "Fichier web.config configuré pour le mode Debug et dossier logs créé"
}
else {
    Write-Host "Configuration de l'environnement de production..."
    $env:ASPNETCORE_ENVIRONMENT = "Production"
    
    # Ajouter web.config pour le mode production - en mode inprocess qui a été testé et fonctionne correctement
    $webConfigContent = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.API.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
        </environmentVariables>
      </aspNetCore>
      <httpErrors errorMode="DetailedLocalOnly" />
    </system.webServer>
  </location>
</configuration>
"@
    $webConfigPath = Join-Path $PhysicalPath "web.config"
    Set-Content -Path $webConfigPath -Value $webConfigContent
    
    # Créer le dossier logs pour les erreurs de démarrage
    $logsPath = Join-Path $PhysicalPath "logs"
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Host "Fichier web.config configuré pour le mode Production et dossier logs créé"
}

# Vérifier que la clé d'administration est bien configurée dans appsettings.json pour l'interface d'admin
try {
    $appSettings = Get-Content $appSettingsPath -Raw | ConvertFrom-Json
    if (-not $appSettings.ApiKeys) {
        $appSettings | Add-Member -NotePropertyName "ApiKeys" -NotePropertyValue @{AdminKey = $AdminKey} -Force
    } else {
        $appSettings.ApiKeys.AdminKey = $AdminKey
    }
    
    $appSettings | ConvertTo-Json -Depth 10 | Set-Content $appSettingsPath
    Write-Host "Clé d'administration configurée dans appsettings.json"
} catch {
    Write-Warning "Erreur lors de la configuration de la clé d'administration dans appsettings.json: $_"
}

# Appliquer les migrations à la base de données
Write-Host "Application des migrations à la base de données..."
try {
    # Vérifier si l'outil dotnet-ef est installé
    $efInstalled = $null -ne (Get-Command dotnet-ef -ErrorAction SilentlyContinue)
    if (-not $efInstalled) {
        Write-Host "Installation de l'outil Entity Framework Core..."
        dotnet tool install --global dotnet-ef
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Impossible d'installer l'outil dotnet-ef. Les migrations seront appliquées au démarrage de l'application."
        }
    }
    
    # Construire la chaîne de connexion pour EF Core
    $efConnectionString = "Server=$SqlServer;Database=$SqlDatabase;"
    if ([string]::IsNullOrEmpty($SqlUser)) {
        $efConnectionString += "Trusted_Connection=True;"
    }
    else {
        $efConnectionString += "User ID=$SqlUser;Password=$SqlPassword;"
    }
    $efConnectionString += "MultipleActiveResultSets=true"
    
    # Chemin vers les projets
    $infrastructureProject = Join-Path $sourcePath "src\AvanteamMarketplace.Infrastructure\AvanteamMarketplace.Infrastructure.csproj"
    $apiProject = Join-Path $sourcePath "src\AvanteamMarketplace.API\AvanteamMarketplace.API.csproj"
    
    # Appliquer les migrations
    if (Test-Path $infrastructureProject) {
        # Navigation vers le répertoire du projet API pour le contexte
        Push-Location (Join-Path $sourcePath "src\AvanteamMarketplace.API")
        
        Write-Host "Exécution de la commande: dotnet ef database update --project $infrastructureProject --connection `"$efConnectionString`""
        dotnet ef database update --project $infrastructureProject --connection "$efConnectionString"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Erreur lors de l'application des migrations. Vérifiez les erreurs ci-dessus."
        }
        else {
            Write-Host "Migrations appliquées avec succès." -ForegroundColor Green
        }
        
        # Revenir au répertoire précédent
        Pop-Location
    }
    else {
        Write-Warning "Projet d'infrastructure non trouvé à $infrastructureProject. Les migrations seront appliquées au démarrage de l'application."
    }
}
catch {
    Write-Warning "Erreur lors de l'application des migrations: $_"
    Write-Warning "Les migrations seront appliquées au démarrage de l'application."
}

# Étape 4: Configurer le pool d'applications IIS
Write-Host "`n[4/7] Configuration du pool d'applications IIS..." -ForegroundColor Green

Import-Module WebAdministration

# Vérifier si le pool d'applications existe
$appPoolName = "$SiteName" + "Pool"
$appPoolExists = Test-Path "IIS:\AppPools\$appPoolName"

if ($appPoolExists) {
    Write-Host "Le pool d'applications $appPoolName existe déjà."
    Write-Host "Arrêt du pool d'applications existant..."
    Stop-WebAppPool -Name $appPoolName
}
else {
    Write-Host "Création du pool d'applications $appPoolName..."
    New-WebAppPool -Name $appPoolName
}

# Configurer le pool d'applications
Write-Host "Configuration du pool d'applications..."
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name "managedPipelineMode" -Value "Integrated"
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name "enable32BitAppOnWin64" -Value $false
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name "autoStart" -Value $true
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name "startMode" -Value "AlwaysRunning"

# Étape 5: Configurer le site web IIS
Write-Host "`n[5/7] Configuration du site web IIS..." -ForegroundColor Green

# Vérifier si le site web existe
$siteExists = Test-Path "IIS:\Sites\$SiteName"

if ($siteExists) {
    Write-Host "Le site web $SiteName existe déjà."
    Write-Host "Arrêt du site web existant..."
    Stop-Website -Name $SiteName
}
else {
    Write-Host "Création du site web $SiteName..."
    New-Website -Name $SiteName -PhysicalPath $PhysicalPath -ApplicationPool $appPoolName -Port $($Port) -HostHeader $($HostHeader) -Force
}

# Configurer le site web
Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "applicationPool" -Value $appPoolName
Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "physicalPath" -Value $PhysicalPath

# Configurer les liaisons
$bindingInfo = "*:$($Port):$($HostHeader)"
Set-WebBinding -Name $SiteName -BindingInformation $bindingInfo -PropertyName Port -Value $Port

# Configurer HTTPS si un certificat est fourni
if (-not [string]::IsNullOrEmpty($CertThumbprint)) {
    Write-Host "Configuration du certificat SSL..."
    
    # Vérifier si le certificat existe
    $cert = Get-Item -Path "cert:\LocalMachine\My\$CertThumbprint" -ErrorAction SilentlyContinue
    if ($cert -eq $null) {
        Write-Error "Le certificat avec l'empreinte $CertThumbprint n'a pas été trouvé."
        exit 1
    }
    
    # Créer une liaison HTTPS
    New-WebBinding -Name $SiteName -Protocol "https" -Port $($Port) -HostHeader $($HostHeader) -IPAddress "*" -SslFlags 0
    
    # Assigner le certificat à la liaison
    $binding = Get-WebBinding -Name $SiteName -Protocol "https" -HostHeader $($HostHeader)
    $binding.AddSslCertificate($CertThumbprint, "my")
}

# Étape 6: Configurer les droits d'accès
Write-Host "`n[6/7] Configuration des droits d'accès..." -ForegroundColor Green

# Donner les droits d'accès complets au pool d'applications
$userName = "IIS AppPool\$appPoolName"
$acl = Get-Acl $PhysicalPath
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($userName, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($accessRule)
$acl | Set-Acl $PhysicalPath

Write-Host "Droits d'accès configurés pour $userName"

# Ajouter également des droits d'accès pour le groupe IIS_IUSRS (nécessaire pour le mode out-of-process)
$iisUsersGroup = "BUILTIN\IIS_IUSRS"
$acl = Get-Acl $PhysicalPath
$iisUsersRule = New-Object System.Security.AccessControl.FileSystemAccessRule($iisUsersGroup, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($iisUsersRule)
$acl | Set-Acl $PhysicalPath

Write-Host "Droits d'accès configurés pour $iisUsersGroup"

# Vérifier la présence du module ASP.NET Core dans IIS
Write-Host "Vérification de la présence du module ASP.NET Core dans IIS..."
try {
    $aspNetCoreModule = Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/globalModules' | 
                        Select-Object -ExpandProperty collection | 
                        Where-Object { $_.name -like 'AspNetCoreModuleV2' }

    if ($aspNetCoreModule) {
        Write-Host "Le module ASP.NET Core V2 est correctement installé." -ForegroundColor Green
    } else {
        Write-Warning "Le module ASP.NET Core V2 n'est pas installé. Veuillez installer le .NET Core Hosting Bundle."
        Write-Warning "Téléchargez-le depuis: https://dotnet.microsoft.com/download/dotnet/7.0/runtime (section Hosting Bundle)"
    }
}
catch {
    Write-Warning "Impossible de vérifier la présence du module ASP.NET Core: $_"
}

# Vérifier la présence du .NET Core Runtime
Write-Host "Vérification de la présence du .NET Core Runtime..."
try {
    $dotnetRuntimes = & dotnet --list-runtimes 2>$null
    $aspNetCoreAppRuntime = $dotnetRuntimes | Where-Object { $_ -like "Microsoft.AspNetCore.App 7.*" }

    if ($aspNetCoreAppRuntime) {
        Write-Host "Le runtime ASP.NET Core 7.x est correctement installé." -ForegroundColor Green
        Write-Host $aspNetCoreAppRuntime
    } else {
        Write-Warning "Le runtime ASP.NET Core 7.x ne semble pas être installé. Veuillez installer le SDK .NET 7.0."
        Write-Warning "Téléchargez-le depuis: https://dotnet.microsoft.com/download/dotnet/7.0"
    }
}
catch {
    Write-Warning "Impossible de vérifier la présence du runtime .NET Core: $_"
}

# Étape 7: Démarrer le site web
Write-Host "`n[7/7] Démarrage du site web..." -ForegroundColor Green

Start-WebAppPool -Name $appPoolName
Start-Website -Name $SiteName

Write-Host "Le pool d'applications et le site web ont été démarrés."

# Vérifier que le site web est en cours d'exécution
$site = Get-Website -Name $SiteName
if ($site.State -eq "Started") {
    Write-Host "`nLe site web $SiteName est en cours d'exécution." -ForegroundColor Green
}
else {
    Write-Warning "Le site web $SiteName n'a pas pu être démarré."
}

# Informations finales
Write-Host "`nDéploiement terminé avec succès!" -ForegroundColor Green
Write-Host "L'API Avanteam Marketplace est maintenant disponible aux adresses suivantes:"

if (-not [string]::IsNullOrEmpty($CertThumbprint) -or $Port -eq 443) {
    Write-Host "Interface d'administration: https://$HostHeader/admin" -ForegroundColor Cyan
    Write-Host "Documentation Swagger: https://$HostHeader/swagger" -ForegroundColor Cyan
}
else {
    Write-Host "Interface d'administration: http://$HostHeader/admin" -ForegroundColor Cyan
    Write-Host "Documentation Swagger: http://$HostHeader/swagger" -ForegroundColor Cyan
}

# Afficher les informations d'API
if (-not [string]::IsNullOrEmpty($AdminKey)) {
    Write-Host "`nClé d'administration de l'API:" -ForegroundColor Yellow
    Write-Host $AdminKey -ForegroundColor Cyan
    Write-Host "IMPORTANT: Conservez cette clé en lieu sûr. Elle est nécessaire pour l'administration du marketplace." -ForegroundColor Yellow
    Write-Host "Utilisez cette clé pour vous connecter à l'interface d'administration." -ForegroundColor Yellow
}

Write-Host "`nPour que les clients Process Studio puissent se connecter à cette API,"
Write-Host "configurez l'URL de l'API dans le fichier Web.config du module client:"

if (-not [string]::IsNullOrEmpty($CertThumbprint) -or $Port -eq 443) {
    Write-Host '<add key="MarketplaceApiUrl" value="https://$HostHeader/api/marketplace" />' -ForegroundColor Yellow
}
else {
    Write-Host '<add key="MarketplaceApiUrl" value="http://$HostHeader/api/marketplace" />' -ForegroundColor Yellow
}

Write-Host "`nUtilisez le script 'generate-api-key.ps1' pour créer des clés API pour chaque installation client." -ForegroundColor Green
Write-Host "Pour ajouter ces clés à l'API, utilisez l'interface d'administration avec la clé d'administration." -ForegroundColor Green