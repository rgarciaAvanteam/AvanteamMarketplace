@echo off
REM Script d'installation du Marketplace Avanteam (lance PowerShell avec droits administratifs)
REM Ce fichier permet de lancer le script d'installation directement depuis l'explorateur Windows
echo Lancement du script d'installation du Marketplace Avanteam...
echo.
echo ATTENTION: Cette operation necessite des droits administrateur.
echo.
echo Une fenetre d'elevation de privileges va s'ouvrir. Veuillez l'accepter pour continuer.
echo.
timeout /t 3 > nul
REM Lancer PowerShell avec droits administratifs et se placer dans le répertoire du script
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '%~dp0install-marketplace.ps1' -Verb RunAs"
echo.
echo Si vous ne voyez pas de fenetre PowerShell s'ouvrir, veuillez executer le script install-marketplace.ps1 manuellement en tant qu'administrateur.
echo.
echo Appuyez sur une touche pour quitter...
pause > nul