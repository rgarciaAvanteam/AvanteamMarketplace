using System;

namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente un téléchargement de composant
    /// </summary>
    public class ComponentDownload
    {
        public int DownloadId { get; set; }
        public int ComponentId { get; set; }
        public string Version { get; set; } = string.Empty;
        public string? ClientIdentifier { get; set; }
        public string? ClientIp { get; set; }
        public DateTime DownloadDate { get; set; }
        
        // Navigation property
        public virtual Component Component { get; set; } = null!;
    }
}