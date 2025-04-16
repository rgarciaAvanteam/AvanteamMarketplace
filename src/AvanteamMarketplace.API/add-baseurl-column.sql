-- Script pour ajouter la colonne BaseUrl à la table ApiKeys
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ApiKeys' AND COLUMN_NAME = 'BaseUrl'
)
BEGIN
    ALTER TABLE ApiKeys
    ADD BaseUrl NVARCHAR(255) NULL;
    
    PRINT 'Colonne BaseUrl ajoutée avec succès à la table ApiKeys.';
END
ELSE
BEGIN
    PRINT 'La colonne BaseUrl existe déjà dans la table ApiKeys.';
END