@echo off
title Hayashi Print Server
color 0A
echo.
echo  ==========================================
echo    HAYASHI PRINT SERVER
echo    Conectado ao Render — Elgin L42 USB
echo  ==========================================
echo.
cd /d "%~dp0"
node server.js
pause
