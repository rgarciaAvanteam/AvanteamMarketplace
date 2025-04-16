<%@ Page Language="C#" AutoEventWireup="true" CodeFile="Default.aspx.cs" Inherits="Custom_Marketplace_Default" %>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title><asp:Literal runat="server" Text="<%$ Resources:MarketplaceTitle %>" /></title>
    <link href="css/marketplace.css" rel="stylesheet" type="text/css" />
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
            
            <div class="marketplace-search">
                <input type="text" id="search-components" placeholder='<asp:Literal runat="server" Text="<%$ Resources:SearchPlaceholder %>" />' />
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
        <asp:HiddenField ID="hfPlatformVersion" runat="server" />
        <asp:HiddenField ID="hfApiUrl" runat="server" />
        <asp:HiddenField ID="hfApiKey" runat="server" />
        <asp:HiddenField ID="hfClientId" runat="server" />
        
        <script type="text/javascript">
            // Configuration pour le JavaScript
            var platformVersion = '<%= PlatformVersion %>';
            var apiUrl = '<%= ApiUrl %>';
            var apiKey = '<%= ApiKey %>';
            var clientId = '<%= ClientId %>';
        </script>
        <script src="js/marketplace/marketplace.js" type="text/javascript"></script>
    </form>
</body>
</html>