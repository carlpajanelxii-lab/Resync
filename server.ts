import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const DB_PATH = path.join(__dirname, "products.json");
  const CART_PATH = path.join(__dirname, "cart.json");

  // Create database files if they don't exist
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");
  if (!fs.existsSync(CART_PATH)) fs.writeFileSync(CART_PATH, "[]");

  // Database helper functions
  const loadJSON = (file: string) => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
  };
  const saveJSON = (file: string, data: any) => fs.writeFileSync(file, JSON.stringify(data, null, 4));

  // --- API Routes ---
  app.post("/api/scan", (req, res) => {
    const { code } = req.body;
    const products = loadJSON(DB_PATH);
    const product = products.find((p: any) => p.code === code);
    res.json({ success: !!product, product });
  });

  app.post("/api/register", (req, res) => {
    const { code, name, singlePrice, wholePrice } = req.body;
    const products = loadJSON(DB_PATH);
    if (products.find((p: any) => p.code === code)) return res.json({ success: false, message: "Product exists" });
    products.push({ code, name, singlePrice: Number(singlePrice), wholePrice: wholePrice ? Number(wholePrice) : null });
    saveJSON(DB_PATH, products);
    res.json({ success: true });
  });

  app.get("/api/cart", (req, res) => {
    const cart = loadJSON(CART_PATH);
    const products = loadJSON(DB_PATH);
    const items = cart.map((item: any) => {
      const p = products.find((prod: any) => prod.code === item.code);
      return { ...item, name: p?.name || "Unknown", singlePrice: p?.singlePrice || 0, totalPrice: (p?.singlePrice || 0) * item.quantity };
    }).filter((i: any) => i.quantity > 0);
    res.json({ items });
  });

  app.post("/api/cart/add", (req, res) => {
    const { code } = req.body;
    let cart = loadJSON(CART_PATH);
    const idx = cart.findIndex((i: any) => i.code === code);
    if (idx >= 0) cart[idx].quantity++; else cart.push({ code, quantity: 1 });
    saveJSON(CART_PATH, cart);
    res.json({ success: true });
  });

  app.post("/api/cart/update", (req, res) => {
    const { code, change } = req.body;
    let cart = loadJSON(CART_PATH);
    const idx = cart.findIndex((i: any) => i.code === code);
    if (idx >= 0) {
      cart[idx].quantity += change;
      if (cart[idx].quantity <= 0) cart.splice(idx, 1);
      saveJSON(CART_PATH, cart);
    }
    res.json({ success: true });
  });

  app.post("/api/cart/clear", (req, res) => {
    saveJSON(CART_PATH, []);
    res.json({ success: true });
  });

  // --- Serve Unified Frontend ---
  app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScannerPro - Bento Edition</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/html5-qrcode"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bento-bg: #0a0b10;
            --primary: #2563eb;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
        }
        body {
            background-color: var(--bento-bg);
            color: #cbd5e1;
            font-family: 'Inter', sans-serif;
            margin: 0;
            min-height: 100vh;
        }
        .bento-card {
            background: rgba(22, 26, 35, 0.5);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1.25rem;
        }
        .bento-card-inner {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        @keyframes scan-line {
            0% { transform: translateY(-50%); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(150%); opacity: 0; }
        }
        .animate-scan-line {
            animation: scan-line 2s linear infinite;
        }
        .lucide { width: 20px; height: 20px; }
    </style>
</head>
<body>
    <div class="flex flex-col min-h-screen max-w-md mx-auto w-full relative">
        <!-- Header -->
        <header class="sticky top-0 z-50 bg-[#0a0b10]/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-600/20 rounded-lg border border-blue-500/30 flex items-center justify-center font-bold text-blue-500 text-xl italic shadow-lg">P</div>
                <h1 class="text-xl font-medium tracking-tight text-white italic">
                    Scanner<span class="text-blue-500 not-italic">Pro</span>
                    <span class="text-slate-500 font-mono text-[10px] ml-2 font-normal not-italic px-1.5 py-0.5 bg-white/5 rounded">v4.0</span>
                </h1>
            </div>
            <button onclick="switchTab('cart')" class="group relative p-2.5 rounded-xl border border-white/10 bg-white/5 transition-all">
                <svg class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                <span id="cart-badge" class="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded hidden">0</span>
            </button>
        </header>

        <!-- Main Content -->
        <main class="flex-1 p-6" id="app-view">
            <!-- Content will be injected here -->
        </main>

        <!-- Navigation -->
        <nav class="sticky bottom-0 bg-[#0a0b10]/80 backdrop-blur-md border-t border-white/10 p-3 px-6 pb-8 flex justify-around items-center">
            <button onclick="switchTab('scan')" class="tab-btn flex flex-col items-center gap-1.5 text-blue-500" data-tab="scan">
                <svg class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" x2="17" y1="12" y2="12"/></svg>
                <span class="text-[9px] font-bold uppercase tracking-widest">Scanner</span>
            </button>
            <button onclick="switchTab('cart')" class="tab-btn flex flex-col items-center gap-1.5 text-slate-600" data-tab="cart">
                <svg class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                <span class="text-[9px] font-bold uppercase tracking-widest">Inventory</span>
            </button>
        </nav>

        <!-- Toast -->
        <div id="toast" class="fixed bottom-24 left-6 right-6 z-[100] px-6 py-4 rounded-xl border backdrop-blur-2xl shadow-2xl transition-all opacity-0 translate-y-10 pointer-events-none"></div>
    </div>

    <script>
        let currentTab = 'scan';
        let scanner = null;
        let cart = [];
        let scanResult = null;
        let isNewProduct = false;
        let currentCode = "";

        const switchTab = (tab) => {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => {
                const isActive = b.dataset.tab === tab;
                b.classList.toggle('text-blue-500', isActive);
                b.classList.toggle('text-slate-600', !isActive);
            });
            render();
            if (tab === 'scan') startScanner(); else stopScanner();
        };

        const render = () => {
            const view = document.getElementById('app-view');
            if (currentTab === 'scan') {
                if (scanResult) {
                    view.innerHTML = renderScanResult();
                } else if (isNewProduct) {
                    view.innerHTML = renderRegistration();
                } else {
                    view.innerHTML = \`<div class="bento-card overflow-hidden shadow-2xl aspect-[4/3] relative bg-black/40">
                        <div id="reader" class="w-full h-full"></div>
                        <div class="absolute inset-0 pointer-events-none border-[16px] border-[#0a0b10]/60"></div>
                        <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div class="w-56 h-28 border-2 border-blue-500/40 rounded-xl relative">
                                <div class="absolute top-1/2 left-0 right-0 h-px bg-blue-500/40 animate-scan-line"></div>
                            </div>
                        </div>
                    </div>
                    <button onclick="manualInputPrompt()" class="w-full py-4 mt-4 bento-card-inner rounded-xl text-[10px] uppercase font-bold tracking-widest text-slate-400">Enter Code Manually</button>\`;
                    startScanner();
                }
            } else {
                view.innerHTML = renderCart();
            }
        };

        const renderScanResult = () => \`
            <div class="bento-card flex flex-col overflow-hidden">
                <div class="bg-emerald-500/10 px-4 py-2 border-b border-emerald-500/20 flex justify-between">
                    <span class="text-emerald-400 text-xs font-bold uppercase tracking-tighter">Recognized Entity</span>
                </div>
                <div class="p-6">
                    <h2 class="text-2xl font-medium text-white mb-6 uppercase tracking-tight">\${scanResult.name}</h2>
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="p-4 bento-card-inner rounded-xl"><p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Unit Price</p><p class="text-2xl font-mono font-bold text-emerald-400">₱\${scanResult.singlePrice.toLocaleString()}</p></div>
                        <div class="p-4 bento-card-inner rounded-xl opacity-80"><p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Wholesale</p><p class="text-2xl font-mono font-bold text-blue-500">₱\${scanResult.wholePrice?.toLocaleString() || 'N/A'}</p></div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="scanResult=null; render(); startScanner();" class="flex-1 py-3 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider">Dismiss</button>
                        <button onclick="addToCart('\${scanResult.code}')" class="flex-1 py-3 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">Add to Cart</button>
                    </div>
                </div>
            </div>\`;

        const renderRegistration = () => \`
            <div class="bento-card p-6">
                <div class="text-warning text-xs font-bold uppercase tracking-tighter mb-4">Unregistered Barcode: \${currentCode}</div>
                <div class="space-y-4">
                    <input id="reg-name" placeholder="PRODUCT NAME" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 placeholder-slate-600 text-sm italic uppercase">
                    <div class="grid grid-cols-2 gap-3">
                        <input id="reg-price" type="number" placeholder="PRICE" class="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm">
                        <input id="reg-whole" type="number" placeholder="WHOLESALE" class="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm">
                    </div>
                    <div class="flex gap-2">
                        <button onclick="isNewProduct=false; render(); startScanner();" class="flex-1 py-3 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancel</button>
                        <button onclick="submitRegistration()" class="flex-1 py-3 bg-warning text-black rounded-xl text-[10px] font-bold uppercase tracking-widest">Register</button>
                    </div>
                </div>
            </div>\`;

        const renderCart = () => {
            if (cart.length === 0) return \`<div class="bento-card p-12 text-center text-slate-500 italic uppercase text-[10px] tracking-widest">Inventory empty. Scan to populate.</div>\`;
            let total = 0;
            const items = cart.map(i => {
                total += i.totalPrice;
                return \`<div class="bento-card p-4 flex justify-between items-center mb-2">
                    <div><h3 class="font-bold text-white uppercase text-sm mb-1">\${i.name}</h3><p class="text-[10px] font-mono text-emerald-400">₱\${i.totalPrice.toLocaleString()}</p></div>
                    <div class="flex items-center gap-3 bg-white/5 p-1 rounded-lg border border-white/10">
                        <button onclick="updateQty('\${i.code}', -1)" class="p-1 text-slate-500 hover:text-white transition-all text-lg font-bold">−</button>
                        <span class="font-mono font-bold text-xs">\${i.quantity}</span>
                        <button onclick="updateQty('\${i.code}', 1)" class="p-1 text-slate-500 hover:text-white transition-all text-lg font-bold">+</button>
                    </div>
                </div>\`;
            }).join('');
            return \`<div class="flex justify-between items-center mb-4 px-2"><h2 class="text-xs font-bold uppercase tracking-[0.2em]">Live Session</h2><button onclick="clearCart()" class="text-[10px] font-bold text-red-500 uppercase tracking-widest">Wipe Cart</button></div>\${items}
                <div class="mt-6 bento-card p-6 bg-gradient-to-br from-white/5 to-transparent">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-2">Net Reconciled</p>
                    <p class="text-4xl font-mono font-bold text-white mb-6">₱\${total.toLocaleString()}</p>
                    <button class="w-full py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-xl active:scale-[0.98] transition-all">CHECKOUT</button>
                </div>\`;
        };

        const startScanner = () => {
            if (!document.getElementById('reader')) return;
            scanner = new Html5Qrcode("reader");
            scanner.start({ facingMode: "environment" }, { fps: 20, qrbox: { width: 250, height: 120 } }, (code) => {
                handleScan(code);
            }).catch(e => {
                console.error(e);
                toast("Camera error. Reload needed.", "error");
            });
        };

        const stopScanner = () => { if (scanner && scanner.isScanning) scanner.stop(); };

        const handleScan = async (code) => {
            stopScanner();
            currentCode = code;
            const res = await fetch('/api/scan', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ code }) });
            const data = await res.json();
            if (data.success) {
                scanResult = data.product;
                toast("Detected: " + scanResult.name, "success");
            } else {
                isNewProduct = true;
            }
            render();
        };

        const addToCart = async (code) => {
            await fetch('/api/cart/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ code }) });
            scanResult = null;
            toast("Captured to batch", "success");
            loadCart();
            render();
        };

        const updateQty = async (code, change) => {
            await fetch('/api/cart/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ code, change }) });
            loadCart();
        };

        const clearCart = async () => { if (confirm("Wipe session data?")) { await fetch('/api/cart/clear', { method: 'POST' }); loadCart(); } };

        const submitRegistration = async () => {
            const name = document.getElementById('reg-name').value;
            const price = document.getElementById('reg-price').value;
            const whole = document.getElementById('reg-whole').value;
            if (!name || !price) return toast("Missing fields", "error");
            const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ code: currentCode, name, singlePrice: price, wholePrice: whole }) });
            const data = await res.json();
            if (data.success) { isNewProduct = false; handleScan(currentCode); } else toast("Registry fail", "error");
        };

        const loadCart = async () => {
            const res = await fetch('/api/cart');
            const data = await res.json();
            cart = data.items;
            const badge = document.getElementById('cart-badge');
            const count = cart.reduce((s, i) => s + i.quantity, 0);
            badge.innerText = count;
            badge.classList.toggle('hidden', count === 0);
            if (currentTab === 'cart') render();
        };

        const toast = (msg, type) => {
            const t = document.getElementById('toast');
            t.innerText = msg.toUpperCase();
            t.className = \`fixed bottom-24 left-6 right-6 z-[100] px-6 py-4 rounded-xl border backdrop-blur-2xl shadow-2xl transition-all font-mono font-bold text-[10px] tracking-widest \${type==='success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}\`;
            t.style.opacity = '1'; t.style.transform = 'translateY(0)';
            setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 3000);
        };

        const manualInputPrompt = () => {
            const code = prompt("Enter Barcode / Serial:");
            if (code) handleScan(code);
        };

        render();
        loadCart();
    </script>
</body>
</html>
    `);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
