import fs from 'fs';
import fetch from 'node-fetch';

const API_URL = "http://localhost:3000/api/products";
const API_KEY = "MaSuperCleSecrete123";

interface Product {
  title: string;
  price: string;
  image: string;
  link: string;
  productId: string;
}

interface ApiResponse {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  products: Product[];
}

async function fetchAllProducts() {
  let allProducts: Product[] = [];
  let page = 1;
  const limit = 50;
  let total = 0;

  do {
    try {
      const res = await fetch(`${API_URL}?page=${page}&limit=${limit}`, {
        headers: { "x-rapidapi-key": API_KEY }
      });

      if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);

      const data: ApiResponse = await res.json();

      allProducts = allProducts.concat(data.products);
      total = data.total;

      console.log(`✅ Page ${page} récupérée (${allProducts.length}/${total})`);

      page++;

      await new Promise(resolve => setTimeout(resolve, 400));
    } catch (err) {
      console.error(`❌ Erreur sur la page ${page}:`, (err as Error).message);
      break;
    }
  } while (allProducts.length < total);

  fs.writeFileSync('allProducts.json', JSON.stringify(allProducts, null, 2));
  console.log(`🎉 ${allProducts.length} produits enregistrés dans allProducts.json`);
}

fetchAllProducts();
