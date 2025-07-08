# 🚀 Guide de déploiement - Permissions d'accès admin pour les clés API

## 📋 Checklist de déploiement

### 1. ⚠️ IMPORTANT - Arrêter l'application avant la migration
```bash
# Sur le serveur, arrêter le pool d'application IIS
# Ou utiliser le script de recyclage
.\recycle-apppool.bat
```

### 2. 🗃️ Migration de la base de données
Exécuter le script SQL suivant sur votre base de données de production :

**Fichier :** `scripts/migration-admin-permissions.sql`

```sql
-- Le script ajoute automatiquement les colonnes si elles n'existent pas
-- Et met à jour les permissions pour les clés admin existantes
```

### 3. 📦 Déploiement du code

#### Option A : Déploiement automatique (recommandé)
```bash
# Si vous avez un script de déploiement
.\DeployApiToIIS.ps1
```

#### Option B : Déploiement manuel
1. **Pull du code :**
   ```bash
   git pull origin main
   ```

2. **Build de l'application :**
   ```bash
   dotnet build AvanteamMarketplace.sln --configuration Release
   ```

3. **Publier l'API :**
   ```bash
   dotnet publish src/AvanteamMarketplace.API/AvanteamMarketplace.API.csproj -c Release -o ./publish
   ```

4. **Copier les fichiers vers IIS :**
   - Copier le contenu de `./publish` vers le répertoire IIS
   - Remplacer les fichiers existants

### 4. ♻️ Redémarrage de l'application
```bash
# Redémarrer le pool d'application IIS
.\recycle-apppool.bat
```

### 5. ✅ Tests post-déploiement

#### Test 1 : Vérifier l'interface admin
- Aller sur : `https://votre-serveur/Admin/Login`
- Se connecter avec votre clé admin existante
- Vérifier que l'onglet "Clés API" fonctionne

#### Test 2 : Créer une nouvelle clé avec permissions
1. Dans l'interface admin, aller à "Clés API"
2. Cliquer "Ajouter une clé API"
3. Remplir les champs et cocher les nouvelles permissions :
   - ☑️ "Peut accéder à l'interface admin"
   - ☑️ "Accès en lecture seule à l'interface admin"
4. Créer la clé

#### Test 3 : Tester l'authentification par clé API
1. Se déconnecter de l'interface admin
2. Essayer de se reconnecter avec la nouvelle clé API créée
3. Vérifier que l'accès fonctionne selon les permissions accordées

## 🆘 En cas de problème

### Rollback de la migration (si nécessaire)
```sql
-- Supprimer les colonnes ajoutées (ATTENTION: perte de données)
ALTER TABLE ApiKeys DROP COLUMN CanAccessAdminInterface;
ALTER TABLE ApiKeys DROP COLUMN CanReadAdminInterface;
```

### Rollback du code
```bash
# Revenir au commit précédent
git revert HEAD
# Puis redéployer
```

### Logs à vérifier
- Logs IIS : `C:\inetpub\logs\LogFiles\`
- Logs application : Dans le répertoire de l'application
- Event Viewer Windows : Applications and Services Logs

## 📞 Support
En cas de problème, vérifier :
1. Les permissions de base de données
2. Les logs d'erreur IIS
3. Que toutes les dépendances .NET sont présentes
4. La connectivité à la base de données