using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Configuration;
using AvanteamMarketplace.Core.Services;
using System;
using System.Threading.Tasks;

namespace AvanteamMarketplace.API.Pages.Admin
{
    public class LoginModel : PageModel
    {
        private readonly IConfiguration _configuration;
        private readonly IMarketplaceService _marketplaceService;
        
        [BindProperty]
        public string? AdminKey { get; set; }
        
        public string ErrorMessage { get; set; } = string.Empty;
        
        public LoginModel(IConfiguration configuration, IMarketplaceService marketplaceService)
        {
            _configuration = configuration;
            _marketplaceService = marketplaceService;
        }
        
        public void OnGet()
        {
            // Vérifier si l'utilisateur est déjà authentifié via cookie
            if (Request.Cookies.TryGetValue("AdminToken", out string? adminToken) && !string.IsNullOrEmpty(adminToken))
            {
                // Rediriger vers le tableau de bord admin s'il est déjà connecté
                Response.Redirect("/admin/index");
            }
        }
        
        public async Task<IActionResult> OnPostAsync()
        {
            try
            {
                if (string.IsNullOrEmpty(AdminKey))
                {
                    ErrorMessage = "Veuillez saisir une clé d'administration.";
                    return Page();
                }
                
                bool isValidKey = false;
                string? accessLevel = null;
                
                // Première vérification : clé admin statique (existante)
                var configuredKey = _configuration["ApiKeys:AdminKey"] ?? 
                                  _configuration["AdminKey"] ?? 
                                  Environment.GetEnvironmentVariable("MARKETPLACE_ADMIN_KEY") ??
                                  "admin"; // Clé par défaut si aucune n'est configurée
                
                // Remplacer le token si nécessaire
                if (configuredKey?.Contains("#{MARKETPLACE_ADMIN_KEY}#") == true)
                {
                    configuredKey = "admin";
                }
                
                if (AdminKey == configuredKey)
                {
                    isValidKey = true;
                    accessLevel = "full";
                }
                else
                {
                    // Deuxième vérification : clé API depuis la base de données
                    var apiKeyEntity = await _marketplaceService.ValidateApiKeyForAdminAccessAsync(AdminKey);
                    if (apiKeyEntity != null)
                    {
                        isValidKey = true;
                        // Déterminer le niveau d'accès
                        if (apiKeyEntity.IsAdmin)
                        {
                            accessLevel = "full";
                        }
                        else if (apiKeyEntity.CanAccessAdminInterface && !apiKeyEntity.CanReadAdminInterface)
                        {
                            accessLevel = "write";
                        }
                        else if (apiKeyEntity.CanReadAdminInterface)
                        {
                            accessLevel = "read";
                        }
                        else
                        {
                            accessLevel = "write"; // Par défaut si CanAccessAdminInterface est true
                        }
                    }
                }
                
                if (!isValidKey)
                {
                    ErrorMessage = "Clé d'administration ou clé API invalide.";
                    return Page();
                }
                
                // Stocker la clé d'administration et le niveau d'accès en cookie et session
                Response.Cookies.Append("AdminToken", AdminKey, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.Now.AddHours(1)
                });
                
                // Stocker également le niveau d'accès
                Response.Cookies.Append("AdminAccessLevel", accessLevel ?? "full", new CookieOptions
                {
                    HttpOnly = true,
                    Secure = Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.Now.AddHours(1)
                });
                
                try
                {
                    HttpContext.Session.SetString("AdminToken", AdminKey);
                    HttpContext.Session.SetString("AdminAccessLevel", accessLevel ?? "full");
                }
                catch
                {
                    // Ignorer les erreurs de session si elles se produisent
                }
                
                // Rediriger vers le tableau de bord admin
                return RedirectToPage("/Admin/Index");
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Erreur lors de l'authentification: {ex.Message}";
                return Page();
            }
        }
    }
}