import fetch from 'node-fetch';
import crypto from 'crypto';

const API_KEY = 'MaSuperCleSecrete123';
const API_SECRET = 'MonSecretHMAC123';
const API_URL = 'http://localhost:3000/api/products';

const timestamp = Math.floor(Date.now() / 1000).toString();

const signature = crypto
  .createHmac('sha256', API_SECRET)
  .update(`${API_KEY}|${timestamp}`)
  .digest('hex');

async function testAPI() {
  try {
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'x-signature': signature,
        'x-timestamp': timestamp,
        'Accept': 'application/json'
      }
    });

    const data = await res.json();
    console.log('✅ Résultat API :', data);
  } catch (err) {
    console.error('❌ Erreur API :', err);
  }
}

testAPI();
