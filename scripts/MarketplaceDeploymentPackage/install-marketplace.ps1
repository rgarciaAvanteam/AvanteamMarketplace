<#
.SYNOPSIS
    Script d'installation du Marketplace Avanteam
    
.DESCRIPTION
    Ce script installe le module client Marketplace dans app/Custom/MarketPlace
    et l'API locale d'installation dans root/api-installer avec des droits administratifs
    
.PARAMETER RootPath
    Chemin du répertoire racine (Root) de l'application (défaut: C:\inetpub\wwwroot)
    
.PARAMETER AppPath
    Chemin du répertoire de l'application (app) (défaut: C:\inetpub\wwwroot\app)
    
.PARAMETER ApiUrl
    URL de l'API centrale du Marketplace 
    (défaut: https://marketplace-dev.avanteam-online.com/api/marketplace)
    
.PARAMETER WebsiteName
    Nom du site web IIS (défaut: Default Web Site)
    
.PARAMETER Force
    Installer même si les vérifications préalables échouent (utiliser avec précaution)
    
.EXAMPLE
    # Installation avec les paramètres par défaut
    .\install-marketplace.ps1
    
.EXAMPLE
    # Installation avec des chemins personnalisés
    .\install-marketplace.ps1 -RootPath "D:\inetpub\site1" -AppPath "D:\inetpub\site1\app"
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$RootPath = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AppPath = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "https://marketplace-dev.avanteam-online.com/api/marketplace",
    
    [Parameter(Mandatory=$false)]
    [string]$WebsiteName = "Default Web Site",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "==== $Text ====" -ForegroundColor Cyan
}

function Confirm-Continue {
    param([string]$Message)
    if (-not $Force) {
        $response = Read-Host "$Message (O/N)"
        return ($response -eq "O" -or $response -eq "o")
    }
    return $true
}

# Vérifier que le script est exécuté en tant qu'administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ATTENTION: Ce script doit être exécuté en tant qu'administrateur pour fonctionner correctement." -ForegroundColor Red
    Write-Host "Veuillez relancer le script avec des droits d'administrateur." -ForegroundColor Red
    
    if (-not (Confirm-Continue "Voulez-vous continuer malgré tout? (non recommandé)")) {
        exit 1
    }
}

Write-Title "Installation du Marketplace Avanteam"
Write-Host "Ce script va installer le module client Marketplace et l'API locale d'installation selon une structure spécifique."

# Demander les chemins si non spécifiés
if ([string]::IsNullOrEmpty($RootPath)) {
    Write-Host ""
    $RootPath = Read-Host "Veuillez entrer le chemin du répertoire root (où sera installé api-installer)"
    
    if ([string]::IsNullOrEmpty($RootPath)) {
        Write-Host "Erreur: Le chemin root est requis." -ForegroundColor Red
        exit 1
    }
}

if ([string]::IsNullOrEmpty($AppPath)) {
    Write-Host ""
    $AppPath = Read-Host "Veuillez entrer le chemin du répertoire app (où sera installé le client Marketplace)"
    
    if ([string]::IsNullOrEmpty($AppPath)) {
        Write-Host "Erreur: Le chemin app est requis." -ForegroundColor Red
        exit 1
    }
}

# Vérifier que les répertoires existent
if (-not (Test-Path $RootPath)) {
    Write-Host "Erreur: Le répertoire root n'existe pas: $RootPath" -ForegroundColor Red
    if (-not (Confirm-Continue "Le répertoire root spécifié n'existe pas. Voulez-vous continuer et le créer?")) {
        exit 1
    }
    New-Item -ItemType Directory -Path $RootPath -Force | Out-Null
    Write-Host "Répertoire root créé: $RootPath" -ForegroundColor Green
}

if (-not (Test-Path $AppPath)) {
    Write-Host "Erreur: Le répertoire app n'existe pas: $AppPath" -ForegroundColor Red
    if (-not (Confirm-Continue "Le répertoire app spécifié n'existe pas. Voulez-vous continuer et le créer?")) {
        exit 1
    }
    New-Item -ItemType Directory -Path $AppPath -Force | Out-Null
    Write-Host "Répertoire app créé: $AppPath" -ForegroundColor Green
}

