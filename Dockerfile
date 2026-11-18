FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY server ./server
COPY client ./client
COPY tsconfig.json ./
RUN npm install && npm run build
ENV NODE_ENV=production
ENV PORT=43123
ENV DATABASE_URL=file:/data/sportspace.db
EXPOSE 43123
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && npx tsx server/src/index.ts"]
