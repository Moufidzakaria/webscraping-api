import fetch from 'node-fetch';
import crypto from 'crypto';

const API_KEY = "MaSuperCleSecrete123";
const API_SECRET = "MonSecretHMAC123";
const API_URL = "http://localhost:3000/api/products"; // ou ngrok

async function getProducts() {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac('sha256', API_SECRET).update(`${API_KEY}|${timestamp}`).digest('hex');

    const res = await fetch(API_URL, {
      headers: { 'x-api-key': API_KEY, 'x-signature': signature, 'x-timestamp': timestamp },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Erreur API:', res.status, text);
      return;
    }

    const data = await res.json();
    console.log('✅ Produits Shopify:', data);
  } catch (err) {
    console.error('❌ Erreur fetch:', err);
  }
}

getProducts();
