using System.Collections.Generic;
using System.Threading.Tasks;
using AvanteamMarketplace.Core.Models;
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
        
        /// <summary>
        /// Vérifie si une mise à jour est disponible pour un composant installé
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="clientId">Identifiant du client</param>
        /// <param name="installedVersion">Version installée actuelle</param>
        /// <param name="platformVersion">Version de Process Studio</param>
        /// <returns>Informations sur la mise à jour disponible ou null si aucune mise à jour</returns>
        Task<ComponentUpdateInfo> CheckForUpdateAsync(int componentId, string clientId, string installedVersion, string platformVersion);
        
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
        /// Récupère la liste des versions d'un composant
        /// </summary>
        Task<List<VersionViewModel>> GetComponentVersionsAsync(int componentId);
        
        /// <summary>
        /// Récupère les détails d'une version spécifique
        /// </summary>
        Task<VersionViewModel> GetComponentVersionAsync(int versionId);
        
        /// <summary>
        /// Crée une nouvelle version pour un composant
        /// </summary>
        Task<int> CreateComponentVersionAsync(int componentId, ComponentVersionCreateViewModel model);
        
        /// <summary>
        /// Met à jour une version existante
        /// </summary>
        Task<bool> UpdateComponentVersionAsync(int versionId, ComponentVersionCreateViewModel model);
        
        /// <summary>
        /// Récupère les clients qui utilisent une version spécifique d'un composant
        /// </summary>
        Task<List<ClientInstallationViewModel>> GetClientsByComponentVersionAsync(int componentId, string version);
        
        /// <summary>
        /// Définit une version comme étant la dernière version du composant
        /// </summary>
        Task<bool> SetLatestVersionAsync(int componentId, int versionId);
        
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
        
        /// <summary>
        /// Vérifie si un composant existe avec l'URL de dépôt GitHub spécifiée
        /// </summary>
        /// <param name="repositoryUrl">URL du dépôt GitHub à vérifier</param>
        /// <returns>Le composant trouvé ou null si aucun composant n'existe avec cette URL</returns>
        Task<Component> GetComponentByRepositoryUrlAsync(string repositoryUrl);
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
        public string? RepositoryUrl { get; set; }
    }
    
    /// <summary>
    /// Informations sur la mise à jour d'un composant
    /// </summary>
    public class ComponentUpdateInfo
    {
        /// <summary>
        /// Numéro de version disponible pour la mise à jour
        /// </summary>
        public string AvailableVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// Version actuellement installée
        /// </summary>
        public string InstalledVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// Version minimale de Process Studio requise pour cette mise à jour
        /// </summary>
        public string MinPlatformVersion { get; set; } = string.Empty;
        
        /// <summary>
        /// URL de téléchargement du package
        /// </summary>
        public string DownloadUrl { get; set; } = string.Empty;
        
        /// <summary>
        /// Notes de version / Changelog
        /// </summary>
        public string ChangeLog { get; set; } = string.Empty;
        
        /// <summary>
        /// Indique si la mise à jour nécessite un redémarrage de Process Studio
        /// </summary>
        public bool RequiresRestart { get; set; }
        
        /// <summary>
        /// Indique si la mise à jour est compatible avec la version actuelle de Process Studio
        /// </summary>
        public bool IsCompatibleWithCurrentPlatform { get; set; }
    }
}