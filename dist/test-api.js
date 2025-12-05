import axios from "axios";
async function testApi() {
    try {
        const start = Date.now(); // début du chronomètre
        // Endpoint pour récupérer tous les produits
        const response = await axios.get("https://webscraping-api-production.up.railway.app/api/products?apiKey=MaSuperCleSecrete123&all=true");
        const duration = Date.now() - start; // temps écoulé
        console.log("⏱ Temps de réponse:", duration, "ms");
        console.log("📦 Nombre total de produits reçus:", response.data.products.length);
        // Affiche les produits
        console.log(response.data.products);
    }
    catch (err) {
        console.error("Erreur API:", err);
    }
}
testApi();
