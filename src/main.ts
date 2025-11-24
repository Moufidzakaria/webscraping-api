import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { PlaywrightCrawler, Dataset } from 'crawlee';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ⚡ Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Trop de requêtes' },
});
app.use(limiter);

// Redis
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});
redis.on('connect', () => console.log('✅ Redis connecté'));
redis.on('error', (err) => console.error('❌ Erreur Redis:', err));

// MongoDB
mongoose
  .connect(process.env.MONGO_URI || '')
  .then(() => console.log('✅ MongoDB connecté'))
  .catch((err) => console.error('❌ Erreur MongoDB:', err));

// Schema Mongo
const productSchema = new mongoose.Schema({
  title: String,
  price: String,
  image: String,
  link: { type: String, unique: true },
});
const Product = mongoose.model('Product', productSchema);

// Middleware API Key + HMAC
function verifyAPIKey(req, res, next) {
  if (process.env.NODE_ENV === 'development') return next();

  const clientKey = req.header('x-api-key')?.trim();
  const signature = req.header('x-signature')?.trim();
  const timestamp = req.header('x-timestamp')?.trim();

  if (!clientKey || !signature || !timestamp)
    return res.status(400).json({ success: false, error: 'Headers manquants' });

  if (clientKey !== process.env.API_KEY)
    return res.status(401).json({ success: false, error: 'API Key invalide' });

  const nowSec = Math.floor(Date.now() / 1000);
  const reqTs = parseInt(timestamp, 10);
  if (isNaN(reqTs)) return res.status(400).json({ success: false, error: 'Timestamp invalide' });

  if (Math.abs(nowSec - reqTs) > 600)
    return res.status(403).json({ success: false, error: 'Requête expirée' });

  const expectedSignature = crypto.createHmac('sha256', process.env.API_SECRET)
                                  .update(`${clientKey}|${timestamp}`)
                                  .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)))
    return res.status(403).json({ success: false, error: 'Signature invalide' });

  next();
}

// Scraping Shopify
async function scrapeShopify() {
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 50,
    maxConcurrency: 5,
    headless: true,
    async requestHandler({ page, pushData }) {
      await page.waitForSelector('.product-item__title', { timeout: 15000 });
      const products = await page.$$eval('.product-item', (items) =>
        items.map((item) => {
          const title = item.querySelector('.product-item__title')?.textContent?.trim() || null;
          const price = item.querySelector('span.price')?.textContent?.trim() || null;
          const img = item.querySelector('img');
          const image = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
          const link = item.querySelector('a')?.href || null;
          return { title, price, image, link };
        })
      );
      await pushData(products.filter(p => p.link));
    },
  });

  const pages = Array.from({ length: 7 }, (_, i) =>
    `https://warehouse-theme-metal.myshopify.com/collections/home-cinema?page=${i + 1}`
  );

  await crawler.run(pages);

  const { items } = await Dataset.getData();
  fs.writeFileSync(path.join(__dirname, 'shopify_products.json'), JSON.stringify(items, null, 2));

  if (items.length) {
    const ops = items.map((item) => ({
      updateOne: { filter: { link: item.link }, update: { $set: item }, upsert: true },
    }));
    await Product.bulkWrite(ops);
  }

  await redis.set('shopify_products', JSON.stringify(items), 'EX', parseInt(process.env.CACHE_TTL || '3600'));
  return items;
}

// API Route
app.get('/api/products', verifyAPIKey, async (req, res) => {
  try {
    const cached = await redis.get('shopify_products');
    if (cached) return res.json({ success: true, count: JSON.parse(cached).length, products: JSON.parse(cached) });

    const filePath = path.join(__dirname, 'shopify_products.json');
    const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : await scrapeShopify();
    await redis.set('shopify_products', JSON.stringify(data), 'EX', parseInt(process.env.CACHE_TTL || '3600'));

    res.json({ success: true, count: data.length, products: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur scraping' });
  }
});

// Cron toutes les heures
cron.schedule('0 * * * *', scrapeShopify);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
