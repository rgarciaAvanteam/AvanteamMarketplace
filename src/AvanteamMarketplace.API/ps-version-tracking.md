# Guide d'intégration du suivi des versions de Process Studio

Ce document explique les modifications apportées pour améliorer le suivi des versions de Process Studio des clients utilisant le marketplace.

## Fonctionnalités ajoutées

1. Enregistrement de la version de Process Studio lors de la connexion des clients
2. Affichage de la version dans la liste des clients utilisant un composant
3. Interface d'administration améliorée pour visualiser les versions Process Studio

## Modifications techniques

Nous avons ajouté un nouveau champ `PlatformVersion` aux modèles suivants :
- `ApiKey` - Pour stocker la version de Process Studio associée à une clé API
- `ClientInstallationViewModel` - Pour afficher la version lors de la consultation des clients

## Migration de base de données

Un script SQL a été créé pour ajouter la colonne à la table ApiKeys et migrer les données :
```sql
-- Migration SQL pour ajouter la colonne PlatformVersion à la table ApiKeys

-- Vérifier si la colonne existe déjà
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE Name = N'PlatformVersion'
    AND Object_ID = Object_ID(N'dbo.ApiKeys')
)
BEGIN
    -- Ajouter la colonne PlatformVersion
    ALTER TABLE dbo.ApiKeys
    ADD PlatformVersion NVARCHAR(50) NULL;
    
    PRINT 'Colonne PlatformVersion ajoutée à la table ApiKeys';
    
    -- Mise à jour des valeurs existantes pour PlatformVersion
    UPDATE ak
    SET ak.PlatformVersion = ci.PlatformVersion
    FROM dbo.ApiKeys ak
    INNER JOIN dbo.ClientInstallations ci ON ak.ClientId = ci.ClientIdentifier
    WHERE ci.PlatformVersion IS NOT NULL;
    
    PRINT 'Les versions de plateformes ont été synchronisées depuis ClientInstallations';
END
ELSE
BEGIN
    PRINT 'La colonne PlatformVersion existe déjà dans la table ApiKeys';
END
```

Pour exécuter la migration, utilisez le script PowerShell `update-platformversion.ps1` :
```powershell
.\update-platformversion.ps1 -ServerInstance "(localdb)\MSSQLLocalDB" -Database "AvanteamMarketplace"
```

## Flux de données

1. La version Process Studio est capturée lorsque le client fait des requêtes à l'API
2. Les données de version sont stockées à la fois dans l'entrée ClientInstallation et dans la clé API correspondante
3. Lors de l'affichage des clients utilisant un composant, nous utilisons en priorité la version de la clé API, avec un fallback sur la version de l'installation

## Interface utilisateur

- L'interface d'administration des clés API inclut maintenant une colonne "Version PS"
- Le formulaire d'ajout de clé API permet de spécifier la version
- L'affichage des clients utilisant un composant montre la version Process Studio à côté de l'URL

## Raisons de ces changements

- Améliore la visibilité des versions utilisées par les clients
- Facilite la gestion des composants compatibles avec certaines versions
- Permet un meilleur dépannage des problèmes liés aux versions
- Donne une meilleure visibilité sur la distribution des versions dans la base d'utilisateurs