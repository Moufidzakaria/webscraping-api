import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { chromium } from 'playwright';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_FILE = path.join(__dirname, "products.json");

// --- Express ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Rate limiter ---
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { success: false, error: "Too many requests" }
}));

// --- Redis ---
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379
});
redis.on("connect", () => console.log("Redis OK"));
redis.on("error", err => console.error("Redis ERROR:", err));

// --- MongoDB ---
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/shopifydb")
  .then(() => console.log("MongoDB OK"))
  .catch(err => console.error("MongoDB ERROR:", err));

// --- Mongoose Schema ---
const productSchema = new mongoose.Schema({
  productId: { type: String, unique: true },
  title: String,
  price: String,
  image: String,
  link: { type: String, unique: true }
});
const Product = mongoose.model("Product", productSchema);

// --- JSON loader ---
function loadProductsFromJSON() {
  if (fs.existsSync(JSON_FILE)) {
    try { return JSON.parse(fs.readFileSync(JSON_FILE, "utf-8")); }
    catch { return []; }
  }
  return [];
}

// --- Middleware RapidAPI Key ---
app.use((req, res, next) => {
  const key = req.headers['x-rapidapi-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  next();
});

// --- Scraper Shopify ---
async function scrapeShopify() {
  console.log("\n🚀 Scraping Shopify...");

  const oldProducts = loadProductsFromJSON();
  const oldLinks = new Set(oldProducts.map(p => p.link));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto("https://warehouse-theme-metal.myshopify.com/collections/home-cinema");

  const totalPages = await page.$$eval('.pagination a', links =>
    Math.max(...links.map(l => Number(l.textContent)).filter(Boolean), 1)
  );
  await browser.close();

  const urls = Array.from({ length: totalPages }, (_, i) =>
    `https://warehouse-theme-metal.myshopify.com/collections/home-cinema?page=${i + 1}`
  );

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 50,
    async requestHandler({ page, pushData, request }) {
      try {
        await page.waitForSelector(".product-item", { timeout: 20000 }).catch(() => console.log("Pas de produit trouvé"));
        const data = await page.$$eval(".product-item", items =>
          items.map(item => {
            const title = item.querySelector(".product-item__title")?.textContent?.trim();
            const price = item.querySelector("span.price")?.textContent?.trim();
            const link = item.querySelector("a")?.href;
            const img = item.querySelector("img");
            const image = img?.src || img?.getAttribute("data-src");
            return { title, price, image, link };
          })
        );

        const newProducts = data
          .filter(d => d.link && !oldLinks.has(d.link))
          .map(p => ({ ...p, productId: crypto.randomBytes(8).toString("hex") }));

        if (newProducts.length > 0) {
          console.log(`\n--- Nouveaux produits depuis ${request.url} ---`);
          newProducts.forEach(p => console.log(`${p.title} | ${p.price} | ${p.link}`));
          newProducts.forEach(p => oldLinks.add(p.link));
          await pushData(newProducts);
        }
      } catch (err) {
        console.error(`Error scraping ${request.url}:`, err.message);
      }
    }
  });

  await crawler.run(urls);

  const datasetData = await Dataset.getData({ clean: true });
  const scrapedItems = datasetData.items || [];

  const uniqueNewProducts = scrapedItems
    .filter(p => p.link && !oldProducts.some(op => op.link === p.link))
    .map(p => ({ ...p, productId: crypto.randomBytes(8).toString("hex") }));

  const allProducts = [...oldProducts, ...uniqueNewProducts];

  fs.writeFileSync(JSON_FILE, JSON.stringify(allProducts, null, 2));
  console.log(`💾 JSON mis à jour : ${allProducts.length} produits`);

  const ops = uniqueNewProducts.map(p => ({
    updateOne: { filter: { link: p.link }, update: { $set: p }, upsert: true }
  }));
  if (ops.length > 0) await Product.bulkWrite(ops);
  console.log("✅ MongoDB mis à jour");

  await redis.set("shopify_products", JSON.stringify({ success: true, total: allProducts.length, products: allProducts }), "EX", Number(process.env.CACHE_TTL || 300));
  console.log("✅ Redis mis à jour");
  console.log("🏁 Scraping terminé !");
}

// --- Endpoints ---
app.get("/api/products", async (req, res) => {
  try {
    let allProducts = loadProductsFromJSON();
    let { search = "", page = 1, limit = 10 } = req.query;
    page = Number(page); limit = Number(limit);
    const skip = (page - 1) * limit;

    let filtered = allProducts;
    if (search) filtered = filtered.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()));

    const paginated = filtered.slice(skip, skip + limit);
    return res.json({ success: true, page, limit, total: filtered.length, products: paginated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get("/api/products/all", async (req, res) => {
  try {
    const allProducts = loadProductsFromJSON();
    return res.json({ success: true, total: allProducts.length, products: allProducts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// --- Cron scraping toutes les heures ---
cron.schedule("0 * * * *", scrapeShopify);

// --- Lancer serveur ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- Lancer scraping au démarrage ---
(async () => { await scrapeShopify().catch(console.error); })();
