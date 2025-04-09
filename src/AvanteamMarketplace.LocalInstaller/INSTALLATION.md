# Guide d'installation de l'API locale pour les composants Marketplace

Ce document détaille le processus d'installation et de configuration de l'API locale pour l'installation automatisée des composants du Marketplace Avanteam.

## Prérequis

- **Windows Server** avec IIS installé
- **ASP.NET Core Runtime 6.0** ou plus récent
- **ASP.NET Core Module pour IIS** installé
- **PowerShell 5.1** ou plus récent
- **Process Studio** correctement installé et configuré

## Étapes d'installation

### 1. Compilation de l'API locale

Avant de déployer l'API, vous devez la compiler:

```powershell
cd AvanteamMarketplace.LocalInstaller
dotnet publish -c Release
```

### 2. Installation automatisée

Utilisez le script d'installation fourni:

```powershell
# Depuis le répertoire du projet
.\setup-local-installer.ps1 -ProcessStudioRoot "C:\inetpub\wwwroot\ProcessStudio"
```

### 3. Installation manuelle (alternative)

Si vous préférez une installation manuelle:

1. Créez les répertoires suivants:
   - `C:\inetpub\wwwroot\ProcessStudio\Custom\MarketPlace\api`
   - `C:\inetpub\wwwroot\ProcessStudio\Custom\MarketPlace\scripts`
   - `C:\inetpub\wwwroot\ProcessStudio\Custom\MarketPlace\logs`

2. Copiez les fichiers compilés depuis `bin\Release\net6.0\publish` vers le répertoire `api`

3. Copiez le fichier `install-component.ps1` vers le répertoire `scripts`

4. Assurez-vous que le web.config est correctement configuré dans le répertoire `api`

### 4. Configuration d'IIS

1. Assurez-vous que le module ASP.NET Core est installé:
   ```powershell
   Install-WindowsFeature Web-AspNetCore
   ```

2. Configurez les permissions:
   - L'utilisateur du pool d'applications doit avoir les droits d'exécution pour PowerShell
   - L'utilisateur doit avoir accès en lecture/écriture aux répertoires `Custom/MarketPlace/scripts` et `Custom/MarketPlace/logs`

3. Vérifiez que le fichier `web.config` est correctement configuré:
   ```xml
   <system.webServer>
     <handlers>
       <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
     </handlers>
     <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.LocalInstaller.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
   </system.webServer>
   ```

## Vérification de l'installation

Pour vérifier que l'API locale est correctement installée et fonctionnelle:

1. Accédez à l'URL `http://votreserveur/Custom/MarketPlace/api/status`
2. Vous devriez voir une réponse JSON avec le statut de l'API

## Dépannage

### L'API retourne une erreur 500

1. Vérifiez les logs IIS dans `%SystemDrive%\inetpub\logs\LogFiles`
2. Vérifiez les logs de l'API dans `Custom\MarketPlace\api\logs\stdout_xxx.log`
3. Assurez-vous que le module ASP.NET Core est correctement installé
4. Vérifiez les permissions du compte d'application IIS

### L'installation des composants échoue

1. Vérifiez les logs d'installation dans `Custom\MarketPlace\logs`
2. Assurez-vous que le script `install-component.ps1` est présent et accessible
3. Vérifiez que PowerShell est accessible par l'utilisateur du pool d'applications
4. Testez l'exécution manuelle du script PowerShell pour identifier les problèmes

## Support

Pour toute assistance, contactez le support Avanteam:
- Email: support@avanteam.fr
- Site web: https://avanteam.fr