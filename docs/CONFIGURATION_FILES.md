# Guide des Fichiers de Configuration

Ce document détaille les fichiers de configuration essentiels pour le fonctionnement de Process Studio et du module Marketplace.

## Emplacement des fichiers

Les fichiers de configuration se trouvent dans le dossier `Avanteam Process Suite/PStudio.Configuration/`:
- `programs.ini`: Configuration principale de l'application
- `applications.xml`: Configuration des bases de données et connexions

## programs.ini

Le fichier `programs.ini` est le fichier de configuration principal (463 lignes) qui contrôle le comportement de Process Studio.

### Sections Principales

#### 1. Environment
```ini
[Environment]
Type=Development        # Development, Production ou Staging
AllowDebug=true         # Activation du mode débogage
DebugHost=127.0.0.1     # Hôte pour le débogage
```

#### 2. Security
```ini
[Security]
UseHttps=true           # Force l'utilisation de HTTPS
HstsEnabled=true        # Active HSTS (HTTP Strict Transport Security)
HstsMaxAge=31536000     # Durée HSTS en secondes (1 an)
RequireSsl=true         # Exige une connexion SSL
```

#### 3. Authentication
```ini
[Authentication]
DefaultAuthentication=Forms    # Mode d'authentification par défaut (Forms, Windows, SAML)
SessionTimeout=30              # Timeout de session en minutes
AllowRememberMe=true           # Autorise la fonction "Se souvenir de moi"
RememberMeDuration=14          # Durée "Se souvenir de moi" en jours
```

#### 4. SMTP
```ini
[SMTP]
Server=smtp.example.com    # Serveur SMTP pour l'envoi d'emails
Port=587                   # Port du serveur SMTP
Username=user@example.com  # Nom d'utilisateur SMTP
Password=password          # Mot de passe SMTP
EnableSsl=true             # Activer SSL pour SMTP
FromAddress=no-reply@example.com  # Adresse d'expédition
```

#### 5. Conversion
```ini
[Conversion]
PdfEngine=Aspose           # Moteur de conversion PDF
TempDirectory=C:\Temp      # Répertoire temporaire pour les conversions
```

#### 6. MarketPlace (spécifique au module Marketplace)
```ini
[MarketPlace]
ApiUrl=https://marketplace.example.com/api  # URL de l'API Marketplace
ApiKey=votre-cle-api                        # Clé API pour authentification
EnableAutoUpdate=true                       # Activer les mises à jour automatiques
CheckInterval=24                            # Intervalle de vérification des mises à jour (heures)
```

#### 7. RESTServices
```ini
[RESTServices]
BaseUrl=https://api.example.com     # URL de base pour les services REST
TimeoutSeconds=30                   # Timeout pour les appels API
RetryCount=3                        # Nombre de tentatives en cas d'échec
```

#### 8. Connections
```ini
[Connections]
ApplicationConnection=ACME.Application.app_PROD_APP    # Connexion à la base de données d'application
DirectoryConnection=ACME.Directory.app_prod_DIR        # Connexion à la base de données d'annuaire
```

## applications.xml

Le fichier `applications.xml` contient les connexions aux bases de données et les paramètres d'application.

### Structure Principale

```xml
<Applications>
  <!-- Connexions aux bases de données -->
  <Connections>
    <!-- Base de données d'application -->
    <Connection name="ACME.Application.app_PROD_APP" 
                type="Sql" 
                connectionstring="Data Source=SERVEUR\INSTANCE;
                                 Persist Security Info=True;
                                 User ID=utilisateur;
                                 Password=motdepasse;
                                 Initial Catalog=app_PROD_APP" />
                                 
    <!-- Base de données d'annuaire -->
    <Connection name="ACME.Directory.app_prod_DIR" 
                type="Sql" 
                connectionstring="Data Source=SERVEUR\INSTANCE;
                                 Persist Security Info=True;
                                 User ID=utilisateur;
                                 Password=motdepasse;
                                 Initial Catalog=app_prod_DIR" />
  </Connections>
  
  <!-- Sources de données -->
  <DataSources>
    <DataSource name="Application" connectionName="ACME.Application.app_PROD_APP" />
    <DataSource name="Directory" connectionName="ACME.Directory.app_prod_DIR" />
  </DataSources>
  
  <!-- Paramètres d'application -->
  <Application name="ACME" 
               baseUrl="https://processportal.example.com" 
               remoteUri="https://api.example.com">
    <!-- Propriétés supplémentaires -->
    <Property name="Environment" value="Production" />
    <Property name="Version" value="23.5" />
    <Property name="ApiEndpoint" value="https://api.example.com/v1" />
  </Application>
</Applications>
```

