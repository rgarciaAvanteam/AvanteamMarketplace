using System;

namespace AvanteamMarketplace.API.Pages
{
    public class ErrorViewModel
    {
        public string RequestId { get; set; }

        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
        
        public string ErrorMessage { get; set; }
        
        public int StatusCode { get; set; }
    }
}