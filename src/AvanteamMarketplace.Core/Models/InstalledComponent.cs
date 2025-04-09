using System;

namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente un composant installé sur un client
    /// </summary>
    public class InstalledComponent
    {
        public int InstallationId { get; set; }
        public int ComponentId { get; set; }
        public string Version { get; set; } = string.Empty;
        public DateTime InstallDate { get; set; }
        public DateTime? LastUpdateDate { get; set; }
        public bool IsActive { get; set; }
        
        // Navigation properties
        public virtual ClientInstallation Installation { get; set; } = null!;
        public virtual Component Component { get; set; } = null!;
    }
}