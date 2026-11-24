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
EXPOSE 43123
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||43123)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && npx tsx server/src/index.ts"]
