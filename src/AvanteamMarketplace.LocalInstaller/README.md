# Avanteam Marketplace - API locale d'installation

Cette API locale permet l'installation automatisée des composants du Marketplace Avanteam sur les serveurs Process Studio.

## Compilation et publication

Le projet est développé en ASP.NET Core 6.0 et peut être compilé et publié à l'aide de `dotnet` CLI:

```bash
# Compilation en mode Debug
dotnet build -c Debug

# Publication en mode Debug
dotnet publish -c Debug

# Publication en mode Release
dotnet publish -c Release
```

Les fichiers publiés se trouvent dans le dossier `bin/Debug/net6.0/publish` ou `bin/Release/net6.0/publish`.

## Déploiement en tant qu'application IIS distincte (Recommandé)

Cette méthode est la plus robuste et celle recommandée par Microsoft pour les applications ASP.NET Core.

### Prérequis
- IIS installé avec le module ASP.NET Core
- .NET Core 6.0 Runtime installé

### Étapes de déploiement
1. Créez un dossier pour l'application, par exemple: `C:\inetpub\MarketPlaceLocalInstaller`
2. Copiez tous les fichiers du dossier de publication dans ce dossier
3. Dans IIS Manager, créez une nouvelle application:
   - Nom: `MarketPlaceInstaller`
   - Chemin physique: `C:\inetpub\MarketPlaceLocalInstaller`
   - Pool d'applications: Créez-en un nouveau avec "No Managed Code"

4. Assurez-vous que le web.config est correctement configuré:
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
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Development" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>
```

5. Configurez les permissions du dossier:
   - Donnez les droits de lecture/écriture à l'utilisateur du pool d'applications (IIS AppPool\<nom_du_pool>)

6. Dans le JavaScript client (marketplace.js), mettez à jour l'URL de l'API locale:
```javascript
const localApiUrl = '/MarketPlaceInstaller/';
```

## Structure du code

- `Program.cs`: Point d'entrée de l'application, configuration
- `Controllers/InstallerController.cs`: Contrôleur pour l'installation des composants
- `appsettings.json`: Configuration de l'application

## API Endpoints

- `GET /status`: Retourne l'état de l'API
- `POST /install`: Installe un composant à partir d'une URL de package

Exemple de requête d'installation:
```json
{
  "componentId": 123,
  "version": "1.0.0",
  "packageUrl": "https://marketplace.avanteam.com/packages/component-123-1.0.0.zip"
}
```

## Logs

Les logs sont générés dans le dossier `logs` sous le répertoire de l'application.