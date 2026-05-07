@echo off
title Lapendaz Infinity - Production
color 0A
echo.
echo  ===============================================
echo   Lapendaz Infinity - Starting Production Mode
echo  ===============================================
echo.
echo  No more page refreshes! Stable for meetings.
echo  Server: http://localhost:3001
echo.
cd /d %~dp0
set PORT=3001
npm start
