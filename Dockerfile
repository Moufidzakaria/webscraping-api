FROM node:20-bullseye

WORKDIR /usr/src/app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Installer dépendances système pour Playwright
RUN apt-get update && apt-get install -y \
    wget ca-certificates fonts-liberation libnss3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libpangocairo-1.0-0 \
    libasound2 libxshmfence1 libx11-xcb1 libxcb1 libxcb-dri3-0 \
    libxcb-dri2-0 libdrm2 --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Installer Playwright
RUN npx playwright install --with-deps

# Copier le projet
COPY . .

# Builder le projet TypeScript
RUN npm run build

# Exposer le port
ENV PORT=3000
EXPOSE $PORT

# Lancer l'application
CMD ["node", "dist/main.js"]
