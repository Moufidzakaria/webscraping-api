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
const JSON_FILE = path.join(__dirname, "../products.json");

// ---------------- EXPRESS ----------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------- RATE LIMIT -------------
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { success: false, error: "Too many requests" }
}));

// ---------------- REDIS ------------------
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD || undefined
});
redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err));

// ---------------- MONGODB ----------------
mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log("MongoDB OK"))
  .catch(err => console.error("MongoDB ERROR:", err));

const productSchema = new mongoose.Schema({
  productId: { type: String, unique: true },
  title: String,
  price: String,
  image: String,
  link: { type: String, unique: true }
});
const Product = mongoose.model("Product", productSchema);

// ---------------- LOAD JSON --------------
function loadProductsFromJSON() {
  if (!fs.existsSync(JSON_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
  } catch {
    return [];
  }
}

// ---------------- API KEY MID ------------
app.use((req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key || key !== process.env.API_KEY)
    return res.status(403).json({ success: false, error: "Invalid API KEY" });

  next();
});

// ---------------- SCRAPER ----------------
async function scrapeShopify() {
  console.log("\n🚀 Scraping started...");

  const oldProducts = loadProductsFromJSON();
  const oldLinks = new Set(oldProducts.map(p => p.link));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto("https://warehouse-theme-metal.myshopify.com/collections/home-cinema");

  const totalPages = await page.$$eval('.pagination a', (links) =>
    Math.max(...links.map(l => Number(l.textContent)).filter(Boolean), 1)
  );

  await browser.close();

  const urls = Array.from({ length: totalPages }, (_, i) =>
    `https://warehouse-theme-metal.myshopify.com/collections/home-cinema?page=${i + 1}`
  );

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 50,
    async requestHandler({ page, pushData }) {
      const items = await page.$$eval(".product-item", (products) =>
        products.map(item => ({
          title: item.querySelector(".product-item__title")?.textContent?.trim(),
          price: item.querySelector("span.price")?.textContent?.trim(),
          link: item.querySelector("a")?.href,
          image:
            item.querySelector("img")?.src ||
            item.querySelector("img")?.getAttribute("data-src")
        }))
      );

      const fresh = items
        .filter(p => p.link && !oldLinks.has(p.link))
        .map(p => ({ ...p, productId: crypto.randomBytes(8).toString("hex") }));

      await pushData(fresh);
    }
  });

  await crawler.run(urls);

  const dataset = await Dataset.getData({ clean: true });
  const scraped = dataset.items;

  const newData = scraped.filter(p => !oldProducts.some(op => op.link === p.link));

  const updated = [...oldProducts, ...newData];

  fs.writeFileSync(JSON_FILE, JSON.stringify(updated, null, 2));

  // Update MongoDB
  const ops = newData.map(p => ({
    updateOne: {
      filter: { link: p.link },
      update: { $set: p },
      upsert: true,
    },
  }));
  if (ops.length) await Product.bulkWrite(ops);

  await redis.set(
    "shopify_products",
    JSON.stringify(updated),
    "EX",
    Number(process.env.CACHE_TTL) || 300
  );

  console.log("🏁 Scraping DONE");
}

// ---------------- API ENDPOINTS ----------
app.get("/api/products", async (req, res) => {
  const json = loadProductsFromJSON();
  let { search = "", page = 1, limit = 20 } = req.query;

  page = Number(page);
  limit = Number(limit);

  const filtered = json.filter((p) =>
    p.title?.toLowerCase().includes(String(search).toLowerCase())
  );

  const result = filtered.slice((page - 1) * limit, page * limit);

  res.json({
    success: true,
    page,
    limit,
    total: filtered.length,
    products: result,
  });
});

app.get("/api/products/all", async (req, res) => {
  const json = loadProductsFromJSON();
  res.json({ success: true, total: json.length, products: json });
});

// ---------------- CRON -------------------
cron.schedule("0 * * * *", scrapeShopify);

// ---------------- SERVER ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
  scrapeShopify();
});
