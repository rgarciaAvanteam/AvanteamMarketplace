using System.Collections.Generic;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour l'affichage des composants dans l'interface utilisateur
    /// </summary>
    public class ComponentsViewModel
    {
        /// <summary>
        /// Liste des composants
        /// </summary>
        public List<ComponentViewModel> Components { get; set; } = new List<ComponentViewModel>();
        
        /// <summary>
        /// Informations sur la plateforme
        /// </summary>
        public PlatformInfoViewModel PlatformInfo { get; set; } = new PlatformInfoViewModel();
    }
    
    /// <summary>
    /// ViewModel pour un composant dans l'interface utilisateur
    /// </summary>
    public class ComponentViewModel
    {
        public int ComponentId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string MinPlatformVersion { get; set; } = string.Empty;
        public bool RequiresRestart { get; set; }
        public bool HasUpdate { get; set; }
        public bool IsInstalled { get; set; }
        public bool IsCompatible { get; set; }
        public List<string> Tags { get; set; } = new List<string>();
        public string IconUrl { get; set; } = string.Empty;
    }
    
    /// <summary>
    /// ViewModel pour les informations de la plateforme
    /// </summary>
    public class PlatformInfoViewModel
    {
        public string Version { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public int ComponentsCount { get; set; }
        public int UpdatesCount { get; set; }
    }
}