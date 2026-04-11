@echo off
echo Cerrando todas las instancias de Kopi...
taskkill /F /IM Kopi.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Instancias cerradas correctamente
) else (
    echo ℹ️ No hay instancias de Kopi corriendo
)
pause
