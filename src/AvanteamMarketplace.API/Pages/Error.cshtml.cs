using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using System;
using System.Diagnostics;

namespace AvanteamMarketplace.API.Pages
{
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    [IgnoreAntiforgeryToken]
    public class ErrorModel : PageModel
    {
        public string RequestId { get; set; } = string.Empty;
        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
        
        public string ErrorMessage { get; set; } = string.Empty;
        public int StatusCode { get; set; }
        
        private readonly ILogger<ErrorModel> _logger;

        public ErrorModel(ILogger<ErrorModel> logger)
        {
            _logger = logger;
        }

        public void OnGet()
        {
            RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
            
            if (HttpContext.Response.StatusCode >= 400)
            {
                StatusCode = HttpContext.Response.StatusCode;
                ErrorMessage = GetErrorMessageFromStatusCode(StatusCode);
            }
            else
            {
                StatusCode = 500;
                ErrorMessage = "Une erreur interne s'est produite.";
            }
            
            _logger.LogError($"Erreur {StatusCode}: {ErrorMessage} (RequestId: {RequestId})");
        }
        
        private string GetErrorMessageFromStatusCode(int statusCode)
        {
            return statusCode switch
            {
                400 => "Requête incorrecte. Vérifiez les paramètres fournis.",
                401 => "Authentification requise. Vous devez vous connecter pour accéder à cette ressource.",
                403 => "Accès refusé. Vous n'avez pas les droits nécessaires pour accéder à cette ressource.",
                404 => "Page non trouvée. La ressource demandée n'existe pas.",
                500 => "Erreur interne du serveur. Veuillez réessayer ultérieurement.",
                _ => "Une erreur s'est produite."
            };
        }
    }
}