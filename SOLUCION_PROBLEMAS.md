# Solución de Problemas - Kopi

## Problema: "CONECTANDO..." en Puerto 8181

### Causa
El error ocurre cuando hay instancias previas de Kopi corriendo que están ocupando el puerto 8181 (o los puertos alternativos 8282, 8383, 8484).

### Solución Rápida

1. **Cerrar todas las instancias de Kopi:**
   ```bash
   npm run kill
   ```
   O ejecutar manualmente:
   ```bash
   taskkill /F /IM Kopi.exe
   ```

2. **Verificar que los puertos estén libres:**
   ```bash
   node test-port.cjs
   ```

3. **Iniciar Kopi nuevamente:**
   ```bash
   npm run dev
   ```

### Verificación de Puertos

Para ver qué proceso está usando un puerto específico:
```bash
netstat -ano | findstr "8181"
```

Para identificar el proceso por PID:
```bash
tasklist /FI "PID eq [PID_AQUI]"
```

### Mejoras Implementadas

1. **Logs mejorados**: Ahora se guardan en `kopi_main.log` en el escritorio
2. **Manejo de errores**: El servidor reporta errores detallados al UI
3. **Host configurado**: Cambiado de `0.0.0.0` a `127.0.0.1` para evitar problemas de firewall
4. **Timeout de inicio**: El servidor tiene 5 segundos para iniciar antes de fallar
5. **Múltiples puertos**: Intenta 8181, 8282, 8383, 8484 automáticamente

### Archivos de Log

- **Desktop/kopi_main.log**: Log principal de la aplicación Electron
- **Console**: Logs del servidor WebSocket

### Scripts Útiles

- `npm run kill`: Cierra todas las instancias de Kopi
- `npm run dev`: Mata instancias previas y inicia en modo desarrollo
- `node test-port.cjs`: Verifica disponibilidad de puertos

### Problemas Comunes

#### 1. Firewall de Windows
Si el firewall bloquea la conexión, agregar excepción para Kopi.exe

#### 2. Antivirus
Algunos antivirus pueden bloquear la generación de certificados TLS

#### 3. Permisos
Ejecutar como administrador si hay problemas con certificados

#### 4. Múltiples instancias
Siempre cerrar instancias previas antes de iniciar una nueva

### Contacto
Para más ayuda, revisar los logs en Desktop/kopi_main.log
