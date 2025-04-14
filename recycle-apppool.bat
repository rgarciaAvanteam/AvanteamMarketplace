@echo off
echo Recycling IIS application pool for Marketplace API...

:: Verify if user is running as Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo This script must be run as Administrator.
  echo Please right-click on the batch file and select "Run as administrator".
  pause
  exit /b 1
)

:: Set default site name or use parameter if provided
set SITE_NAME=marketplace-dev.avanteam-online.com
if not "%~1"=="" set SITE_NAME=%~1

:: Build app pool name
set APP_POOL_NAME=%SITE_NAME%Pool

echo.
echo Stopping website %SITE_NAME%...
%windir%\system32\inetsrv\appcmd stop site "%SITE_NAME%"

echo.
echo Stopping application pool %APP_POOL_NAME%...
%windir%\system32\inetsrv\appcmd stop apppool /apppool.name:"%APP_POOL_NAME%"

:: Delete temporary files
echo.
echo Clearing IIS temporary files...
if exist "C:\inetpub\temp\IIS Temporary Compressed Files\*" (
  del /q /s /f "C:\inetpub\temp\IIS Temporary Compressed Files\*" >nul 2>&1
  echo IIS temporary files cleared.
) else (
  echo No IIS temporary files found.
)

:: Small delay to ensure everything is properly stopped
ping 127.0.0.1 -n 3 >nul

echo.
echo Starting application pool %APP_POOL_NAME%...
%windir%\system32\inetsrv\appcmd start apppool /apppool.name:"%APP_POOL_NAME%"

echo.
echo Starting website %SITE_NAME%...
%windir%\system32\inetsrv\appcmd start site "%SITE_NAME%"

echo.
echo IIS application pool recycled successfully.
echo Please refresh the browser with Ctrl+F5 to clear browser cache.
echo.

pause