namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Définit les niveaux d'accès pour les clés API
    /// </summary>
    public enum ApiKeyAccessLevel
    {
        /// <summary>
        /// Clé API standard pour les applications web clientes
        /// Accès uniquement aux endpoints publics du marketplace
        /// </summary>
        ApplicationWeb = 0,
        
        /// <summary>
        /// Clé API avec accès complet à l'interface d'administration
        /// Peut créer, modifier, supprimer des composants et des clés API
        /// </summary>
        UtilisateurAdmin = 1,
        
        /// <summary>
        /// Clé API avec accès en lecture seule à l'interface d'administration
        /// Peut consulter les informations et télécharger les packages
        /// </summary>
        UtilisateurLecture = 2
    }
}