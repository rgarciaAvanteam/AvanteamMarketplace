using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AvanteamMarketplace.API.Pages.Admin
{
    public class LogoutModel : PageModel
    {
        public IActionResult OnGet()
        {
            // Effacer le cookie d'authentification
            Response.Cookies.Delete("AdminToken");
            
            // Essayer d'effacer la session
            try
            {
                HttpContext.Session.Remove("AdminToken");
            }
            catch
            {
                // Ignorer les erreurs de session si elles se produisent
            }
            
            // Rediriger vers la page d'accueil après un court délai
            return Page();
        }
    }
}