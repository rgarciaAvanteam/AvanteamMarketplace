using System;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour les versions d'un composant
    /// </summary>
    public class VersionViewModel
    {
        public int VersionId { get; set; }
        public string VersionNumber { get; set; } = string.Empty;
        public DateTime ReleaseDate { get; set; }
        public string ChangeLog { get; set; } = string.Empty;
        public string DownloadUrl { get; set; } = string.Empty;
        public int DownloadCount { get; set; }
        public bool IsLatest { get; set; }
        
        /// <summary>
        /// Version minimale de la plateforme requise pour cette version
        /// </summary>
        public string MinPlatformVersion { get; set; } = string.Empty;
    }
}