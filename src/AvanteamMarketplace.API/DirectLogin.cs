using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Text;

namespace AvanteamMarketplace.API
{
    /// <summary>
    /// Contrôleur simple pour l'authentification directe
    /// </summary>
    [Route("api/login")]
    [ApiController]
    public class DirectLoginController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public DirectLoginController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// Vérifie la validité d'une clé d'administration
        /// </summary>
        /// <param name="key">Clé d'administration à vérifier</param>
        /// <returns>True si la clé est valide</returns>
        [HttpGet("check")]
        public IActionResult CheckAdminKey([FromQuery] string key)
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
        /// Génère une page HTML de connexion simple
        /// </summary>
        [HttpGet]
        public ContentResult LoginPage()
        {
            string html = @"<!DOCTYPE html>
<html>
<head>
    <title>Authentification Administrateur</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f5f5f5;
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        h1 {
            text-align: center;
            color: #0066cc;
            margin-top: 0;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: bold;
        }
        input[type=""password""] {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background-color: #0066cc;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.75rem 1rem;
            cursor: pointer;
            width: 100%;
            font-size: 1rem;
        }
        button:hover {
            background-color: #0055aa;
        }
        .error {
            color: #cc0000;
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }
    </style>
</head>
<body>
    <div class=""login-container"">
        <h1>Administration Marketplace</h1>
        <form id=""loginForm"">
            <div class=""form-group"">
                <label for=""adminKey"">Clé d'administration:</label>
                <input type=""password"" id=""adminKey"" name=""adminKey"" required>
            </div>
            <div id=""errorMessage"" class=""error""></div>
            <button type=""submit"">Se connecter</button>
        </form>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const adminKey = document.getElementById('adminKey').value;
            
            if (adminKey === """") {
                document.getElementById('errorMessage').textContent = ""Veuillez saisir une clé d'administration."";
                return;
            }
            
            // Vérifier la clé auprès de l'API
            fetch(`/api/login/check?key=${encodeURIComponent(adminKey)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Stocker la clé dans un cookie
                        document.cookie = `AdminToken=${adminKey}; path=/; max-age=3600; SameSite=Lax; ${location.protocol === 'https:' ? 'Secure;' : ''}`;
                        
                        // Rediriger vers l'interface d'administration
                        window.location.href = ""/admin/index"";
                    } else {
                        document.getElementById('errorMessage').textContent = ""Clé d'administration invalide."";
                    }
                })
                .catch(error => {
                    document.getElementById('errorMessage').textContent = ""Erreur de communication avec le serveur."";
                    console.error('Erreur:', error);
                });
        });
    </script>
</body>
</html>";

            return Content(html, "text/html", Encoding.UTF8);
        }
    }
}