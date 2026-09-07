# ---- etape de build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- etape runtime ----
# Note : on tourne en root pour pouvoir lire /var/run/docker.sock.
# Pour durcir : cree un groupe avec le meme GID que 'docker' sur l'hote
# (group_add: <gid_host_docker>) et passe a USER node.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 9999
CMD ["node", "dist/index.js"]