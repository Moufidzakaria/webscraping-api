FROM node:20-bullseye

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# IMPORTANT : installer ps, wget, and fonts
RUN apt-get update && apt-get install -y \
    procps \
    wget \
    gnupg \
    --no-install-recommends

# Installer Playwright + dépendances
RUN npx playwright install --with-deps

COPY . .

EXPOSE 3000

CMD ["node", "dist/main.js"]
