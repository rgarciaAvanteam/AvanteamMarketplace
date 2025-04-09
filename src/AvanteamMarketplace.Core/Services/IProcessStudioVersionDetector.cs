using System.Threading.Tasks;

namespace AvanteamMarketplace.Core.Services
{
    /// <summary>
    /// Interface pour la détection de la version de Process Studio
    /// </summary>
    public interface IProcessStudioVersionDetector
    {
        /// <summary>
        /// Vérifie si une version de composant est compatible avec une version de plateforme
        /// </summary>
        bool IsComponentVersionCompatible(string componentVersion, string platformVersion);
        
        /// <summary>
        /// Vérifie si une version de plateforme est suffisante pour un composant
        /// </summary>
        bool IsPlatformVersionSufficient(string minPlatformVersion, string platformVersion);
        
        /// <summary>
        /// Vérifie si une version de plateforme est recommandée pour un composant
        /// </summary>
        bool IsPlatformVersionRecommended(string recommendedPlatformVersion, string platformVersion);
        
        /// <summary>
        /// Compare deux versions et retourne -1, 0 ou 1 selon que v1 est inférieure, égale ou supérieure à v2
        /// </summary>
        int CompareVersions(string version1, string version2);
    }
}