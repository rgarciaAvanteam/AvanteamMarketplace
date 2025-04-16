-- Script pour mettre à jour les valeurs BaseUrl existantes si nécessaire
-- Cette mise à jour peut être personnalisée selon vos besoins
UPDATE ApiKeys
SET BaseUrl = 'https://default-process-studio-url.com'
WHERE BaseUrl IS NULL;

PRINT 'Mise à jour des valeurs BaseUrl existantes terminée.';