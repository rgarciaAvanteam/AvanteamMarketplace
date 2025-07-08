-- Migration pour ajouter les permissions d'accès admin aux clés API
-- Date: 2025-07-08
-- Description: Ajoute les colonnes CanAccessAdminInterface et CanReadAdminInterface à la table ApiKeys

-- Vérifier si les colonnes n'existent pas déjà
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ApiKeys' AND COLUMN_NAME = 'CanAccessAdminInterface')
BEGIN
    -- Ajouter la colonne CanAccessAdminInterface
    ALTER TABLE ApiKeys 
    ADD CanAccessAdminInterface bit NOT NULL DEFAULT 0;
    
    PRINT 'Colonne CanAccessAdminInterface ajoutée à la table ApiKeys';
END
ELSE
BEGIN
    PRINT 'Colonne CanAccessAdminInterface existe déjà dans la table ApiKeys';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ApiKeys' AND COLUMN_NAME = 'CanReadAdminInterface')
BEGIN
    -- Ajouter la colonne CanReadAdminInterface
    ALTER TABLE ApiKeys 
    ADD CanReadAdminInterface bit NOT NULL DEFAULT 0;
    
    PRINT 'Colonne CanReadAdminInterface ajoutée à la table ApiKeys';
END
ELSE
BEGIN
    PRINT 'Colonne CanReadAdminInterface existe déjà dans la table ApiKeys';
END

-- Mettre à jour les clés existantes qui sont admin pour qu'elles puissent accéder à l'interface admin
UPDATE ApiKeys 
SET CanAccessAdminInterface = 1, CanReadAdminInterface = 1 
WHERE IsAdmin = 1;

PRINT 'Migration terminée - Permissions mises à jour pour les clés admin existantes';

-- Vérifier le résultat
SELECT 
    ApiKeyId,
    ClientId,
    IsAdmin,
    CanAccessAdminInterface,
    CanReadAdminInterface,
    IsActive
FROM ApiKeys;