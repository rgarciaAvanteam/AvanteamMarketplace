# Guide d'installation de l'API locale pour les composants Marketplace

Ce document explique comment configurer le système d'installation automatique de composants pour le Marketplace Avanteam.

## Architecture

L'architecture d'installation se compose de deux parties:

1. **API Marketplace centrale** - Hébergée sur un serveur central, fournit les informations sur les composants
2. **API locale sur le serveur Process Studio** - Intégrée à l'application Process Studio, exécute l'installation locale

## Installation de l'API locale

Pour permettre l'installation automatique des composants, vous devez ajouter l'API locale au site Process Studio:

### 1. Copiez les fichiers suivants dans le dossier Process Studio:

- `/Custom/MarketPlace/api/web.config`
- `/Custom/MarketPlace/api/bin/AvanteamMarketplace.LocalInstaller.dll`
- `/Custom/MarketPlace/scripts/install-component.ps1`

### 2. Configurez IIS pour autoriser l'API

Ajoutez un handler d'application pour le dossier `/Custom/MarketPlace/api/`:

```xml
<system.webServer>
  <handlers>
    <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
  </handlers>
  <aspNetCore processPath="dotnet" arguments=".\AvanteamMarketplace.LocalInstaller.dll" stdoutLogEnabled="false" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
</system.webServer>
```

## Fonctionnement

Le processus d'installation fonctionne comme suit:

1. L'utilisateur clique sur "Installer" dans l'interface web du Marketplace
2. JavaScript appelle l'API locale à l'URL `/Custom/MarketPlace/api/install`
3. L'API locale exécute le script PowerShell `install-component.ps1` avec les paramètres appropriés
4. Le script télécharge le package, l'extrait et installe les fichiers au bon endroit
5. Le résultat est renvoyé à l'interface utilisateur
6. L'interface enregistre l'installation auprès de l'API centrale

## Dépannage

Si vous rencontrez des problèmes avec l'installation automatique:

1. Vérifiez que les fichiers sont correctement copiés dans Process Studio
2. Assurez-vous que les permissions IIS sont correctes et que l'application a accès à PowerShell
3. Vérifiez les logs dans `/Custom/MarketPlace/api/logs/`
4. Essayez l'installation manuelle en dernier recours

## Support

Pour toute assistance supplémentaire, contactez le support Avanteam à support@avanteam.fr