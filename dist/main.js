import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { chromium } from 'playwright';
import IORedis from 'ioredis';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_FILE = path.join(__dirname, "products.json");
// ---------------- EXPRESS ------------------
const app = express();
app.use(express.json());
// Rate limiter
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: { success: false, error: "Too many requests" }
}));
app.use("/api", (req, res, next) => {
    console.log(req.headers);
    next();
});
// ---------------- CORS ------------------
app.use("/api", cors());
function checkApiKey(req, res, next) {
    console.log("🔍 Headers reçu :", req.headers);
    console.log("🔑 Query reçu   :", req.query);
    let apiKey = req.headers["x-rapidapi-key"] || req.query.apiKey;
    if (!apiKey)
        return res.status(401).json({ success: false, error: "API key required" });
    apiKey = apiKey.trim();
    const expectedKey = process.env.API_KEY?.trim();
    if (!expectedKey || apiKey !== expectedKey) {
        return res.status(403).json({ success: false, error: "Invalid API key" });
    }
    next();
}
app.use("/api", checkApiKey);
// ---------------- REDIS ------------------
const redis = new IORedis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD
});
redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err));
// ---------------- MONGODB ------------------
mongoose.connect(process.env.MONGO_URI)
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
// ---------------- UTIL ------------------
function loadProductsFromJSON() {
    if (!fs.existsSync(JSON_FILE))
        return [];
    try {
        return JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
    }
    catch {
        return [];
    }
}
// ---------------- ROUTES ------------------
app.get("/api/products", async (req, res) => {
    try {
        const search = (req.query.search || "").toLowerCase();
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const all = req.query.all === "true";
        const redisKey = `shopify_products_page_${page}_search_${search}`;
        const cached = await redis.get(redisKey);
        if (cached && !all)
            return res.json(JSON.parse(cached));
        const allCached = await redis.get("shopify_products");
        let products = allCached ? JSON.parse(allCached).products : loadProductsFromJSON();
        if (search)
            products = products.filter(p => p.title?.toLowerCase().includes(search));
        const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
        if (minPrice !== null || maxPrice !== null) {
            products = products.filter(p => {
                const priceNum = Number(p.price?.replace(/[^0-9.]/g, "")) || 0;
                if (minPrice !== null && priceNum < minPrice)
                    return false;
                if (maxPrice !== null && priceNum > maxPrice)
                    return false;
                return true;
            });
        }
        const total = products.length;
        const result = all ? products : products.slice((page - 1) * limit, page * limit);
        const response = { success: true, page, limit, total, products: result };
        if (!all)
            await redis.set(redisKey, JSON.stringify(response), "EX", 600);
        res.json(response);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});
// ---------------- SCRAPER ------------------
async function scrapeShopify() {
    console.log("\n🚀 Scraping Shopify...");
    const oldProducts = loadProductsFromJSON();
    const oldLinks = new Set(oldProducts.map(p => p.link));
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(process.env.SHOPIFY_COLLECTION_URL);
    // Calcul du nombre de pages
    const totalPages = await page.$$eval('.pagination a', links => Math.max(...links.map(l => Number(l.textContent)).filter(Boolean), 1));
    await browser.close();
    const urls = Array.from({ length: totalPages }, (_, i) => `${process.env.SHOPIFY_COLLECTION_URL}?page=${i + 1}`);
    const crawler = new PlaywrightCrawler({
        headless: true,
        maxRequestsPerCrawl: 50,
        async requestHandler({ page, pushData, request }) {
            try {
                await page.waitForSelector(".product-item", { timeout: 10000 }).catch(() => console.log("Pas de produit trouvé"));
                const data = await page.$$eval(".product-item", items => items.map(item => {
                    const title = item.querySelector(".product-item__title")?.textContent?.trim();
                    const price = item.querySelector("span.price")?.textContent?.trim();
                    const link = item.querySelector("a")?.href;
                    const img = item.querySelector("img");
                    const image = img?.src || img?.getAttribute("data-src");
                    return { title, price, image, link };
                }));
                const newProducts = data
                    .filter(d => d.link && !oldLinks.has(d.link))
                    .map(p => ({ ...p, productId: crypto.randomBytes(8).toString("hex") }));
                if (newProducts.length > 0) {
                    newProducts.forEach(p => oldLinks.add(p.link));
                    await pushData(newProducts);
                }
            }
            catch (err) {
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
    const ops = uniqueNewProducts.map(p => ({
        updateOne: { filter: { link: p.link }, update: { $set: p }, upsert: true }
    }));
    if (ops.length > 0)
        await Product.bulkWrite(ops);
    await redis.set("shopify_products", JSON.stringify({ success: true, total: allProducts.length, products: allProducts }), "EX", Number(process.env.CACHE_TTL || 300));
    console.log(`💾 JSON et Redis mis à jour : ${allProducts.length} produits`);
}
// ---------------- CRON ------------------
cron.schedule(process.env.SCRAPE_CRON || "0 * * * *", scrapeShopify);
// ---------------- SERVER ------------------
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    scrapeShopify().catch(console.error);
});
