using System;
using System.Collections.Generic;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour les détails d'un composant
    /// </summary>
    public class ComponentDetailViewModel
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
        public DateTime CreatedDate { get; set; }
        public DateTime UpdatedDate { get; set; }
        public bool IsInstalled { get; set; }
        public bool IsCompatible { get; set; }
        public bool HasUpdate { get; set; }
        public string IconUrl { get; set; } = string.Empty;
        
        // Liste des versions disponibles
        public List<VersionViewModel> Versions { get; set; } = new List<VersionViewModel>();
        
        // Statistiques
        public int DownloadCount { get; set; }
        public int InstallationCount { get; set; }
        
        // Liste des tags
        public List<string> Tags { get; set; } = new List<string>();
        
        // Liste des dépendances
        public List<DependencyViewModel> Dependencies { get; set; } = new List<DependencyViewModel>();
    }
}