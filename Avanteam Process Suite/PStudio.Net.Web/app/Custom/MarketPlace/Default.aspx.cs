using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Configuration;
using System.Web.UI;
using System.Security.Cryptography;
using System.Globalization;
using System.Threading;

public partial class Custom_Marketplace_Default : System.Web.UI.Page
{
    /// <summary>
    /// Version détectée de la plateforme Process Studio
    /// </summary>
    protected string PlatformVersion { get; private set; }
    
    /// <summary>
    /// URL de l'API Marketplace
    /// </summary>
    protected string ApiUrl { get; private set; }
    
    /// <summary>
    /// Clé d'API pour l'authentification
    /// </summary>
    protected string ApiKey { get; private set; }
    
    /// <summary>
    /// Identifiant unique du client (basé sur le nom de la machine)
    /// </summary>
    protected string ClientId { get; private set; }
    
    /// <summary>
    /// Initialise la culture de la page en fonction des préférences utilisateur
    /// </summary>
    protected override void InitializeCulture()
    {
        string userLanguage = Request.UserLanguages != null && Request.UserLanguages.Length > 0 ? 
                             Request.UserLanguages[0] : "fr-FR";
        
        if (string.IsNullOrEmpty(userLanguage))
            userLanguage = "fr-FR";
            
        try
        {
            CultureInfo ci = new CultureInfo(userLanguage);
            Thread.CurrentThread.CurrentCulture = ci;
            Thread.CurrentThread.CurrentUICulture = ci;
        }
        catch
        {
            // En cas d'échec, utiliser fr-FR par défaut
            Thread.CurrentThread.CurrentCulture = new CultureInfo("fr-FR");
            Thread.CurrentThread.CurrentUICulture = new CultureInfo("fr-FR");
        }
        
        base.InitializeCulture();
    }
    
    /// <summary>
    /// Gère le chargement de la page
    /// </summary>
    protected void Page_Load(object sender, EventArgs e)
    {
        // S'assurer que la réponse est encodée en UTF-8
        Response.ContentEncoding = Encoding.UTF8;
        
        if (!IsPostBack)
        {
            // Initialise les paramètres nécessaires
            DetectPlatformVersion();
            GetApiUrl();
            GetApiKey();
            GenerateClientId();
            
            // Transmission des paramètres à la page via des champs cachés
            hfPlatformVersion.Value = PlatformVersion;
            hfApiUrl.Value = ApiUrl;
            hfApiKey.Value = ApiKey;
            hfClientId.Value = ClientId;
        }
    }
    
