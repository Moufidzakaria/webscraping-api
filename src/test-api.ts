import fs from "fs";
import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/products";
const API_KEY = "MaSuperCleSecrete123";

async function fetchAllProducts() {
  try {
    let allProducts = [];
    let page = 1;
    const limit = 50;
    let total = 0;

    console.log("🚀 Démarrage du téléchargement des produits...");

    while (true) {
      const response = await fetch(`${API_URL}?page=${page}&limit=${limit}`, {
        headers: {
          "x-api-key": API_KEY, // ✔️ header الصحيح
        },
      });

      const data = await response.json();

      if (data.success === false) {
        console.error("❌ Erreur API:", data.error);
        break;
      }

      allProducts.push(...data.products);
      console.log(`✅ Page ${page} récupérée (${allProducts.length}/${data.total})`);

      total = data.total;
      if (allProducts.length >= total) break;

      page++;
    }

    fs.writeFileSync("allProducts.json", JSON.stringify(allProducts, null, 2));
    console.log(`🎉 ${allProducts.length} produits enregistrés dans allProducts.json`);
  } catch (err) {
    console.error("❌ Erreur:", err);
  }
}

fetchAllProducts();
