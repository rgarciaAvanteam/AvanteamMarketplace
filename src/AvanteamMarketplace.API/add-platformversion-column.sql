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