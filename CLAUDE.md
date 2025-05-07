# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- Build complete solution: `dotnet build AvanteamMarketplace.sln`
- Deploy marketplace API: `.\DeployApiToIIS.ps1` 
- Deploy client module: `.\DeployClientModule.ps1`
- Run a single test: `dotnet test --filter "FullyQualifiedName=Namespace.TestClass.TestMethod"`
- Recycle IIS application pool: `.\recycle-apppool.bat`
- Generate API key: `.\scripts\generate-api-key.ps1`
- Create deployment package: `.\scripts\create-deployment-package.ps1`
- Update marketplace secrets: `.\scripts\update-secrets.ps1`

## Project Structure

### Administration Interface
- **Path**: `/src/AvanteamMarketplace.API/`
- **Main View**: `/src/AvanteamMarketplace.API/Pages/Admin/Index.cshtml`
- **JavaScript**: `/src/AvanteamMarketplace.API/wwwroot/js/admin/` 
  - `admin-apikeys.js`: API key management
  - `admin-components.js`: Component management
  - `admin-versions.js`: Version management
  - `admin-ui.js`: General UI
- **CSS**: `/src/AvanteamMarketplace.API/wwwroot/css/admin.css`
- **API Controllers**: `/src/AvanteamMarketplace.API/Controllers/ComponentsManagementController.cs`
- **Login**: `/src/AvanteamMarketplace.API/wwwroot/simple-login.html`

### Client Interface
- **Path**: `/PSTUDIO-CLIENT/app/Custom/MarketPlace/`
- **JavaScript**: `/PSTUDIO-CLIENT/app/Custom/MarketPlace/js/marketplace/`
  - `modules/ui.js`: Client user interface, installation and error handling
  - `modules/components.js`: Component management and caching
  - `modules/auth.js`: Authentication and permissions
- **CSS**: `/PSTUDIO-CLIENT/app/Custom/MarketPlace/css/`

### Core Models
- **Path**: `/src/AvanteamMarketplace.Core/Models/`
- Key Models:
  - `ApiKey.cs`: API keys for authentication
  - `Component.cs`: Marketplace components
  - `ComponentVersion.cs`: Component versions
  - `InstalledComponent.cs`: Installed components
  - `ClientInstallation.cs`: Client installations

### Infrastructure
- **Path**: `/src/AvanteamMarketplace.Infrastructure/`
- **Services**: `/src/AvanteamMarketplace.Infrastructure/Services/`
- **Database**: `/src/AvanteamMarketplace.Infrastructure/Data/MarketplaceDbContext.cs`

## Recent Features (2025)
- Display of installed components in admin interface when selecting an API key
- Component status indicators: up-to-date, update available, no longer supported
- Advanced search and filtering system for components
- Improved version management with compatibility checking
- Enhanced error handling for 502 Bad Gateway errors during component installation
- Optimized streaming connection with improved ping frequency (15s) for installation logs

## Code Style Guidelines
- C# Code:
  - 4-space indentation, BSD-style braces
  - XML documentation for public APIs
  - PascalCase for types/members, camelCase with underscore prefix for fields
  - Nullable reference types enabled
  - Async methods with Async suffix
  - Try/catch blocks for proper error handling

- JavaScript:
  - 4-space indentation with semicolons
  - camelCase for variables/functions
  - Clear JSDoc comments for functions
  - Descriptive error logging with console.error()
  - Modular architecture with mediator pattern

- General:
  - System imports first, then project imports
  - Dependency injection for services
  - RESTful API patterns
  - Clear and concise commit messages
  - One class per file, named after the primary class