# Vérifier si le module WebAdministration est disponible
if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Write-Host "Avertissement: Le module WebAdministration n'est pas disponible." -ForegroundColor Yellow
    Write-Host "La configuration IIS automatique ne sera pas possible." -ForegroundColor Yellow
    $iisConfigEnabled = $false
    
    if (-not (Confirm-Continue "Continuer sans configuration IIS automatique?")) {
        Write-Host "Installation annulée. Veuillez installer les outils de gestion IIS et réessayer." -ForegroundColor Red
        exit 1
    }
} else {
    $iisConfigEnabled = $true
    Import-Module WebAdministration
}

# Vérifier la présence du module ASP.NET Core pour IIS
if ($iisConfigEnabled) {
    $aspNetCoreModule = Get-WebConfiguration -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/globalModules" | 
                        Select-Object -ExpandProperty collection | 
                        Where-Object { $_.name -like "AspNetCoreModuleV2" }
    
    if (-not $aspNetCoreModule) {
        Write-Host "Avertissement: Module ASP.NET Core pour IIS non détecté" -ForegroundColor Yellow
        Write-Host "L'API locale d'installation pourrait ne pas fonctionner correctement." -ForegroundColor Yellow
        Write-Host "Veuillez installer le .NET Core Hosting Bundle: https://dotnet.microsoft.com/download/dotnet/6.0 (section Hosting Bundle)" -ForegroundColor Yellow
        
        if (-not (Confirm-Continue "Continuer sans le module ASP.NET Core pour IIS?")) {
            Write-Host "Installation annulée. Veuillez installer le module ASP.NET Core pour IIS et réessayer." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Module ASP.NET Core pour IIS détecté" -ForegroundColor Green
    }
}

# 1. Installation du module client dans app/Custom/MarketPlace
Write-Title "Installation du module client Marketplace"

# Vérifier/créer le répertoire Custom dans app
$customPath = Join-Path $AppPath "Custom"
if (-not (Test-Path $customPath)) {
    New-Item -ItemType Directory -Path $customPath -Force | Out-Null
    Write-Host "Répertoire Custom créé: $customPath" -ForegroundColor Green
}

# Vérifier/créer le répertoire MarketPlace
$marketplaceDir = Join-Path $customPath "MarketPlace"
if (Test-Path $marketplaceDir) {
    Write-Host "Le répertoire MarketPlace existe déjà: $marketplaceDir" -ForegroundColor Yellow
    
    if (-not (Confirm-Continue "Le module MarketPlace semble déjà installé. Voulez-vous le remplacer?")) {
        exit 1
    }
} else {
    New-Item -ItemType Directory -Path $marketplaceDir -Force | Out-Null
    Write-Host "Répertoire MarketPlace créé: $marketplaceDir" -ForegroundColor Green
}

# Copier les fichiers du module client
Write-Host "Copie des fichiers du module client dans $marketplaceDir..."
Copy-Item -Path ".\ClientModule\*" -Destination $marketplaceDir -Recurse -Force

# Configurer le Web.config du client avec l'URL de l'API
$webConfigPath = Join-Path $marketplaceDir "Web.config"
if (Test-Path $webConfigPath) {
    Write-Host "Configuration de l'URL de l'API dans Web.config..."
    
    try {
        [xml]$webConfig = Get-Content $webConfigPath
        
        # Mettre à jour l'URL de l'API
        $apiUrlNode = $webConfig.configuration.appSettings.add | Where-Object { $_.key -eq "MarketplaceApiUrl" }
        if ($apiUrlNode -ne $null) {
            $apiUrlNode.value = $ApiUrl
            Write-Host "  URL de l'API mise à jour: $ApiUrl" -ForegroundColor Green
        } else {
            $newNode = $webConfig.CreateElement("add")
            $newNode.SetAttribute("key", "MarketplaceApiUrl")
            $newNode.SetAttribute("value", $ApiUrl)
            $webConfig.configuration.appSettings.AppendChild($newNode) | Out-Null
            Write-Host "  URL de l'API ajoutée: $ApiUrl" -ForegroundColor Green
        }
        
        $webConfig.Save($webConfigPath)
    } catch {
        Write-Host "Erreur lors de la configuration du Web.config: $_" -ForegroundColor Red
    }
}

# Configurer le Web.config pour la clé API (sera fournie par l'administrateur Avanteam)
$webConfigPath = Join-Path $marketplaceDir "Web.config"
if (Test-Path $webConfigPath) {
    try {
        [xml]$webConfig = Get-Content $webConfigPath
        
        # Vérifier si la clé MarketplaceApiKey existe déjà
        $apiKeyNode = $webConfig.configuration.appSettings.add | Where-Object { $_.key -eq "MarketplaceApiKey" }
        if ($apiKeyNode -ne $null) {
            # Réinitialiser la valeur (vide) en attendant la clé de l'administrateur Avanteam
            $apiKeyNode.value = ""
            Write-Host "  Entrée MarketplaceApiKey vidée en attente de la clé d'administrateur." -ForegroundColor Yellow
        } else {
            # Créer un nouvel élément si nécessaire
            $newNode = $webConfig.CreateElement("add")
            $newNode.SetAttribute("key", "MarketplaceApiKey")
            $newNode.SetAttribute("value", "")
            $webConfig.configuration.appSettings.AppendChild($newNode) | Out-Null
            Write-Host "  Entrée MarketplaceApiKey créée." -ForegroundColor Green
        }
        
        $webConfig.Save($webConfigPath)
    } catch {
        Write-Host "Erreur lors de la configuration du Web.config pour la clé API: $_" -ForegroundColor Red
    }
}

# 2. Installation de l'API locale d'installation dans root/api-installer
Write-Title "Installation de l'API locale d'installation"

# Vérifier/créer le répertoire api-installer dans root
$apiInstallerDir = Join-Path $RootPath "api-installer"
if (Test-Path $apiInstallerDir) {
    Write-Host "Le répertoire api-installer existe déjà: $apiInstallerDir" -ForegroundColor Yellow
    
    if (-not (Confirm-Continue "L'API locale semble déjà installée. Voulez-vous la remplacer?")) {
        exit 1
    }
    
    # Nettoyer le répertoire existant
    Remove-Item -Path "$apiInstallerDir\*" -Recurse -Force
    Write-Host "Contenu du répertoire api-installer nettoyé" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path $apiInstallerDir -Force | Out-Null
    Write-Host "Répertoire api-installer créé: $apiInstallerDir" -ForegroundColor Green
}

# Créer le répertoire logs
$logsDir = Join-Path $apiInstallerDir "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Write-Host "Répertoire logs créé: $logsDir" -ForegroundColor Green
}

