using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

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
        private readonly IMemoryCache _cache;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            IConfiguration configuration,
            IMemoryCache cache,
            IHttpClientFactory httpClientFactory,
            ILogger<AuthController> logger)
        {
            _configuration = configuration;
            _cache = cache;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        /// <summary>
        /// Démarrer l'authentification Azure AD
        /// </summary>
        /// <param name="redirectUri">URI de redirection après authentification</param>
        /// <returns>Redirection vers la page de login Azure AD</returns>
        [HttpGet("login")]
        public IActionResult Login([FromQuery] string redirectUri)
        {
            try
            {
                if (string.IsNullOrEmpty(redirectUri))
                {
                    return BadRequest("L'URI de redirection est requis");
                }

                // Générer un state unique pour cette demande d'authentification
                var state = Guid.NewGuid().ToString();
                
                // Sauvegarder le redirectUri avec le state pour le callback
                _cache.Set($"auth_redirect_{state}", redirectUri, TimeSpan.FromMinutes(10));
                
                // Construire l'URL d'authentification Azure AD
                var tenantId = _configuration["AzureAd:TenantId"];
                var clientId = _configuration["AzureAd:ClientId"];
                var scope = "openid profile email User.Read";
                var responseType = "code";
                var responseMode = "query";
                
                var callbackUrl = Url.Action("Callback", "Auth", null, Request.Scheme, Request.Host.Value) ?? 
                                $"{Request.Scheme}://{Request.Host}/api/auth/callback";
                
                _logger.LogInformation($"Callback URL: {callbackUrl}");
                
                var authUrl = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize" +
                            $"?client_id={clientId}" +
                            $"&response_type={responseType}" +
                            $"&redirect_uri={Uri.EscapeDataString(callbackUrl)}" +
                            $"&response_mode={responseMode}" +
                            $"&scope={Uri.EscapeDataString(scope)}" +
                            $"&state={state}";
                
                _logger.LogInformation($"Redirection vers Azure AD: {authUrl}");
                
                return Redirect(authUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de l'initialisation de l'authentification Azure AD");
                return StatusCode(500, "Une erreur s'est produite lors de l'initialisation de l'authentification");
            }
        }

        /// <summary>
        /// Endpoint de callback appelé par Azure AD après authentification
        /// </summary>
        /// <param name="code">Code d'autorisation</param>
        /// <param name="state">State pour vérifier la session</param>
        /// <param name="error">Erreur éventuelle</param>
        /// <returns>Redirection vers l'application cliente avec un token</returns>
        [HttpGet("callback")]
        public async Task<IActionResult> Callback([FromQuery] string code = null, [FromQuery] string state = null, [FromQuery] string error = null)
        {
            try
            {
                // Journaliser tous les paramètres de la requête pour le débogage
                var queryParams = HttpContext.Request.Query;
                var allParams = string.Join(", ", queryParams.Select(p => $"{p.Key}={(p.Value.Count > 0 ? p.Value[0] : "null")}"));
                _logger.LogInformation($"Callback reçu avec paramètres: {allParams}");
                
                // Résoudre le problème "The error field is required" en initialisant error
                error = error ?? string.Empty;
                
                if (!string.IsNullOrEmpty(error))
                {
                    _logger.LogWarning($"Erreur retournée par Azure AD: {error}");
                    return BadRequest(new { error, message = $"Erreur d'authentification: {error}" });
                }
                
                string redirectUri;
                
                // Si state est fourni, vérifier la session dans le cache
                if (!string.IsNullOrEmpty(state))
                {
                    if (!_cache.TryGetValue($"auth_redirect_{state}", out redirectUri))
                    {
                        _logger.LogWarning("Session expirée ou invalide pour le state: " + state);
                        // Utiliser une URL relative simple pour callback.html - le client ajoutera le bon préfixe
                        redirectUri = "/Custom/MarketPlace/auth-callback.html";
                    }
                }
                else
                {
                    // Fallback pour les appels directs sans state
                    _logger.LogWarning("Appel de callback sans state, utilisation de l'URI par défaut");
                    // Utiliser une URL relative simple pour callback.html - le client ajoutera le bon préfixe
                    redirectUri = "/Custom/MarketPlace/auth-callback.html";
                }
                
                if (string.IsNullOrEmpty(code))
                {
                    _logger.LogWarning($"Code d'autorisation manquant - redirection vers: {redirectUri}");
                    return Redirect($"{redirectUri}?error=no_code&message=Code%20d%27autorisation%20manquant");
                }
                
                // Échanger le code contre un token Azure AD
                var tenantId = _configuration["AzureAd:TenantId"];
                var clientId = _configuration["AzureAd:ClientId"];
                var clientSecret = _configuration["AzureAd:ClientSecret"];
                var callbackUrl = Url.Action("Callback", "Auth", null, Request.Scheme, Request.Host.Value) ?? 
                               $"{Request.Scheme}://{Request.Host}/api/auth/callback";
                
                var tokenEndpoint = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
                
                using var httpClient = _httpClientFactory.CreateClient();
                var tokenRequest = new Dictionary<string, string>
                {
                    ["grant_type"] = "authorization_code",
                    ["client_id"] = clientId,
                    ["client_secret"] = clientSecret,
                    ["code"] = code,
                    ["redirect_uri"] = callbackUrl
                };
                
                var response = await httpClient.PostAsync(tokenEndpoint, new FormUrlEncodedContent(tokenRequest));
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Échec lors de l'obtention du token Azure AD: {errorContent}");
                    return Redirect($"{redirectUri}?error=token_exchange_failed&message=Échec%20lors%20de%20l%27obtention%20du%20token");
                }
                
                var tokenResponse = await response.Content.ReadFromJsonAsync<JsonElement>();
                var accessToken = tokenResponse.GetProperty("access_token").GetString();
                var idToken = tokenResponse.GetProperty("id_token").GetString();
                
                // Valider et décoder le token ID pour obtenir les informations utilisateur
                var handler = new JwtSecurityTokenHandler();
                var idTokenObj = handler.ReadJwtToken(idToken);
                
                // Extraire les informations utilisateur
                var name = idTokenObj.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
                var email = idTokenObj.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == "preferred_username")?.Value;
                var oid = idTokenObj.Claims.FirstOrDefault(c => c.Type == "oid")?.Value;
                
                // Vérifier si l'utilisateur appartient au domaine Avanteam
                bool isAvanteamUser = false;
                if (!string.IsNullOrEmpty(email))
                {
                    isAvanteamUser = email.EndsWith("@avanteam.fr", StringComparison.OrdinalIgnoreCase) ||
                                  email.EndsWith("@avanteam-online.com", StringComparison.OrdinalIgnoreCase);
                }
                
                // Vérifier les rôles (si disponibles)
                var rolesClaim = idTokenObj.Claims.Where(c => c.Type == "roles").Select(c => c.Value).ToList();
                var isAdmin = rolesClaim.Contains("MarketplaceAdmin");
                
                // Mode initial: si l'utilisateur est d'Avanteam, on lui donne les droits admin
                // En production, il faudrait ajouter des rôles dans Azure AD
                if (isAvanteamUser)
                {
                    isAdmin = true;
                }
                
                // Si l'utilisateur n'est pas d'Avanteam, rediriger avec erreur
                if (!isAvanteamUser)
                {
                    return Redirect($"{redirectUri}?error=unauthorized&message=Seuls%20les%20utilisateurs%20Avanteam%20peuvent%20se%20connecter");
                }
                
                // Créer un jeton de session Marketplace
                var marketplaceToken = GenerateMarketplaceToken(oid, name, email, isAdmin);
                
                _logger.LogInformation($"Authentification réussie pour {email}. Admin: {isAdmin}");
                
                // Vérifier que l'URL de redirection ne contient pas de duplication
                // Si redirectUri contient déjà "Custom/MarketPlace", s'assurer de ne pas l'ajouter en double
                if (redirectUri.EndsWith("Custom/MarketPlace/auth-callback.html"))
                {
                    // L'URL est déjà correcte et formatée
                    _logger.LogInformation($"Redirection finale vers: {redirectUri}?token=***");
                    return Redirect($"{redirectUri}?token={marketplaceToken}");
                }
                else if (redirectUri.Contains("Custom/MarketPlace"))
                {
                    // Il y a peut-être un problème de duplication, tenter de le corriger
                    var correctedUri = redirectUri.Replace("Custom/MarketPlace", "") + "Custom/MarketPlace/auth-callback.html";
                    _logger.LogWarning($"URL de redirection potentiellement problématique détectée et corrigée: {redirectUri} -> {correctedUri}");
                    return Redirect($"{correctedUri}?token={marketplaceToken}");
                }
                else
                {
                    // URL standard sans Custom/MarketPlace dedans, ajouter le chemin standard
                    _logger.LogInformation($"Redirection finale via URL standard: {redirectUri}?token=***");
                    return Redirect($"{redirectUri}?token={marketplaceToken}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors du traitement du callback Azure AD");
                return StatusCode(500, "Une erreur s'est produite lors du traitement de l'authentification");
            }
        }

        /// <summary>
        /// Valide un jeton de session Marketplace
        /// </summary>
        /// <param name="request">Requête contenant le token à valider</param>
        /// <returns>Résultat de la validation</returns>
        [HttpPost("validate")]
        public IActionResult ValidateToken([FromBody] TokenValidationRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Token))
                {
                    return Ok(new { isValid = false });
                }
                
                // Valider le jeton
                var principal = ValidateMarketplaceToken(request.Token);
                
                // Récupérer les claims
                var nameIdentifier = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var name = principal.FindFirst(ClaimTypes.Name)?.Value;
                var email = principal.FindFirst(ClaimTypes.Email)?.Value;
                var isAdmin = principal.HasClaim(c => c.Type == "IsAvanteamAdmin" && c.Value == "true");
                
                return Ok(new
                {
                    isValid = true,
                    userId = nameIdentifier,
                    name = name,
                    email = email,
                    isAdmin = isAdmin
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la validation du token");
                return Ok(new { isValid = false });
            }
        }

        /// <summary>
        /// Vérifie la validité d'une clé d'administration (pour la compatibilité)
        /// </summary>
        /// <param name="key">Clé d'administration à vérifier</param>
        /// <returns>True si la clé est valide</returns>
        [HttpGet("validate-admin-key")]
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
        /// Vérifie si l'utilisateur est authentifié via cookie
        /// </summary>
        [HttpGet("status")]
        public IActionResult GetAuthStatus()
        {
            bool isAuthenticated = Request.Cookies.ContainsKey("AdminToken");
            return Ok(new { isAuthenticated });
        }

        // Méthode pour générer un jeton de session Marketplace
        private string GenerateMarketplaceToken(string userId, string name, string email, bool isAdmin)
        {
            // Récupérer la clé de signature depuis la configuration
            var secretKeyString = _configuration["MarketplaceAuth:SecretKey"];
            if (string.IsNullOrEmpty(secretKeyString))
            {
                // Générer une clé aléatoire si non configurée
                secretKeyString = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
                _logger.LogWarning("Clé de signature non configurée, utilisation d'une clé temporaire");
            }
            
            var secretKeyBytes = Encoding.UTF8.GetBytes(secretKeyString);
            var securityKey = new SymmetricSecurityKey(secretKeyBytes);
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
            
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId ?? Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Name, name ?? "Utilisateur Avanteam"),
                new Claim(ClaimTypes.Email, email ?? "noemail@avanteam.fr")
            };
            
            if (isAdmin)
            {
                claims.Add(new Claim("IsAvanteamAdmin", "true"));
            }
            
            // Configurer l'émetteur et l'audience
            var issuer = _configuration["MarketplaceAuth:Issuer"] ?? "AvanteamMarketplace";
            var audience = _configuration["MarketplaceAuth:Audience"] ?? "MarketplaceClients";
            
            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials
            );
            
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // Méthode pour valider un jeton de session Marketplace
        private ClaimsPrincipal ValidateMarketplaceToken(string token)
        {
            // Récupérer la clé de signature depuis la configuration
            var secretKeyString = _configuration["MarketplaceAuth:SecretKey"];
            if (string.IsNullOrEmpty(secretKeyString))
            {
                throw new InvalidOperationException("Clé de signature non configurée");
            }
            
            var secretKeyBytes = Encoding.UTF8.GetBytes(secretKeyString);
            
            // Configurer l'émetteur et l'audience
            var issuer = _configuration["MarketplaceAuth:Issuer"] ?? "AvanteamMarketplace";
            var audience = _configuration["MarketplaceAuth:Audience"] ?? "MarketplaceClients";
            
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(secretKeyBytes)
            };
            
            var handler = new JwtSecurityTokenHandler();
            return handler.ValidateToken(token, validationParameters, out _);
        }
    }

    public class TokenValidationRequest
    {
        public string Token { get; set; }
    }
}