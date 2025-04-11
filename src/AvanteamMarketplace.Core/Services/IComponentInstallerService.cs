using System.Threading.Tasks;
using AvanteamMarketplace.Core.ViewModels;

namespace AvanteamMarketplace.Core.Services
{
    /// <summary>
    /// Service pour l'installation des composants
    /// </summary>
    public interface IComponentInstallerService
    {
        /// <summary>
        /// Exécute le script PowerShell pour installer un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="version">Version du composant</param>
        /// <param name="packageUrl">URL du package à télécharger</param>
        /// <param name="processStudioRoot">Répertoire racine de Process Studio</param>
        /// <returns>Résultat de l'installation</returns>
        Task<InstallationResultViewModel> InstallComponentAsync(int componentId, string version, string packageUrl, string processStudioRoot);
        
        /// <summary>
        /// Exécute le script PowerShell pour désinstaller un composant
        /// </summary>
        /// <param name="componentId">ID du composant</param>
        /// <param name="processStudioRoot">Répertoire racine de Process Studio (optionnel)</param>
        /// <param name="force">Forcer la désinstallation même s'il y a des dépendances</param>
        /// <returns>Résultat de la désinstallation</returns>
        Task<InstallationResultViewModel> UninstallComponentAsync(int componentId, string processStudioRoot = null, bool force = false);
        
        /// <summary>
        /// Récupère les logs d'installation en temps réel
        /// </summary>
        /// <param name="installId">ID d'installation</param>
        /// <returns>Logs d'installation</returns>
        Task<string> GetInstallationLogsAsync(string installId);
    }
}