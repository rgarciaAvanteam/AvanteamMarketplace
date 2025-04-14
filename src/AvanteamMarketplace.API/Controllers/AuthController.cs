using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;

namespace AvanteamMarketplace.API.Controllers
{
    /// <summary>
    /// Contrôleur d'API pour l'authentification
    /// </summary>
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// Vérifie la validité d'une clé d'administration
        /// </summary>
        /// <param name="key">Clé d'administration à vérifier</param>
        /// <returns>True si la clé est valide</returns>
        [HttpGet("validate")]
        public IActionResult ValidateAdminKey([FromQuery] string key)
        {
            if (string.IsNullOrEmpty(key))
            {
                return BadRequest(new { success = false, message = "Aucune clé fournie" });
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

            bool isValid = key == configuredKey;

            return Ok(new { success = isValid });
        }

        /// <summary>
        /// Vérifie si l'utilisateur est authentifié
        /// </summary>
        [HttpGet("status")]
        public IActionResult GetAuthStatus()
        {
            bool isAuthenticated = Request.Cookies.ContainsKey("AdminToken");
            return Ok(new { isAuthenticated });
        }
    }
}