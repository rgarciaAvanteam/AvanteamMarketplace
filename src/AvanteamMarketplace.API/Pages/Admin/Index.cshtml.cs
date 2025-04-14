using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Configuration;
using System;
using System.Diagnostics;

namespace AvanteamMarketplace.API.Pages.Admin
{
    public class IndexModel : PageModel
    {
        private readonly IConfiguration _configuration;
        
        [BindProperty]
        public string? AdminKey { get; set; }
        
        public bool IsAuthenticated { get; private set; }
        
        public string ErrorMessage { get; private set; } = string.Empty;
        
        public string ApiBaseUrl { get; private set; } = string.Empty;
        
        public string AdminToken { get; private set; } = string.Empty;
        
        public IndexModel(IConfiguration configuration)
        {
            _configuration = configuration;
        }
        
        public void OnGet()
        {
            try
            {
                // Vérifier si l'utilisateur est déjà authentifié via cookie
                if (Request.Cookies.TryGetValue("AdminToken", out string? adminToken) && !string.IsNullOrEmpty(adminToken))
                {
                    IsAuthenticated = true;
                    AdminToken = adminToken;
                    
                    // Récupérer l'URL de base de l'API
                    ApiBaseUrl = _configuration["ApiBaseUrl"] ?? 
                                (Request.IsHttps ? 
                                $"https://{Request.Host}/api" : 
                                $"http://{Request.Host}/api");
                }
                else
                {
                    // Vérifier également dans la session (approche alternative)
                    try
                    {
                        var sessionToken = HttpContext.Session.GetString("AdminToken");
                        if (!string.IsNullOrEmpty(sessionToken))
                        {
                            IsAuthenticated = true;
                            AdminToken = sessionToken;
                            
                            // Récupérer l'URL de base de l'API
                            ApiBaseUrl = _configuration["ApiBaseUrl"] ?? 
                                        (Request.IsHttps ? 
                                        $"https://{Request.Host}/api" : 
                                        $"http://{Request.Host}/api");
                        }
                    }
                    catch
                    {
                        // Ignorer les erreurs de session si elles se produisent
                    }
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Erreur lors de l'initialisation: {ex.Message}";
            }
        }
        
        public IActionResult OnPost()
        {
            try
            {
                if (string.IsNullOrEmpty(AdminKey))
                {
                    ErrorMessage = "Veuillez saisir une clé d'administration.";
                    return Page();
                }
                
                // Récupérer la clé depuis toutes les sources possibles - adaptée aux différentes configurations
                var configuredKey = _configuration["ApiKeys:AdminKey"] ?? 
                                  _configuration["AdminKey"] ?? 
                                  Environment.GetEnvironmentVariable("MARKETPLACE_ADMIN_KEY") ??
                                  "admin"; // Clé par défaut si aucune n'est configurée
                
                // Logging pour débogage
                System.Diagnostics.Debug.WriteLine($"Using admin key from config: {(configuredKey?.Length > 3 ? configuredKey.Substring(0, 3) : configuredKey)}...");
                
                // Remplacer le token si nécessaire
                if (configuredKey?.Contains("#{MARKETPLACE_ADMIN_KEY}#") == true)
                {
                    configuredKey = "admin";
                    System.Diagnostics.Debug.WriteLine("Admin key contained placeholder, using default 'admin'");
                }
                
                // Valider la clé d'administration
                if (AdminKey != configuredKey)
                {
                    ErrorMessage = "Clé d'administration invalide.";
                    return Page();
                }
                
                // Stocker la clé d'administration en cookie et session
                Response.Cookies.Append("AdminToken", AdminKey, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.Now.AddHours(1)
                });
                
                try
                {
                    HttpContext.Session.SetString("AdminToken", AdminKey);
                }
                catch
                {
                    // Ignorer les erreurs de session si elles se produisent
                }
                
                IsAuthenticated = true;
                AdminToken = AdminKey;
                
                return Page();
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Erreur lors de l'authentification: {ex.Message}";
                return Page();
            }
        }
        
        public IActionResult OnPostLogout()
        {
            try
            {
                // Effacer le cookie et la session
                Response.Cookies.Delete("AdminToken");
                
                try
                {
                    HttpContext.Session.Remove("AdminToken");
                }
                catch
                {
                    // Ignorer les erreurs de session si elles se produisent
                }
            }
            catch
            {
                // Ignorer les erreurs si elles se produisent
            }
            
            IsAuthenticated = false;
            AdminToken = string.Empty;
            
            return RedirectToPage();
        }
    }
}