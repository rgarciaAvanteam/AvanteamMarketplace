# Résolution définitive de l'erreur "HTTP Error 500.34 - ASP.NET Core does not support mixing hosting models"

Cette erreur persiste malgré nos tentatives précédentes avec le `hostingModel="outofprocess"`. Il semble que cela ne soit pas suffisant dans votre environnement IIS. Voici la solution complète et définitive pour résoudre ce problème.

## La solution: Déployer en tant qu'application IIS distincte avec son propre pool d'applications

En créant une application complètement séparée avec son propre pool d'applications, nous évitons complètement le problème de mélange des modèles d'hébergement.

### Étapes détaillées:

1. **Effectuez une publication propre du projet**:
   ```powershell
   dotnet publish -c Release
   ```

2. **Créez un nouveau dossier pour l'application** (à exécuter en tant qu'administrateur):
   ```powershell
   # Créer le dossier s'il n'existe pas déjà
   $installPath = "C:\ProcessStudio\MarketPlaceLocalInstaller"
   if (!(Test-Path $installPath)) {
       New-Item -Path $installPath -ItemType Directory -Force
   }
   
   # Créer un dossier pour les logs
   $logsPath = Join-Path $installPath "logs"
   if (!(Test-Path $logsPath)) {
       New-Item -Path $logsPath -ItemType Directory -Force
   }
   ```

3. **Copiez les fichiers publiés** vers ce nouveau dossier:
   ```powershell
   # Remplacez avec le chemin correct vers votre dossier de publication
   $publishPath = "path\to\your\publish\folder"
   Copy-Item -Path "$publishPath\*" -Destination $installPath -Recurse -Force
   ```

4. **Créez un nouveau pool d'applications dans IIS** (via l'interface graphique ou PowerShell):
   ```powershell
   # Créer un nouveau pool d'applications
   Import-Module WebAdministration
   
   # Vérifier si le pool existe déjà
   if (!(Test-Path "IIS:\AppPools\MarketPlaceInstallerPool")) {
       New-WebAppPool -Name "MarketPlaceInstallerPool"
       
       # Configurer le pool pour "No Managed Code"
       Set-ItemProperty -Path "IIS:\AppPools\MarketPlaceInstallerPool" -Name "managedRuntimeVersion" -Value ""
       
       # Configurer le mode pipeline
       Set-ItemProperty -Path "IIS:\AppPools\MarketPlaceInstallerPool" -Name "managedPipelineMode" -Value "Integrated"
   }
   ```

5. **Créez une nouvelle application IIS** liée à ce pool:
   ```powershell
   # Créer une nouvelle application
   # Ajustez "Default Web Site" si nécessaire selon votre configuration IIS
   if (!(Test-Path "IIS:\Sites\Default Web Site\MarketPlaceInstaller")) {
       New-WebApplication -Name "MarketPlaceInstaller" -Site "Default Web Site" -PhysicalPath $installPath -ApplicationPool "MarketPlaceInstallerPool"
   } else {
       Set-ItemProperty -Path "IIS:\Sites\Default Web Site\MarketPlaceInstaller" -Name "physicalPath" -Value $installPath
       Set-ItemProperty -Path "IIS:\Sites\Default Web Site\MarketPlaceInstaller" -Name "applicationPool" -Value "MarketPlaceInstallerPool"
   }
   ```

6. **Attribuez les permissions correctes** au dossier:
   ```powershell
   # Donner les droits au pool d'applications
   $acl = Get-Acl $installPath
   $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS AppPool\MarketPlaceInstallerPool", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
   $acl.SetAccessRule($accessRule)
   Set-Acl $installPath $acl
   
   # Donner les droits également au dossier logs
   $logAcl = Get-Acl $logsPath
   $logAcl.SetAccessRule($accessRule)
   Set-Acl $logsPath $logAcl
   ```