## Importance pour le Marketplace

### Configurations Critiques pour le Marketplace

1. **Dans programs.ini**:
   - La section `[MarketPlace]` doit être correctement configurée avec la clé API et l'URL du serveur
   - La section `[RESTServices]` configure les paramètres de connexion pour les appels API du Marketplace
   - Les valeurs de timeout dans `[RESTServices]` sont particulièrement importantes pour les installations de composants volumineux

2. **Dans applications.xml**:
   - Les attributs `baseUrl` et `remoteUri` dans l'élément `<Application>` sont utilisés par le Marketplace pour construire les URLs correctes
   - Les connexions définies sont utilisées pour déterminer les bases de données auxquelles le Marketplace doit se connecter

### Impact sur l'Installation des Composants

Le processus d'installation des composants dépend des configurations suivantes:

1. **Type d'environnement**:
   - En environnement de `Development`, les logs détaillés sont activés
   - En `Production`, les performances sont optimisées et les messages d'erreur simplifiés

2. **Connexions aux bases de données**:
   - Les composants peuvent avoir besoin d'accéder aux deux bases de données
   - Les scripts d'installation utilisent les connexions définies dans `applications.xml`

3. **Paramètres de sécurité**:
   - Les restrictions HTTPS et SSL impactent la manière dont le Marketplace communique avec l'API centrale
   - Les paramètres CORS doivent être configurés pour permettre la communication entre le client et l'API

## Modification des Configurations

### Best Practices

1. **Sauvegarde**:
   - Toujours effectuer une sauvegarde des fichiers de configuration avant modification
   - Conserver un historique des modifications importantes

2. **Environnements**:
   - Utiliser des fichiers de configuration distincts pour chaque environnement
   - Documenter les différences entre les environnements

3. **Sécurité**:
   - Ne jamais stocker de mots de passe en texte clair dans les fichiers vérifiés dans le dépôt
   - Utiliser des jetons de remplacement comme `#{PASSWORD}#` qui seront remplacés lors du déploiement

4. **Tests**:
   - Tester les modifications de configuration dans un environnement de développement avant de les appliquer en production
   - Prévoir un plan de restauration en cas de problème

### Procédure de Modification

1. Créer une sauvegarde du fichier à modifier
2. Apporter les modifications nécessaires
3. Valider la syntaxe (particulièrement important pour les fichiers XML)
4. Redémarrer le pool d'applications pour appliquer les changements
5. Tester le fonctionnement après modification
6. Documenter les changements effectués

## Résolution des Problèmes Courants

### Problèmes de Connexion à la Base de Données

Si vous rencontrez des erreurs de connexion aux bases de données:

1. Vérifiez que les chaînes de connexion sont correctement formatées
2. Assurez-vous que les noms d'instances SQL Server contiennent des doubles backslashes dans le XML
3. Validez que les identifiants ont les droits nécessaires sur les bases de données
4. Vérifiez que l'attribut `connectionstring` ne contient pas de sauts de ligne qui pourraient causer des erreurs de parsing

### Erreurs d'Authentification

Pour les problèmes d'authentification dans le Marketplace:

1. Vérifiez que la section `[MarketPlace]` dans `programs.ini` contient la bonne clé API
2. Assurez-vous que cette clé est bien enregistrée sur le serveur API central
3. Vérifiez que les paramètres d'authentification dans `[Authentication]` sont cohérents avec votre système

### Problèmes de Configuration HTTPS/SSL

Si vous rencontrez des erreurs liées à HTTPS ou SSL:

1. Vérifiez que `UseHttps` et `RequireSsl` sont configurés correctement dans `programs.ini`
2. Assurez-vous que les certificats SSL sont correctement installés et valides
3. Vérifiez que les paramètres HSTS sont appropriés pour votre environnement

---

Ce document est mis à jour régulièrement pour refléter les meilleures pratiques et les configurations recommandées. Dernière mise à jour: Mai 2025.