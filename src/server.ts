app.get("/api/products", async (req, res) => {
  try {
    const products = loadProductsFromJSON();
    res.json({ success: true, total: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});
