@echo off
chcp 65001 >nul 2>&1
title Learning Platform

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

cd /d "%~dp0"
start "" http://localhost:8080
python -m http.server 8080
