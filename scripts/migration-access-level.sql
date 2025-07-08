-- Migration pour ajouter AccessLevel enum aux clés API
-- Date: 2025-07-08
-- Description: Remplace les colonnes booléennes par un enum AccessLevel

-- Vérifier si la colonne AccessLevel n'existe pas déjà
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ApiKeys' AND COLUMN_NAME = 'AccessLevel')
BEGIN
    -- Ajouter la colonne AccessLevel
    ALTER TABLE ApiKeys 
    ADD AccessLevel int NOT NULL DEFAULT 0;
    
    PRINT 'Colonne AccessLevel ajoutée à la table ApiKeys';
    
    -- Migrer les données existantes
    -- ApplicationWeb (0) = clés non-admin
    -- UtilisateurAdmin (1) = clés admin avec accès complet
    -- UtilisateurLecture (2) = clés admin avec accès lecture seule
    
    UPDATE ApiKeys 
    SET AccessLevel = CASE 
        WHEN IsAdmin = 1 THEN 1  -- UtilisateurAdmin
        ELSE 0                   -- ApplicationWeb
    END;
    
    PRINT 'Migration des données terminée';
END
ELSE
BEGIN
    PRINT 'Colonne AccessLevel existe déjà dans la table ApiKeys';
END

-- Supprimer les anciennes colonnes booléennes si elles existent
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ApiKeys' AND COLUMN_NAME = 'CanAccessAdminInterface')
BEGIN
    ALTER TABLE ApiKeys DROP COLUMN CanAccessAdminInterface;
    PRINT 'Colonne CanAccessAdminInterface supprimée';
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ApiKeys' AND COLUMN_NAME = 'CanReadAdminInterface')
BEGIN
    ALTER TABLE ApiKeys DROP COLUMN CanReadAdminInterface;
    PRINT 'Colonne CanReadAdminInterface supprimée';
END

PRINT 'Migration terminée - AccessLevel configuré';

-- Vérifier le résultat
SELECT 
    ApiKeyId,
    ClientId,
    IsAdmin,
    AccessLevel,
    CASE AccessLevel
        WHEN 0 THEN 'ApplicationWeb'
        WHEN 1 THEN 'UtilisateurAdmin'
        WHEN 2 THEN 'UtilisateurLecture'
        ELSE 'Inconnu'
    END as AccessLevelName,
    IsActive
FROM ApiKeys;