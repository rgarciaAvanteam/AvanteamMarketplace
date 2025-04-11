# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- Build complete solution: `dotnet build AvanteamMarketplace.sln`
- Deploy marketplace API: `.\DeployApiToIIS.ps1`
- Deploy client module: `.\DeployClientModule.ps1`
- Run component installation: `.\scripts\install-component.ps1`
- Generate API key: `.\scripts\generate-api-key.ps1`
- Test installation: `.\scripts\run-test-installation.ps1`
- Update CORS config: `.\scripts\update-cors-config.ps1`

## Code Style Guidelines
- C# Code:
  - 4-space indentation, BSD-style braces
  - XML documentation for public APIs
  - PascalCase for types/members, camelCase with underscore prefix for fields
  - Nullable reference types enabled
  - Async methods with Async suffix
  - Exception handling with try/catch blocks

- JavaScript:
  - 4-space indentation
  - camelCase for variables/functions
  - Semicolons required
  - Descriptive error handling with console.error()
  - Prefer vanilla JS for marketplace functionality

- General:
  - Organize imports with system imports first
  - Use dependency injection for services
  - Follow RESTful API patterns
  - One class per file, files named after primary class