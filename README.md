# Shopify Scraper API 🚀
📈 CI/CD avec GitHub Actions

Build et lancement automatique Docker containers

Vérification que l’API est prête (curl test)

Déploiement simple sur serveur / VPS ou Railway, Heroku…
Une API Node.js pour récupérer automatiquement les produits d’une boutique Shopify.  
Le projet est sécurisé, rapide, scalable et prêt pour Docker + CI/CD.

---

## 🛠️ Technologies utilisées

- **Node.js 20**
- **Express** pour l’API
- **MongoDB** pour stocker les produits
- **Redis** pour le caching
- **Playwright + Crawlee** pour le scraping Shopify
- **Docker & Docker Compose** pour containerisation
- **GitHub Actions** pour CI/CD
- **Helmet + compression + rate limiter** pour la sécurité et performance
- **Cron** pour lancer le scraping automatiquement

---

## ⚡ Fonctionnalités

- Scraping automatique des produits d’une collection Shopify
- Stockage des produits dans MongoDB et un fichier JSON
- Cache Redis pour les requêtes rapides
- Pagination et recherche dans l’API
- Filtrage par prix
- Sécurité via clé API
- Cron pour mise à jour automatique toutes les heures (configurable)

---

## 🔑 Configuration (.env)

```env
API_KEY=MaSuperCleSecrete123
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=monSuperPassword
MONGO_URI=mongodb://127.0.0.1:27017/nomDeTaBase
CACHE_TTL=300
PORT=3000
SHOPIFY_COLLECTION_URL=https://warehouse-theme-metal.myshopify.com/collections/home-cinema
SCRAPE_CRON=0 * * * *
ENABLE_SCRAPER=true

🐳 Avec Docker
docker-compose build
docker-compose up -d


MongoDB et Redis sont inclus dans le docker-compose.yml

L’API est exposée sur le port 3000

Le scraping se lance automatiquement avec le cron configuré

📈 CI/CD avec GitHub Actions

Build et lancement automatique Docker containers

Vérification que l’API est prête (curl test)

Déploiement simple sur serveur / VPS ou Railway, Heroku…
