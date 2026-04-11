FROM node:20-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package.json package-lock.json tsconfig.json ./

# Instalar dependencias (solo producción + devDeps para compilar TS)
RUN npm ci

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npx tsc --outDir dist

# Limpiar dev dependencies
RUN npm prune --production

# Exponer puerto
EXPOSE 3500

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3500

# Iniciar la API
CMD ["node", "dist/src/api/server.js"]
