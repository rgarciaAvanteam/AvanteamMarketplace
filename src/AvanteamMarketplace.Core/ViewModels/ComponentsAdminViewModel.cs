using System.Collections.Generic;

namespace AvanteamMarketplace.Core.ViewModels
{
    /// <summary>
    /// ViewModel pour l'administration des composants
    /// </summary>
    public class ComponentsAdminViewModel
    {
        /// <summary>
        /// Liste de tous les composants
        /// </summary>
        public List<ComponentAdminViewModel> Components { get; set; } = new List<ComponentAdminViewModel>();
        
        /// <summary>
        /// Statistiques générales
        /// </summary>
        public AdminStatisticsViewModel Statistics { get; set; } = new AdminStatisticsViewModel();
    }
    
    /// <summary>
    /// ViewModel pour un composant dans l'interface d'administration
    /// </summary>
    public class ComponentAdminViewModel
    {
        public int ComponentId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string MinPlatformVersion { get; set; } = string.Empty;
        public int TotalDownloads { get; set; }
        public int TotalInstallations { get; set; }
        public string Status { get; set; } = string.Empty;
        public string IconUrl { get; set; } = string.Empty;
        public DateTime UpdatedDate { get; set; }
    }
    
    /// <summary>
    /// ViewModel pour les statistiques d'administration
    /// </summary>
    public class AdminStatisticsViewModel
    {
        public int TotalComponents { get; set; }
        public int TotalCategories { get; set; }
        public int TotalClients { get; set; }
        public int TotalDownloads { get; set; }
        public int TotalInstallations { get; set; }
    }
}