@echo off
title Generador de Ejecutable AppAbarrotes

echo ======================================================
echo   GENERADOR DE EJECUTABLE - AppAbarrotes
echo ======================================================
echo.

rem Ir al directorio de este script
cd /d "%~dp0"

echo 1. Cerrando AppAbarrotes si esta abierto...
taskkill /F /IM AppAbarrotes.exe /T 2>nul
timeout /t 1 >nul

echo 2. Limpiando archivos temporales antiguos...
if exist "build" rd /s /q "build"
if exist "dist" rd /s /q "dist"

echo 3. Buscando entorno virtual...
set "PY_CMD=python"
if exist "..\..\.venv\Scripts\python.exe" set "PY_CMD=..\..\.venv\Scripts\python.exe"

echo 3. Instalando dependencias...
"%PY_CMD%" -m pip install flask openpyxl pymupdf werkzeug python-docx pyinstaller --quiet

echo 4. Creando ejecutable...
"%PY_CMD%" -m PyInstaller AppAbarrotes.spec

if %errorlevel% equ 0 (
    echo.
    echo EXITO: El ejecutable se ha creado correctamente.
) else (
    echo.
    echo ERROR: Hubo un problema al crear el ejecutable.
)

echo.
pause

