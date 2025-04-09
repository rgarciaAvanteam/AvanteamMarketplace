using System.Collections.Generic;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.ViewModels;

namespace AvanteamMarketplace.Core.Services
{
    /// <summary>
    /// Interface pour le service du marketplace
    /// </summary>
    public interface IMarketplaceService
    {
        /// <summary>
        /// Récupère les composants compatibles avec la version de la plateforme spécifiée
        /// </summary>
        Task<ComponentsViewModel> GetCompatibleComponentsAsync(string clientId, string platformVersion);
        
        /// <summary>
        /// Récupère les mises à jour disponibles pour un client
        /// </summary>
        Task<ComponentsViewModel> GetUpdatesForClientAsync(string clientId, string platformVersion);
        
        /// <summary>
        /// Récupère les composants futurs (non compatibles avec la version actuelle)
        /// </summary>
        Task<ComponentsViewModel> GetFutureComponentsAsync(string clientId, string platformVersion);
        
        /// <summary>
        /// Récupère les détails d'un composant
        /// </summary>
        Task<ComponentDetailViewModel> GetComponentDetailAsync(int componentId);
        
        /// <summary>
        /// Récupère le contenu README d'un composant
        /// </summary>
        Task<string> GetComponentReadmeAsync(int componentId);
        
        /// <summary>
        /// Récupère les informations de téléchargement d'un composant
        /// </summary>
        Task<ComponentDownloadInfo> GetComponentDownloadInfoAsync(int componentId, string? version = null);
        
        /// <summary>
        /// Enregistre un téléchargement de composant
        /// </summary>
        Task LogComponentDownloadAsync(int componentId, string clientId, string version);
        
        /// <summary>
        /// Enregistre l'installation d'un composant
        /// </summary>
        Task LogComponentInstallationAsync(int componentId, string clientId, string? version = null);
        
        /// <summary>
        /// Désinstalle un composant pour un client spécifique
        /// </summary>
        /// <param name="componentId">ID du composant à désinstaller</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <returns>True si la désinstallation a réussi, sinon False</returns>
        Task<bool> UninstallComponentAsync(int componentId, string clientId);
        
        // Méthodes d'administration
        
        /// <summary>
        /// Récupère la liste des composants pour l'administration
        /// </summary>
        Task<ComponentsAdminViewModel> GetComponentsForAdminAsync();
        
        /// <summary>
        /// Récupère les détails d'un composant pour l'administration
        /// </summary>
        Task<ComponentAdminDetailViewModel> GetComponentAdminDetailAsync(int componentId);
        
        /// <summary>
        /// Crée un nouveau composant
        /// </summary>
        Task<int> CreateComponentAsync(ComponentCreateViewModel model);
        
        /// <summary>
        /// Met à jour un composant existant
        /// </summary>
        Task<bool> UpdateComponentAsync(int componentId, ComponentUpdateViewModel model);
        
        /// <summary>
        /// Supprime un composant
        /// </summary>
        Task<bool> DeleteComponentAsync(int componentId);
        
        /// <summary>
        /// Récupère la liste des clés API
        /// </summary>
        Task<List<ApiKeyViewModel>> GetApiKeysAsync();
        
        /// <summary>
        /// Crée une nouvelle clé API
        /// </summary>
        Task<ApiKeyViewModel> CreateApiKeyAsync(ApiKeyCreateViewModel model);
        
        /// <summary>
        /// Supprime une clé API
        /// </summary>
        Task<bool> DeleteApiKeyAsync(int apiKeyId);
    }
    
    /// <summary>
    /// Informations de téléchargement d'un composant
    /// </summary>
    public class ComponentDownloadInfo
    {
        public string Version { get; set; } = string.Empty;
        public string? DownloadUrl { get; set; }
        public string? FilePath { get; set; }
        public string? ChecksumSha256 { get; set; }
        public long FileSize { get; set; }
    }
}