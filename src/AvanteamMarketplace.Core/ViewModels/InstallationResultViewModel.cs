using System;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// Modèle de données pour le résultat d'une installation de composant
    /// </summary>
    public class InstallationResultViewModel
    {
        /// <summary>
        /// Indique si l'installation s'est terminée avec succès
        /// </summary>
        public bool Success { get; set; }
        
        /// <summary>
        /// Message d'erreur en cas d'échec
        /// </summary>
        public string? Error { get; set; }
        
        /// <summary>
        /// ID unique de l'installation pour traçabilité
        /// </summary>
        public string? InstallId { get; set; }
        
        /// <summary>
        /// ID du composant installé
        /// </summary>
        public string? ComponentId { get; set; }
        
        /// <summary>
        /// Version du composant installé
        /// </summary>
        public string? Version { get; set; }
        
        /// <summary>
        /// Chemin de destination où le composant a été installé
        /// </summary>
        public string? DestinationPath { get; set; }
        
        /// <summary>
        /// Chemin du fichier de log d'installation
        /// </summary>
        public string? LogFile { get; set; }
        
        /// <summary>
        /// Date et heure de l'installation
        /// </summary>
        public DateTime InstallDate { get; set; } = DateTime.Now;
    }
}