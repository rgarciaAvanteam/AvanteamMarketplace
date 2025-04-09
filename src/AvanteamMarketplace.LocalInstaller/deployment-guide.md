# Guide de déploiement de l'API locale d'installation

Ce guide vous aidera à déployer correctement l'API locale d'installation du Marketplace Avanteam sur votre serveur IIS.

## Prérequis

1. **Windows Server** avec IIS installé
2. **.NET 6.0 Runtime** - [Télécharger ici](https://dotnet.microsoft.com/download/dotnet/6.0)
3. **Module ASP.NET Core pour IIS** - Inclus dans le "Hosting Bundle"

## Installation du Hosting Bundle .NET Core

1. Téléchargez le .NET Core Hosting Bundle depuis [le site officiel de Microsoft](https://dotnet.microsoft.com/download/dotnet/6.0)
2. Exécutez l'installateur et suivez les instructions
3. Redémarrez IIS (exécutez `iisreset` en tant qu'administrateur)

## Option 1: Déploiement en tant qu'application IIS distincte (Recommandé)

Cette méthode est recommandée pour éviter les conflits avec votre application .NET Framework existante.

### Étapes de déploiement

1. **Créez un dossier pour l'application**
   ```
   mkdir C:\inetpub\MarketPlaceLocalInstaller
   ```

2. **Copiez les fichiers publiés dans ce dossier**
   ```
   xcopy /E /I /Y bin\Debug\net6.0\publish\* C:\inetpub\MarketPlaceLocalInstaller\
   ```

3. **Créez un dossier pour les logs**
   ```
   mkdir C:\inetpub\MarketPlaceLocalInstaller\logs
   ```

4. **Ouvrez IIS Manager et créez un nouveau pool d'applications**
   - Nom: `MarketPlaceInstallerPool`
   - Version .NET CLR: `No Managed Code`
   - Mode pipeline managé: `Integrated`

5. **Créez une nouvelle application dans IIS**
   - Nom: `MarketPlaceInstaller`
   - Chemin physique: `C:\inetpub\MarketPlaceLocalInstaller`
   - Pool d'applications: `MarketPlaceInstallerPool`

6. **Configurez les permissions**
   ```
   icacls "C:\inetpub\MarketPlaceLocalInstaller" /grant "IIS AppPool\MarketPlaceInstallerPool":(OI)(CI)(M)
   ```

7. **Vérifiez le fichier web.config**
   Assurez-vous que votre fichier web.config contient la configuration correcte pour ASP.NET Core:
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
           </environmentVariables>
         </aspNetCore>
       </system.webServer>
     </location>
   </configuration>
   ```

8. **Mettez à jour le JavaScript client**
   Modifiez le fichier `marketplace.js` pour utiliser la nouvelle URL:
   ```javascript
   const localApiUrl = '/MarketPlaceInstaller/';
   ```

## Option 2: Déploiement sous une application existante (Non recommandé)

Cette méthode n'est généralement **pas recommandée** car elle peut causer des conflits avec votre application .NET Framework existante.

Si vous choisissez cette option, vous pourriez rencontrer des erreurs comme:
- HTTP Error 500.34 - ASP.NET Core does not support mixing hosting models

## Tests après déploiement

1. **Vérifiez que l'API est accessible**
   - Ouvrez un navigateur et accédez à: `http://votre-serveur/MarketPlaceInstaller/status`
   - Vous devriez recevoir une réponse JSON indiquant que l'API est opérationnelle

2. **Vérifiez les logs en cas de problème**
   - Consultez les logs dans `C:\inetpub\MarketPlaceLocalInstaller\logs`
   - Consultez les logs IIS dans `%SystemDrive%\inetpub\logs\LogFiles`

## Dépannage

### L'API retourne une erreur 500

1. **Vérifiez les logs de l'application**
   - Consultez les fichiers de log dans le dossier `logs`

2. **Vérifiez les logs IIS**
   - Consultez les logs dans `%SystemDrive%\inetpub\logs\LogFiles`

3. **Vérifiez que le module ASP.NET Core est installé**
   - Réinstallez le .NET Core Hosting Bundle si nécessaire

4. **Vérifiez les permissions**
   - Assurez-vous que le pool d'applications a les permissions nécessaires sur le dossier

### L'API n'est pas accessible (erreur 404)

1. **Vérifiez la configuration de l'application dans IIS**
   - Assurez-vous que l'application est correctement configurée dans IIS
   - Vérifiez le chemin physique

2. **Vérifiez le routage**
   - Assurez-vous que les routes sont correctement configurées

### Problèmes de CORS

Si vous rencontrez des erreurs CORS lors de l'appel à l'API:

1. **Vérifiez la configuration CORS dans Program.cs**
   - Assurez-vous que la politique CORS autorise votre domaine

2. **Vérifiez les en-têtes de réponse**
   - Utilisez les outils de développement du navigateur pour vérifier les en-têtes CORS