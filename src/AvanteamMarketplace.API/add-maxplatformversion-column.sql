-- Script SQL pour ajouter la colonne MaxPlatformVersion aux tables Components et ComponentVersions

-- Vérifier si la colonne existe déjà dans la table Components
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Components' AND COLUMN_NAME = 'MaxPlatformVersion'
)
BEGIN
    -- Ajouter la colonne MaxPlatformVersion à la table Components
    ALTER TABLE Components
    ADD MaxPlatformVersion NVARCHAR(50) NULL;
    
    PRINT 'Colonne MaxPlatformVersion ajoutée à la table Components.';
END
ELSE
BEGIN
    PRINT 'La colonne MaxPlatformVersion existe déjà dans la table Components.';
END

-- Vérifier si la colonne existe déjà dans la table ComponentVersions
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ComponentVersions' AND COLUMN_NAME = 'MaxPlatformVersion'
)
BEGIN
    -- Ajouter la colonne MaxPlatformVersion à la table ComponentVersions
    ALTER TABLE ComponentVersions
    ADD MaxPlatformVersion NVARCHAR(50) NULL;
    
    PRINT 'Colonne MaxPlatformVersion ajoutée à la table ComponentVersions.';
END
ELSE
BEGIN
    PRINT 'La colonne MaxPlatformVersion existe déjà dans la table ComponentVersions.';
END