# Copier les fichiers de l'API locale
Write-Host "Copie des fichiers de l'API locale dans $apiInstallerDir..."
Copy-Item -Path ".\LocalInstaller\*" -Destination $apiInstallerDir -Recurse -Force

# Créer le web.config pour l'API locale
$webConfigPath1 = Join-Path $apiInstallerDir "web.config"
$webConfigContent = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.LocalInstaller.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="outofprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>
"@
Set-Content -Path $webConfigPath1 -Value $webConfigContent
Write-Host "Fichier web.config créé pour l'API locale" -ForegroundColor Green

# 3. Configuration IIS
if ($iisConfigEnabled) {
    Write-Title "Configuration IIS"
    
    # Vérifier si le site web existe
    $siteExists = Get-Website | Where-Object { $_.Name -eq $WebsiteName }
    if (-not $siteExists) {
        Write-Host "Le site web '$WebsiteName' n'existe pas dans IIS" -ForegroundColor Yellow
        $WebsiteName = Read-Host "Veuillez entrer le nom du site web IIS existant"
        
        $siteExists = Get-Website | Where-Object { $_.Name -eq $WebsiteName }
        if (-not $siteExists) {
            Write-Host "Erreur: Le site web '$WebsiteName' n'existe pas dans IIS" -ForegroundColor Red
            
            if (-not (Confirm-Continue "Voulez-vous continuer sans configurer IIS?")) {
                exit 1
            }
            
            $iisConfigEnabled = $false
        }
    }
    
    if ($iisConfigEnabled) {
        # Créer le pool d'applications pour api-installer avec des droits élevés
        $apiInstallerAppPoolName = "api-installer"
        $apiInstallerAppPoolExists = Test-Path "IIS:\AppPools\$apiInstallerAppPoolName"
        
        if ($apiInstallerAppPoolExists) {
            Write-Host "Le pool d'applications api-installer existe déjà." -ForegroundColor Yellow
            if (Confirm-Continue "Voulez-vous reconfigurer le pool d'applications existant?") {
                Stop-WebAppPool -Name $apiInstallerAppPoolName
            }
        } else {
            Write-Host "Création du pool d'applications api-installer..."
            New-WebAppPool -Name $apiInstallerAppPoolName
        }
        
        # Configurer le pool d'applications api-installer
        Write-Host "Configuration du pool d'applications api-installer avec des privilèges élevés..."
        Set-ItemProperty -Path "IIS:\AppPools\$apiInstallerAppPoolName" -Name "managedRuntimeVersion" -Value ""
        Set-ItemProperty -Path "IIS:\AppPools\$apiInstallerAppPoolName" -Name "managedPipelineMode" -Value "Integrated"
        Set-ItemProperty -Path "IIS:\AppPools\$apiInstallerAppPoolName" -Name "enable32BitAppOnWin64" -Value $false
        
        # Configuration très importante: définir l'identité comme LocalSystem pour avoir des droits admin complets
        # LocalSystem est le niveau de privilège le plus élevé et permet d'effectuer des opérations administratives
        Set-ItemProperty -Path "IIS:\AppPools\$apiInstallerAppPoolName" -Name "processModel.identityType" -Value 0
        Write-Host "  Pool d'applications configuré en mode LocalSystem pour les privilèges administratifs" -ForegroundColor Green
        
        # Vérifier si l'application api-installer existe
        $apiInstallerAppExists = Get-WebApplication -Site $WebsiteName -Name "api-installer"
        
        if ($apiInstallerAppExists) {
            Write-Host "L'application 'api-installer' existe déjà" -ForegroundColor Yellow
            if (Confirm-Continue "Voulez-vous reconfigurer l'application existante?") {
                Remove-WebApplication -Site $WebsiteName -Name "api-installer"
                $apiInstallerAppExists = $false
            }
        }
        
        if (-not $apiInstallerAppExists) {
            # Créer l'application api-installer
            Write-Host "Création de l'application 'api-installer' dans IIS..."
            New-WebApplication -Site $WebsiteName -Name "api-installer" -PhysicalPath $apiInstallerDir -ApplicationPool $apiInstallerAppPoolName -Force
            Write-Host "Application 'api-installer' créée dans le site '$WebsiteName'" -ForegroundColor Green
        }
        
        # Note: Nous ne créons pas explicitement les applications app/Custom et app/Custom/MarketPlace
        # car elles sont déjà incluses dans l'application app existante
        Write-Host "Les fichiers du module MarketPlace sont installés dans $marketplaceDir" -ForegroundColor Green
        Write-Host "Ces fichiers sont accessibles via l'application 'app' existante" -ForegroundColor Green
        
        # Configurer les permissions
        # 1. Pour api-installer (droits complets)
        # Note: avec LocalSystem, le pool a déjà tous les droits, mais configurons quand même explicitement
        $apiInstallerUser = "IIS AppPool\$apiInstallerAppPoolName"
        $acl = Get-Acl $apiInstallerDir
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($apiInstallerUser, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
        $acl.SetAccessRule($accessRule)
        $acl | Set-Acl $apiInstallerDir
        Write-Host "Permissions complètes accordées à $apiInstallerUser sur $apiInstallerDir" -ForegroundColor Green
        
        # Accorder également des droits élevés sur le dossier root et app pour permettre les opérations d'installation
        $acl = Get-Acl $RootPath
        $acl.SetAccessRule($accessRule)
        $acl | Set-Acl $RootPath
        
        $acl = Get-Acl $AppPath
        $acl.SetAccessRule($accessRule)
        $acl | Set-Acl $AppPath
        Write-Host "Permissions complètes accordées à $apiInstallerUser sur les répertoires root et app" -ForegroundColor Green
        
        # 2. Pour le module client MarketPlace
        # Identifier le pool d'application de l'app
        # Note: Nous utilisons GetWebApplication pour obtenir le pool d'applications associé à "app"
        $appApplication = Get-WebApplication -Site $WebsiteName -Name "app"
        if ($appApplication) {
            $appAppPoolName = $appApplication.applicationPool
            $appUser = "IIS AppPool\$appAppPoolName"
            $acl = Get-Acl $marketplaceDir
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($appUser, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
            $acl.SetAccessRule($accessRule)
            $acl | Set-Acl $marketplaceDir
            Write-Host "Permissions accordées à $appUser sur $marketplaceDir" -ForegroundColor Green
        } else {
            Write-Host "L'application 'app' n'a pas été trouvée. Assurez-vous que l'application est correctement configurée dans IIS." -ForegroundColor Yellow
        }
        
        # Redémarrer les pools d'applications
        if (Confirm-Continue "Voulez-vous recycler les pools d'applications IIS maintenant?") {
            # Démarrer ou redémarrer le pool api-installer
            if ((Get-WebAppPoolState -Name $apiInstallerAppPoolName).Value -eq "Stopped") {
                Start-WebAppPool -Name $apiInstallerAppPoolName
                Write-Host "Pool d'applications $apiInstallerAppPoolName démarré" -ForegroundColor Green
            } else {
                Restart-WebAppPool -Name $apiInstallerAppPoolName
                Write-Host "Pool d'applications $apiInstallerAppPoolName redémarré" -ForegroundColor Green
            }
            
            # Redémarrer le pool de l'application app si on l'a trouvé
            if ($appApplication) {
                Restart-WebAppPool -Name $appAppPoolName
                Write-Host "Pool d'applications $appAppPoolName redémarré" -ForegroundColor Green
            }
        }
    }
}

# Installation terminée
Write-Title "Installation terminée avec succès!"

Write-Host @"

Le Marketplace Avanteam a été installé avec succès!

Résumé de l'installation:
- Module client: $marketplaceDir
- API locale d'installation: $apiInstallerDir
  Note: L'API locale d'installation est configurée avec des privilèges élevés (LocalSystem)
        pour permettre les opérations d'installation de composants.

URLs d'accès:
- Interface utilisateur: http://votre-serveur/app/Custom/MarketPlace/Default.aspx
- API locale (statut): http://votre-serveur/api-installer/status

IMPORTANT - ÉTAPES SUIVANTES:
1. Récupérez une clé API auprès de l'administrateur Avanteam du Marketplace
2. Configurez cette clé dans le fichier Web.config du module client:
   $webConfigPath
3. Tester l'accès à l'interface utilisateur et à l'API locale

"@ -ForegroundColor Cyan

Write-Host @"
Configuration de la clé API:
Pour configurer la clé API après l'avoir obtenue de l'administrateur Avanteam:

1. Ouvrez le fichier Web.config: $webConfigPath
2. Trouvez la ligne: <add key="MarketplaceApiKey" value="" />
3. Remplacez la valeur vide par la clé API fournie par Avanteam
4. Sauvegardez le fichier

La clé API est nécessaire pour que votre instance puisse s'authentifier auprès 
du Marketplace central et télécharger/installer des composants.
"@ -ForegroundColor Yellow
