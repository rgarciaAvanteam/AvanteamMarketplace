using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AvanteamMarketplace.API
{
    [Route("admin/logout")]
    [ApiController]
    public class DirectLogoutController : ControllerBase
    {
        [HttpGet]
        public IActionResult Logout()
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
            
            // Retourner une page HTML qui redirige automatiquement
            var html = @"
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv='refresh' content='0;url=/admin' />
    <title>Déconnexion...</title>
</head>
<body>
    <p>Déconnexion en cours...</p>
</body>
</html>";
            
            return new ContentResult
            {
                Content = html,
                ContentType = "text/html",
                StatusCode = 200
            };
        }
    }
}