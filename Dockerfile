# 1️⃣ Image Node officielle légère
FROM node:20-alpine

# 2️⃣ Répertoire de travail
WORKDIR /app

# 3️⃣ Copier package.json et package-lock.json
COPY package*.json ./

# 4️⃣ Installer les dépendances (production + dev si besoin pour tsx)
RUN npm install

# 5️⃣ Copier tout le projet
COPY . .

# 6️⃣ Exposer le port
EXPOSE 3000

# 7️⃣ Lancer directement TypeScript via tsx
CMD ["npx", "tsx", "src/main.ts"]