7. **Assurez-vous que le fichier web.config** est correct (déjà en place):
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <location path="." inheritInChildApplications="false">
       <system.webServer>
         <handlers>
           <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
         </handlers>
         <aspNetCore processPath="dotnet" 
                   arguments=".\AvanteamMarketplace.LocalInstaller.dll" 
                   stdoutLogEnabled="true" 
                   stdoutLogFile=".\logs\stdout" 
                   hostingModel="outofprocess">
           <environmentVariables>
             <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
             <environmentVariable name="ASPNETCORE_DETAILEDERRORS" value="true" />
           </environmentVariables>
         </aspNetCore>
       </system.webServer>
     </location>
   </configuration>
   ```

8. **Modifiez le JavaScript client** pour pointer vers la nouvelle URL:
   ```javascript
   // Ancien code
   const localApiUrl = '/api-installer/';
   
   // Nouveau code
   const localApiUrl = '/MarketPlaceInstaller/';
   ```

9. **Redémarrez IIS**:
   ```powershell
   iisreset
   ```

## Vérifications après déploiement

1. **Testez l'API directement**:
   - Ouvrez un navigateur et accédez à: `http://localhost/MarketPlaceInstaller/status`
   - Vous devriez recevoir une réponse JSON indiquant que l'API est opérationnelle

2. **Testez l'intégration avec Marketplace**:
   - Accédez à l'interface Marketplace
   - Tentez d'installer un composant
   - Vérifiez la console du navigateur pour détecter d'éventuelles erreurs

## Pourquoi cette solution fonctionne

Cette solution fonctionne car:

1. L'application est hébergée dans un pool d'applications complètement indépendant avec "No Managed Code"
2. Elle n'est plus soumise aux règles ou limitations du pool d'applications parent
3. Le modèle d'hébergement "outofprocess" assure que l'application s'exécute dans son propre processus

## Script PowerShell complet d'installation

Vous pouvez exécuter le script PowerShell suivant pour automatiser toutes ces étapes:

