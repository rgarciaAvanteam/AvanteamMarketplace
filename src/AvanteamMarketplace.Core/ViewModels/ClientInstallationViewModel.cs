using System;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel représentant une installation client avec des informations sur la version installée
    /// </summary>
    public class ClientInstallationViewModel
    {
        /// <summary>
        /// ID de l'installation
        /// </summary>
        public int InstallationId { get; set; }
        
        /// <summary>
        /// Identifiant unique du client
        /// </summary>
        public string ClientIdentifier { get; set; } = string.Empty;
        
        /// <summary>
        /// Nom ou description du client
        /// </summary>
        public string ClientName { get; set; } = string.Empty;
        
        /// <summary>
        /// Version de Process Studio utilisée par le client
        /// </summary>
        public string PlatformVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// Version installée du composant
        /// </summary>
        public string InstalledVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// Date d'installation initiale
        /// </summary>
        public DateTime InstallDate { get; set; }
        
        /// <summary>
        /// Date de dernière mise à jour
        /// </summary>
        public DateTime LastUpdateDate { get; set; }
        
        /// <summary>
        /// Indique si le client a une mise à jour disponible pour ce composant
        /// </summary>
        public bool HasUpdateAvailable { get; set; }
        
        /// <summary>
        /// Indique si le client est actif (dernière connexion récente)
        /// </summary>
        public bool IsActive { get; set; }
    }
}