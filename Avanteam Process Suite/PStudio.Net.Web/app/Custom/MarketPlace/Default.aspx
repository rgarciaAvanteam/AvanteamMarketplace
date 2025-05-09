<%@ Page Language="C#" AutoEventWireup="true" CodeFile="Default.aspx.cs" Inherits="Custom_Marketplace_Default" %>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title><asp:Literal runat="server" Text="<%$ Resources:MarketplaceTitle %>" /></title>
    <link href="css/marketplace.css" rel="stylesheet" type="text/css" />
    <link href="css/marketplace-filters.css" rel="stylesheet" type="text/css" />
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet" />
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>
<body>
    <form id="form1" runat="server">
        <div class="marketplace-container">
            <div class="marketplace-header">
                <h1><img src="images/marketplace-logo.svg" alt="Logo" class="marketplace-logo" /> <asp:Literal runat="server" Text="<%$ Resources:MarketplaceTitle %>" /></h1>
                <p class="marketplace-description"><asp:Literal runat="server" Text="<%$ Resources:MarketplaceDescription %>" /></p>
                <div class="marketplace-version">
                    <span class="version-label"><asp:Literal runat="server" Text="<%$ Resources:PlatformVersion %>" />:</span>
                    <span class="version-value"><%= PlatformVersion %></span>
                </div>
            </div>
            
            <div class="marketplace-tabs">
                <div class="tab-btn active" data-tab="compatible"><asp:Literal runat="server" Text="<%$ Resources:TabCompatible %>" /></div>
                <div class="tab-btn" data-tab="updates"><asp:Literal runat="server" Text="<%$ Resources:TabUpdates %>" /></div>
                <div class="tab-btn" data-tab="future"><asp:Literal runat="server" Text="<%$ Resources:TabFuture %>" /></div>
            </div>
            
            <div class="marketplace-filters">
                <div class="marketplace-search">
                    <input type="text" id="search-components" placeholder='<asp:Literal runat="server" Text="<%$ Resources:SearchPlaceholder %>" />' />
                </div>
                
                <div class="installed-filter">
                    <label class="switch-container">
                        <input type="checkbox" id="show-installed-only" />
                        <span class="switch-slider"></span>
                        <span class="switch-label">N'afficher que les composants install&#233;s</span>
                    </label>
                </div>
            </div>
            
            <div class="tab-content active" id="compatible-tab">
                <div class="component-grid" id="compatible-components">
                    <div class="loading"><asp:Literal runat="server" Text="<%$ Resources:Loading %>" /></div>
                </div>
            </div>
            
            <div class="tab-content" id="updates-tab">
                <div class="component-grid" id="updates-components">
                    <div class="loading"><asp:Literal runat="server" Text="<%$ Resources:Loading %>" /></div>
                </div>
            </div>
            
            <div class="tab-content" id="future-tab">
                <div class="component-grid" id="future-components">
                    <div class="loading"><asp:Literal runat="server" Text="<%$ Resources:Loading %>" /></div>
                </div>
            </div>
        </div>
        
        <!-- Valeurs pour JavaScript -->
        <asp:HiddenField ID="hfPlatformVersion" runat="server" Value="<%= PlatformVersion %>" />
        <asp:HiddenField ID="hfApiUrl" runat="server" Value="<%= ApiUrl %>" />
        <asp:HiddenField ID="hfApiKey" runat="server" Value="<%= ApiKey %>" />
        <asp:HiddenField ID="hfClientId" runat="server" Value="<%= ClientId %>" />
        
        <!-- Stocker la configuration dans localStorage pour prévenir les pertes dans les iframes -->
        <script type="text/javascript">
            // Configuration pour le JavaScript
            var platformVersion = '<%= PlatformVersion %>';
            var apiUrl = '<%= ApiUrl %>';
            var apiKey = '<%= ApiKey %>';
            var clientId = '<%= ClientId %>';
            
            // IMMÉDIATEMENT stocker les valeurs dans l'objet window
            window.platformVersion = platformVersion;
            window.apiUrl = apiUrl;
            window.apiKey = apiKey;
            window.clientId = clientId;
            
            // Stocker également dans localStorage pour récupération entre les rechargements/iframes
            try {
                // Vérifier que localStorage est disponible
                if (window.localStorage) {
                    localStorage.setItem('marketplace_platformVersion', platformVersion);
                    localStorage.setItem('marketplace_apiUrl', apiUrl);
                    localStorage.setItem('marketplace_apiKey', apiKey);
                    localStorage.setItem('marketplace_clientId', clientId);
                    localStorage.setItem('marketplace_configTimestamp', new Date().getTime());
                }
            } catch (e) {
                // Erreur silencieuse
            }
            
            // Configuration chargée, nous n'avons plus besoin d'indicateur visuel
        </script>
        
        <!-- Charger le médiateur (DOIT être chargé en premier) -->
        <script src="js/marketplace/core/mediator.js" type="text/javascript"></script>
        
        <!-- Charger les modules principaux -->
        <script src="js/marketplace/core/utils.js" type="text/javascript"></script>
        <script src="js/marketplace/core/config.js" type="text/javascript"></script>
        
        <!-- Charger les modules fonctionnels -->
        <script src="js/marketplace/modules/auth.js" type="text/javascript"></script>
        <script src="js/marketplace/modules/components.js" type="text/javascript"></script>
        <script src="js/marketplace/modules/filters.js" type="text/javascript"></script>
        <script src="js/marketplace/modules/ui.js" type="text/javascript"></script>
        
        <!-- Charger le module principal d'initialisation (DOIT être chargé en dernier) -->
        <script src="js/marketplace/main.js" type="text/javascript"></script>
    </form>
</body>
</html>