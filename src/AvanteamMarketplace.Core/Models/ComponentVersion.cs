using System;

namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente une version d'un composant
    /// </summary>
    public class ComponentVersion
    {
        public int VersionId { get; set; }
        public int ComponentId { get; set; }
        public string Version { get; set; } = string.Empty;
        public DateTime ReleaseDate { get; set; }
        public string? ChangeLog { get; set; }
        public string? ReleaseNotes { get; set; } // Alias de ChangeLog pour compatibilité
        public DateTime PublishedDate { get; set; } // Alias de ReleaseDate pour compatibilité
        public string? MinPlatformVersion { get; set; }
        public string? MaxPlatformVersion { get; set; } // Version maximale de Process Studio supportée
        public string? PackageUrl { get; set; }
        public bool IsLatest { get; set; }
        
        // Navigation property
        public virtual Component Component { get; set; } = null!;
    }
}