    /// <summary>
    /// Génère un identifiant unique pour ce client basé sur le nom de la machine et le chemin de l'application
    /// </summary>
    private void GenerateClientId()
    {
        string machineName = Environment.MachineName;
        string domainName = Environment.UserDomainName;
        string applicationPath = HttpContext.Current.Request.ApplicationPath ?? "/";
        string physicalPath = Server.MapPath("~");
        
        // Combiner le nom de machine, le domaine et le chemin physique pour l'unicité par site
        string baseString = $"{machineName}.{domainName}.{physicalPath}.ProcessStudio";
        
        // Créer un hash SHA-256 pour l'identifiant client
        using (var sha = SHA256.Create())
        {
            byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(baseString));
            ClientId = BitConverter.ToString(hashBytes).Replace("-", "").Substring(0, 16);
        }
    }
    
    #region Détection de la version de Process Studio
    
    /// <summary>
    /// Détecte la version de Process Studio installée
    /// </summary>
    private void DetectPlatformVersion()
    {
        try
        {
            // Recherche dans plusieurs sources potentielles
            PlatformVersion = ReadVersionFromVersionTxt();
            
            if (string.IsNullOrEmpty(PlatformVersion))
            {
                PlatformVersion = ReadVersionFromProgramsIni();
            }
            
            if (string.IsNullOrEmpty(PlatformVersion))
            {
                PlatformVersion = ReadVersionFromAssembly();
            }
            
            // Si aucune méthode n'a fonctionné, utiliser la version configurée
            if (string.IsNullOrEmpty(PlatformVersion))
            {
                // Lire depuis la configuration Web.config
                string configVersion = ConfigurationManager.AppSettings["ProcessStudioVersion"];
                PlatformVersion = !string.IsNullOrEmpty(configVersion) ? configVersion : "23.10.0";
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Erreur lors de la détection de la version: {ex.Message}");
            
            // Lire depuis la configuration Web.config
            string configVersion = ConfigurationManager.AppSettings["ProcessStudioVersion"];
            PlatformVersion = !string.IsNullOrEmpty(configVersion) ? configVersion : "23.10.0";
        }
    }
    
    /// <summary>
    /// Essaie de lire la version depuis le fichier version.txt à la racine
    /// </summary>
    private string ReadVersionFromVersionTxt()
    {
        try
        {
            // Chercher dans le dossier app directement (remonter d'un niveau depuis Custom/MarketPlace)
            string appVersionPath = Server.MapPath("../../version.txt");
            if (File.Exists(appVersionPath))
            {
                // Essayer d'abord avec UTF-16LE (plus commun sur Windows)
                try
                {
                    string version = File.ReadAllText(appVersionPath, Encoding.Unicode).Trim();
                    System.Diagnostics.Debug.WriteLine($"Contenu brut du fichier version.txt (UTF-16): '{version}'");
                    
                    // Nettoyer tous les caractères sauf les chiffres et le point
                    version = Regex.Replace(version, @"[^\d\.]", "");
                    
                    System.Diagnostics.Debug.WriteLine($"Version après nettoyage: '{version}'");
                    
                    if (!string.IsNullOrEmpty(version))
                    {
                        // Vérifier si la version est au format attendu (ex: 23.10.0 ou 23.5)
                        Regex versionRegex = new Regex(@"^\d+(\.\d+){0,2}$");
                        if (versionRegex.IsMatch(version))
                        {
                            System.Diagnostics.Debug.WriteLine($"Version trouvée dans ../../version.txt: {version}");
                            return version;
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Erreur lors de la lecture UTF-16: {ex.Message}");
                }
                
                // Si UTF-16 échoue, essayer UTF-8
                try
                {
                    string version = File.ReadAllText(appVersionPath, Encoding.UTF8).Trim();
                    
                    // Nettoyer le format - supprimer les préfixes "v" ou "V" si présents
                    if (version.StartsWith("v", StringComparison.OrdinalIgnoreCase))
                    {
                        version = version.Substring(1);
                    }
                    
                    // Nettoyer les espaces ou autres caractères non désirés
                    version = Regex.Replace(version, @"[^\d\.]", "");
                    
                    if (!string.IsNullOrEmpty(version))
                    {
                        // Vérifier si la version est au format attendu (ex: 23.10.0 ou 23.5)
                        Regex versionRegex = new Regex(@"^\d+(\.\d+){0,2}$");
                        if (versionRegex.IsMatch(version))
                        {
                            System.Diagnostics.Debug.WriteLine($"Version trouvée dans ../../version.txt (UTF-8): {version}");
                            return version;
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Erreur lors de la lecture UTF-8: {ex.Message}");
                }
            }
            
            // Chercher dans le répertoire racine du site
            string versionPath = Server.MapPath("~/version.txt");
            
            if (File.Exists(versionPath))
            {
                string version = File.ReadAllText(versionPath, Encoding.UTF8).Trim();
                
                // Nettoyer le format - supprimer les préfixes "v" ou "V" si présents
                if (version.StartsWith("v", StringComparison.OrdinalIgnoreCase))
                {
                    version = version.Substring(1);
                }
                
                // Nettoyer les espaces ou autres caractères non désirés
                version = Regex.Replace(version, @"\s+", "");
                
                if (!string.IsNullOrEmpty(version))
                {
                    // Vérifier si la version est au format attendu (ex: 23.10.0 ou 23.5)
                    Regex versionRegex = new Regex(@"^\d+(\.\d+){0,2}$");
                    if (versionRegex.IsMatch(version))
                    {
                        System.Diagnostics.Debug.WriteLine($"Version trouvée dans ~/version.txt: {version}");
                        return version;
                    }
                }
            }
            
            // Essayer aussi de chercher à la racine de l'application Process Studio
            // (deux niveaux au-dessus si nous sommes dans Custom/Marketplace)
            try
            {
                string rootPath = Server.MapPath("~/../../version.txt");
                if (File.Exists(rootPath))
                {
                    string version = File.ReadAllText(rootPath, Encoding.UTF8).Trim();
                    
                    // Nettoyer le format
                    if (version.StartsWith("v", StringComparison.OrdinalIgnoreCase))
                    {
                        version = version.Substring(1);
                    }
                    
                    // Nettoyer les espaces ou autres caractères non désirés
                    version = Regex.Replace(version, @"\s+", "");
                    
                    if (!string.IsNullOrEmpty(version))
                    {
                        Regex versionRegex = new Regex(@"^\d+(\.\d+){0,2}$");
                        if (versionRegex.IsMatch(version))
                        {
                            System.Diagnostics.Debug.WriteLine($"Version trouvée dans ~/../../version.txt: {version}");
                            return version;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur lecture version.txt racine: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Erreur lecture version.txt: {ex.Message}");
        }
        
        return string.Empty;
    }
    
    /// <summary>
    /// Essaie de lire la version depuis le fichier programs.ini
    /// </summary>
    private string ReadVersionFromProgramsIni()
    {
        try
        {
            string programsPath = Server.MapPath("~/programs.ini");
            
            if (File.Exists(programsPath))
            {
                string content = File.ReadAllText(programsPath, Encoding.UTF8);
                
                // Expression régulière pour extraire la version
                Regex versionRegex = new Regex(@"VERSION\s*=\s*(\d+\.\d+(?:\.\d+)?)");
                Match match = versionRegex.Match(content);
                
                if (match.Success)
                {
                    return match.Groups[1].Value;
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Erreur lecture programs.ini: {ex.Message}");
        }
        
        return string.Empty;
    }
    
    /// <summary>
    /// Essaie de lire la version depuis un assembly de référence Avanteam
    /// </summary>
    private string ReadVersionFromAssembly()
    {
        try
        {
            // Chercher un assembly Avanteam.Kernel ou similaire
            var kernelAssembly = System.Reflection.Assembly.Load("Avanteam.Kernel");
            if (kernelAssembly != null)
            {
                Version version = kernelAssembly.GetName().Version;
                
                // Format Year.Month comme 23.10.0
                if (version.Major > 2000)
                {
                    // Ancienne convention: 2023.10
                    return $"{version.Major - 2000}.{version.Minor}";
                }
                else
                {
                    // Nouvelle convention: directement 23.10
                    return $"{version.Major}.{version.Minor}";
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Erreur lecture assembly: {ex.Message}");
        }
        
        return string.Empty;
    }
    
    #endregion
    
    #region Configuration API
    
    /// <summary>
    /// Détermine l'URL de l'API à utiliser
    /// </summary>
    private void GetApiUrl()
    {
        try
        {
            // Lecture depuis Web.config
            ApiUrl = ConfigurationManager.AppSettings["MarketplaceApiUrl"];
            
            if (string.IsNullOrEmpty(ApiUrl))
            {
                // Si non configurée, utiliser l'URL par défaut
                if (HttpContext.Current.Request.IsLocal)
                {
                    // Pour développement local
                    ApiUrl = "http://localhost:5000/api/marketplace";
                }
                else
                {
                    // Pour production - URL relative
                    ApiUrl = "https://marketplace.avanteam.fr/api/marketplace";
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Erreur récupération URL API: {ex.Message}");
            ApiUrl = "https://marketplace.avanteam.fr/api/marketplace";
        }
    }
    
    /// <summary>
    /// Récupère ou génère la clé API pour l'authentification
    /// </summary>
    private void GetApiKey()
    {
        try
        {
            // Lecture depuis Web.config
            ApiKey = ConfigurationManager.AppSettings["MarketplaceApiKey"];
            
            if (string.IsNullOrEmpty(ApiKey))
            {
                // Générer une clé basée sur le nom de la machine
                string machineName = Environment.MachineName;
                string domainName = Environment.UserDomainName;
                
                using (var sha = SHA256.Create())
                {
                    byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes($"{machineName}.{domainName}.AvanteamMarketplace"));
                    
                    // Formater la clé pour qu'elle soit compatible avec les API REST
                    ApiKey = Convert.ToBase64String(hashBytes)
                        .Replace('+', '-')
                        .Replace('/', '_')
                        .Replace("=", "")
                        .Substring(0, 32);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Erreur récupération clé API: {ex.Message}");
            
            // Générer une clé de secours
            ApiKey = Convert.ToBase64String(Guid.NewGuid().ToByteArray())
                .Replace('+', '-')
                .Replace('/', '_')
                .Replace("=", "");
        }
    }
    
    #endregion
}