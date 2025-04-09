using System;
using System.Collections.Generic;

namespace AvanteamMarketplace.Core.Models
{
    /// <summary>
    /// Représente un composant dans le marketplace
    /// </summary>
    public class Component
    {
        public int ComponentId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string MinPlatformVersion { get; set; } = string.Empty;
        public string RecommendedPlatformVersion { get; set; } = string.Empty;
        public string RepositoryUrl { get; set; } = string.Empty;
        public bool RequiresRestart { get; set; }
        public string TargetPath { get; set; } = string.Empty;
        public string PackageUrl { get; set; } = string.Empty;
        public string? ReadmeContent { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime UpdatedDate { get; set; }
        
        // Navigation properties
        public virtual ICollection<ComponentTag> Tags { get; set; } = new List<ComponentTag>();
        public virtual ICollection<ComponentDependency> Dependencies { get; set; } = new List<ComponentDependency>();
        public virtual ICollection<ComponentVersion> Versions { get; set; } = new List<ComponentVersion>();
        public virtual ICollection<InstalledComponent> Installations { get; set; } = new List<InstalledComponent>();
    }
}