using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Configuration;
using System;

namespace AvanteamMarketplace.API.Pages.Admin
{
    public class LoginModel : PageModel
    {
        private readonly IConfiguration _configuration;
        
        [BindProperty]
        public string? AdminKey { get; set; }
        
        public string ErrorMessage { get; set; } = string.Empty;
        
        public LoginModel(IConfiguration configuration)
        {
            _configuration = configuration;
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
        
        public IActionResult OnPost()
        {
            try
            {
                if (string.IsNullOrEmpty(AdminKey))
                {
                    ErrorMessage = "Veuillez saisir une clé d'administration.";
                    return Page();
                }
                
                // Récupérer la clé depuis toutes les sources possibles
                var configuredKey = _configuration["ApiKeys:AdminKey"] ?? 
                                  _configuration["AdminKey"] ?? 
                                  Environment.GetEnvironmentVariable("MARKETPLACE_ADMIN_KEY") ??
                                  "admin"; // Clé par défaut si aucune n'est configurée
                
                // Remplacer le token si nécessaire
                if (configuredKey?.Contains("#{MARKETPLACE_ADMIN_KEY}#") == true)
                {
                    configuredKey = "admin";
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