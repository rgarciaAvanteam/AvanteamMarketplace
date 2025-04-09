using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;

namespace AvanteamMarketplace.API
{
    [Route("admin")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AdminController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet]
        public IActionResult Index()
        {
            // Vérifier si le cookie d'authentification existe
            if (Request.Cookies.ContainsKey("AdminToken"))
            {
                return Redirect("/admin/index");
            }
            
            // Rediriger vers le contrôleur de connexion directe
            return Redirect("~/api/login");
        }
    }
}