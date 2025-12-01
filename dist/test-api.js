import 'dotenv/config';
import fs from 'fs';
import fetch from 'node-fetch';
const API_URL = "http://localhost:3000/api/products";
const API_KEY = process.env.API_KEY || "MaSuperCleSecrete123"; // clé API
const TARGET = 300; // nombre maximum de produits à récupérer
async function fetchAllProducts() {
    try {
        let allProducts = [];
        let page = 1;
        const limit = 50;
        console.log("🚀 Démarrage du téléchargement des produits...");
        while (allProducts.length < TARGET) {
            const response = await fetch(`${API_URL}?page=${page}&limit=${limit}`, {
                headers: {
                    "x-api-key": API_KEY,
                },
            });
            // Vérifier les erreurs HTTP
            if (!response.ok) {
                console.error(`❌ Erreur HTTP: ${response.status}`);
                break;
            }
            const data = await response.json();
            if (!data.success) {
                console.error("❌ Erreur API:", data.error);
                break;
            }
            allProducts.push(...data.products);
            console.log(`✅ Page ${page} récupérée (${allProducts.length}/${TARGET})`);
            if (data.products.length === 0)
                break; // dernière page
            page++;
        }
        // Limiter à TARGET
        const finalData = allProducts.slice(0, TARGET);
        fs.writeFileSync("allProducts.json", JSON.stringify(finalData, null, 2));
        console.log(`🎉 ${finalData.length} produits enregistrés dans allProducts.json`);
    }
    catch (err) {
        console.error("❌ Erreur:", err);
    }
}
fetchAllProducts();
