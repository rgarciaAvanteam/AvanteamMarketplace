@echo off
echo ==========================================================
echo Création du package de déploiement Marketplace
echo ==========================================================
echo.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "create-deployment-package.ps1"

echo.
echo ==========================================================
echo Appuyez sur une touche pour fermer cette fenêtre...
pause > nul