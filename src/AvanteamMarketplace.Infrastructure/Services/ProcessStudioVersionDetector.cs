using System;
using System.Text.RegularExpressions;
using AvanteamMarketplace.Core.Services;

namespace AvanteamMarketplace.Infrastructure.Services
{
    /// <summary>
    /// Implémentation du détecteur de version de Process Studio
    /// </summary>
    public class ProcessStudioVersionDetector : IProcessStudioVersionDetector
    {
        /// <summary>
        /// Vérifie si une version de composant est compatible avec une version de plateforme
        /// </summary>
        public bool IsComponentVersionCompatible(string componentVersion, string platformVersion)
        {
            // Un composant est compatible si la version minimale de plateforme requise
            // est inférieure ou égale à la version actuelle de la plateforme
            return IsPlatformVersionSufficient(componentVersion, platformVersion);
        }
        
        /// <summary>
        /// Vérifie si une version de plateforme est suffisante pour un composant
        /// </summary>
        public bool IsPlatformVersionSufficient(string minPlatformVersion, string platformVersion)
        {
            if (string.IsNullOrEmpty(minPlatformVersion))
                return true;
                
            return CompareVersions(platformVersion, minPlatformVersion) >= 0;
        }
        
        /// <summary>
        /// Vérifie si une version de plateforme ne dépasse pas la version maximale supportée par un composant
        /// </summary>
        public bool IsPlatformVersionNotExceeded(string? maxPlatformVersion, string platformVersion)
        {
            // Si pas de version max définie, le composant n'a pas de limite supérieure
            if (string.IsNullOrEmpty(maxPlatformVersion))
                return true;
                
            // La version de plateforme ne doit pas être supérieure à la version max
            return CompareVersions(platformVersion, maxPlatformVersion) <= 0;
        }
        
        /// <summary>
        /// Vérifie si une version de plateforme est recommandée pour un composant
        /// </summary>
        public bool IsPlatformVersionRecommended(string recommendedPlatformVersion, string platformVersion)
        {
            if (string.IsNullOrEmpty(recommendedPlatformVersion))
                return true;
                
            return CompareVersions(platformVersion, recommendedPlatformVersion) >= 0;
        }
        
        /// <summary>
        /// Compare deux versions et retourne -1, 0 ou 1 selon que v1 est inférieure, égale ou supérieure à v2
        /// </summary>
        public int CompareVersions(string version1, string version2)
        {
            // Ignorer les suffixes comme -beta, -rc, etc.
            string cleanVersion1 = Regex.Replace(version1, "-.*$", "");
            string cleanVersion2 = Regex.Replace(version2, "-.*$", "");
            
            // Séparer les numéros de version
            string[] parts1 = cleanVersion1.Split('.');
            string[] parts2 = cleanVersion2.Split('.');
            
            // Comparer chaque partie
            int maxLength = Math.Max(parts1.Length, parts2.Length);
            
            for (int i = 0; i < maxLength; i++)
            {
                int v1 = (i < parts1.Length) ? int.Parse(parts1[i]) : 0;
                int v2 = (i < parts2.Length) ? int.Parse(parts2[i]) : 0;
                
                if (v1 < v2)
                    return -1;
                    
                if (v1 > v2)
                    return 1;
            }
            
            // Si on arrive ici, les versions sont identiques ou différentes seulement par des suffixes
            
            // Version avec suffixe est considérée comme antérieure
            if (version1.Contains("-") && !version2.Contains("-"))
                return -1;
                
            if (!version1.Contains("-") && version2.Contains("-"))
                return 1;
                
            // Si les deux ont des suffixes, comparer les suffixes
            if (version1.Contains("-") && version2.Contains("-"))
            {
                string suffix1 = version1.Substring(version1.IndexOf("-") + 1);
                string suffix2 = version2.Substring(version2.IndexOf("-") + 1);
                
                // Traiter les cas particuliers comme beta < rc < "" (version finale)
                if (suffix1 == "beta" && suffix2 != "beta")
                    return -1;
                    
                if (suffix1 != "beta" && suffix2 == "beta")
                    return 1;
                    
                if (suffix1 == "rc" && suffix2 != "rc" && suffix2 != "beta")
                    return -1;
                    
                if (suffix1 != "rc" && suffix1 != "beta" && suffix2 == "rc")
                    return 1;
                    
                // Comparer lexicographiquement
                return string.Compare(suffix1, suffix2, StringComparison.OrdinalIgnoreCase);
            }
            
            // Versions sont identiques
            return 0;
        }
    }
}