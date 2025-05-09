-- Script SQL pour ajouter l'entrée MarketPlace au menu de navigation
DECLARE @xmlString NVARCHAR(MAX)
DECLARE @newEntry NVARCHAR(MAX)
DECLARE @xmlDoc XML

-- Récupérer la chaîne XML existante
SELECT @xmlString = [template] FROM [NavigatorTemplates] WHERE [name] = 'DefaultNavigateur'

-- Convertir temporairement en XML pour la vérification
SET @xmlDoc = CAST(@xmlString AS XML)

-- Définir la nouvelle entrée à ajouter
SET @newEntry = N'
    <NavigatorEntry>
      <ImageSrc>fa-brands fa-unity is-success</ImageSrc>
      <Title>MarketPlace</Title>
      <ViewLinks>
        <NavigatorViewLink>
          <Title>Accueil</Title>
          <PersonalizedViewAccessLevel />
          <Action>OpenPage("custom/marketplace/default.aspx", "MarketPlace" );</Action>
          <Localization />
        </NavigatorViewLink>
      </ViewLinks>
      <Localization />
      <ContentType>View</ContentType>
    </NavigatorEntry>'

-- Vérifier si l'entrée MarketPlace existe déjà
IF @xmlDoc.exist('//NavigatorEntry[Title="MarketPlace"]') = 0
BEGIN
    -- Trouver la position de fermeture du tag Entries
    DECLARE @position INT
    SET @position = CHARINDEX('</Entries>', @xmlString)
    
    -- Insérer la nouvelle entrée avant la balise de fermeture
    IF @position > 0
    BEGIN
        SET @xmlString = STUFF(@xmlString, @position, 0, @newEntry)
        
        -- Mettre à jour la table
        UPDATE [NavigatorTemplates]
        SET [template] = @xmlString
        WHERE [name] = 'DefaultNavigateur'
        
        PRINT 'Entrée MarketPlace ajoutée avec succès au menu de navigation.'
    END
    ELSE
    BEGIN
        PRINT 'Erreur: Balise </Entries> non trouvée dans le XML.'
    END
END
ELSE
BEGIN
    PRINT 'L''entrée MarketPlace existe déjà dans le menu de navigation.'
END