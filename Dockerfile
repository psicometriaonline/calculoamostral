# Site calculoamostral.com.br — build e execução
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# embedded-postgres é opcional (só para testes) e fica fora da imagem
RUN npm ci --legacy-peer-deps --omit=optional
COPY . .
RUN npm run build && npm prune --omit=dev --omit=optional --legacy-peer-deps

FROM node:20-bookworm-slim
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
