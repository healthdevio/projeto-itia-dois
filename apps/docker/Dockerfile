FROM node:26-alpine

WORKDIR /app

COPY apps/packages/knowledge/package.json apps/packages/knowledge/package-lock.json ./knowledge/

WORKDIR /app/knowledge

RUN npm ci

COPY apps/packages/knowledge/drizzle.config.ts ./
COPY apps/packages/knowledge/drizzle ./drizzle
COPY apps/packages/knowledge/src ./src

CMD ["npx", "drizzle-kit", "migrate"]
