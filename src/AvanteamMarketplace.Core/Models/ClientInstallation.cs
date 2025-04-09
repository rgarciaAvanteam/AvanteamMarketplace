using System;
using System.Collections.Generic;

namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente une installation client
    /// </summary>
    public class ClientInstallation
    {
        public int InstallationId { get; set; }
        public string ClientIdentifier { get; set; } = string.Empty;
        public string? PlatformVersion { get; set; }
        public DateTime RegisteredDate { get; set; }
        public DateTime? LastCheckinDate { get; set; }
        
        // Navigation property
        public virtual ICollection<InstalledComponent> InstalledComponents { get; set; } = new List<InstalledComponent>();
    }
}