```powershell
# Script d'installation de MarketPlaceLocalInstaller

# Paramètres
param(
    [string]$PublishPath = (Join-Path (Get-Location) "bin\Release\net6.0\publish"),
    [string]$InstallPath = "C:\ProcessStudio\MarketPlaceLocalInstaller",
    [string]$AppPoolName = "MarketPlaceInstallerPool",
    [string]$AppName = "MarketPlaceInstaller",
    [string]$SiteName = "Default Web Site"
)

# Vérifier que le script est exécuté en tant qu'administrateur
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Ce script nécessite des privilèges d'administrateur. Veuillez relancer PowerShell en tant qu'administrateur."
    Exit
}

Write-Host "=== Installation de MarketPlaceLocalInstaller ===" -ForegroundColor Cyan

# Étape 1: Créer les dossiers
Write-Host "1. Création des dossiers..." -ForegroundColor Green
if (!(Test-Path $InstallPath)) {
    New-Item -Path $InstallPath -ItemType Directory -Force
    Write-Host "   - Dossier principal créé: $InstallPath" -ForegroundColor Gray
} else {
    Write-Host "   - Dossier principal existe déjà: $InstallPath" -ForegroundColor Gray
}

$LogsPath = Join-Path $InstallPath "logs"
if (!(Test-Path $LogsPath)) {
    New-Item -Path $LogsPath -ItemType Directory -Force
    Write-Host "   - Dossier logs créé: $LogsPath" -ForegroundColor Gray
} else {
    Write-Host "   - Dossier logs existe déjà: $LogsPath" -ForegroundColor Gray
}

# Étape 2: Copier les fichiers publiés
Write-Host "2. Copie des fichiers publiés..." -ForegroundColor Green
if (!(Test-Path $PublishPath)) {
    Write-Error "Le chemin de publication n'existe pas: $PublishPath"
    Exit
}

Write-Host "   - Copie de $PublishPath vers $InstallPath" -ForegroundColor Gray
Copy-Item -Path "$PublishPath\*" -Destination $InstallPath -Recurse -Force

# Étape 3: Configurer IIS
Write-Host "3. Configuration IIS..." -ForegroundColor Green
Import-Module WebAdministration

# Créer le pool d'applications
if (!(Test-Path "IIS:\AppPools\$AppPoolName")) {
    Write-Host "   - Création du pool d'applications: $AppPoolName" -ForegroundColor Gray
    New-WebAppPool -Name $AppPoolName
    
    # Configurer le pool pour "No Managed Code"
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
    
    # Configurer le mode pipeline
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedPipelineMode" -Value "Integrated"
    
    Write-Host "   - Pool d'applications créé et configuré" -ForegroundColor Gray
} else {
    Write-Host "   - Pool d'applications existe déjà: $AppPoolName" -ForegroundColor Gray
}

# Créer l'application web
$SitePath = "IIS:\Sites\$SiteName"
if (!(Test-Path $SitePath)) {
    Write-Error "Le site web n'existe pas: $SiteName"
    Exit
}

if (!(Test-Path "$SitePath\$AppName")) {
    Write-Host "   - Création de l'application web: $AppName" -ForegroundColor Gray
    New-WebApplication -Name $AppName -Site $SiteName -PhysicalPath $InstallPath -ApplicationPool $AppPoolName
    Write-Host "   - Application web créée" -ForegroundColor Gray
} else {
    Write-Host "   - Application web existe déjà: $AppName, mise à jour..." -ForegroundColor Gray
    Set-ItemProperty -Path "$SitePath\$AppName" -Name "physicalPath" -Value $InstallPath
    Set-ItemProperty -Path "$SitePath\$AppName" -Name "applicationPool" -Value $AppPoolName
    Write-Host "   - Application web mise à jour" -ForegroundColor Gray
}

# Étape 4: Configurer les permissions
Write-Host "4. Configuration des permissions..." -ForegroundColor Green
$Acl = Get-Acl $InstallPath
$AccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS AppPool\$AppPoolName", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$Acl.SetAccessRule($AccessRule)
Set-Acl $InstallPath $Acl
Write-Host "   - Permissions accordées au dossier principal" -ForegroundColor Gray

$LogAcl = Get-Acl $LogsPath
$LogAcl.SetAccessRule($AccessRule)
Set-Acl $LogsPath $LogAcl
Write-Host "   - Permissions accordées au dossier logs" -ForegroundColor Gray

# Étape 5: Redémarrer IIS
Write-Host "5. Redémarrage IIS..." -ForegroundColor Green
iisreset
Write-Host "   - IIS redémarré" -ForegroundColor Gray

Write-Host "=== Installation terminée ===" -ForegroundColor Cyan
Write-Host "Pour tester, accédez à: http://localhost/$AppName/status" -ForegroundColor Yellow
Write-Host "N'oubliez pas de mettre à jour la constante localApiUrl dans le fichier JavaScript du Marketplace." -ForegroundColor Yellow
```

## Mise à jour du JavaScript Client

N'oubliez pas de mettre à jour le fichier JavaScript client pour pointer vers la nouvelle URL:

```javascript
// Remplacez:
const localApiUrl = '/api-installer/';
// Par:
const localApiUrl = '/MarketPlaceInstaller/';
```

## En cas de problèmes

Si vous rencontrez encore des problèmes:

1. **Vérifiez les logs**:
   - Dans le dossier `C:\ProcessStudio\MarketPlaceLocalInstaller\logs`
   - Dans les logs IIS standard

2. **Vérifiez le Module ASP.NET Core**:
   - Assurez-vous que ASP.NET Core Module V2 est correctement installé
   - Réinstallez le .NET 6.0 Hosting Bundle si nécessaire

3. **Vérifiez les permissions**:
   - Assurez-vous que l'utilisateur du pool d'applications a les droits suffisants