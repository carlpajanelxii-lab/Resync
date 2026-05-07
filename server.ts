import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const DB_PATH = path.join(__dirname, "products.json");
  const CART_PATH = path.join(__dirname, "cart.json");

  // Create files if not exists
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, "[]");
  }
  if (!fs.existsSync(CART_PATH)) {
    fs.writeFileSync(CART_PATH, "[]");
  }

  // Load/Save functions
  function loadProducts() {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    } catch {
      return [];
    }
  }

  function saveProducts(products: any[]) {
    fs.writeFileSync(DB_PATH, JSON.stringify(products, null, 4));
  }

  function loadCart() {
    try {
      return JSON.parse(fs.readFileSync(CART_PATH, "utf8"));
    } catch {
      return [];
    }
  }

  function saveCart(cart: any[]) {
    fs.writeFileSync(CART_PATH, JSON.stringify(cart, null, 4));
  }

  // API Routes
  app.get("/api/products", (req, res) => {
    res.json(loadProducts());
  });

  app.post("/api/scan", (req, res) => {
    const { code } = req.body;
    const products = loadProducts();
    const product = products.find((p: any) => p.code === code);
    res.json({ success: !!product, product });
  });

  app.post("/api/register", (req, res) => {
    const { code, name, singlePrice, wholePrice } = req.body;
    const products = loadProducts();

    if (products.find((p: any) => p.code === code)) {
      return res.json({ success: false, message: "Product already exists" });
    }

    const newProduct = { code, name, singlePrice: Number(singlePrice), wholePrice: wholePrice ? Number(wholePrice) : null };
    products.push(newProduct);
    saveProducts(products);
    res.json({ success: true });
  });

  app.get("/api/cart", (req, res) => {
    const cart = loadCart();
    const products = loadProducts();

    const items = cart.map((item: any) => {
      const product = products.find((p: any) => p.code === item.code);
      return {
        code: item.code,
        name: product ? product.name : "Unknown Product",
        singlePrice: product ? product.singlePrice : 0,
        quantity: item.quantity,
        totalPrice: (product ? product.singlePrice : 0) * item.quantity,
      };
    }).filter((item: any) => item.quantity > 0);

    res.json({ items });
  });

  app.post("/api/cart/add", (req, res) => {
    const { code } = req.body;
    const products = loadProducts();
    const product = products.find((p: any) => p.code === code);

    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    let cart = loadCart();
    const existingIndex = cart.findIndex((item: any) => item.code === code);

    if (existingIndex >= 0) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({ code, quantity: 1 });
    }

    cart = cart.filter((item: any) => item.quantity > 0);
    saveCart(cart);
    res.json({ success: true });
  });

  app.post("/api/cart/update", (req, res) => {
    const { code, change } = req.body;
    let cart = loadCart();
    const itemIndex = cart.findIndex((item: any) => item.code === code);

    if (itemIndex >= 0) {
      cart[itemIndex].quantity += change;
      if (cart[itemIndex].quantity <= 0) {
        cart.splice(itemIndex, 1);
      }
      saveCart(cart);
    }

    res.json({ success: true });
  });

  app.post("/api/cart/clear", (req, res) => {
    saveCart([]);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
