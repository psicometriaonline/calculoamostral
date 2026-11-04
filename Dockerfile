# Site calculoamostral.com.br — build e execução
FROM node:20-bookworm-slim AS build
WORKDIR /app
# O build precisa das devDependencies (vite, esbuild). O Coolify pode injetar
# NODE_ENV=production como variável de build, então ela é fixada aqui.
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM node:20-bookworm-slim
# wget para o healthcheck do painel do Coolify (ele chama curl ou wget dentro do contêiner)
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
