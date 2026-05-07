import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Camera, 
  ShoppingCart, 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2, 
  AlertCircle,
  PackagePlus,
  Loader2,
  ScanLine
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for clean tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Product {
  code: string;
  name: string;
  singlePrice: number;
  wholePrice?: number | null;
}

interface CartItem {
  code: string;
  name: string;
  singlePrice: number;
  quantity: number;
  totalPrice: number;
}

// --- App Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState<"scan" | "cart">("scan");
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [registerForm, setRegisterForm] = useState({
    name: "",
    singlePrice: "",
    wholePrice: ""
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  useEffect(() => {
    if (activeTab === "scan" && !scanResult && !isNewProduct) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [activeTab, scanResult, isNewProduct]);

  // --- API Actions ---
  const fetchCart = async () => {
    try {
      const res = await fetch("/api/cart");
      const data = await res.json();
      setCartItems(data.items);
    } catch (err) {
      console.error("Cart fetch error:", err);
    }
  };

  const handleScan = async (code: string) => {
    setLoading(true);
    setCurrentCode(code);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        setScanResult(data.product);
        triggerToast("Product recognized!", "success");
      } else {
        setIsNewProduct(true);
      }
    } catch (err) {
      triggerToast("Scan lookup failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const registerProduct = async () => {
    if (!registerForm.name || !registerForm.singlePrice) {
      triggerToast("Please fill in required fields", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          name: registerForm.name,
          singlePrice: Number(registerForm.singlePrice),
          wholePrice: registerForm.wholePrice ? Number(registerForm.wholePrice) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsNewProduct(false);
        handleScan(currentCode);
      } else {
        triggerToast(data.message, "error");
      }
    } catch (err) {
      triggerToast("Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (code: string) => {
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast("Added to cart", "success");
        fetchCart();
        setScanResult(null);
      }
    } catch (err) {
      triggerToast("Cart error", "error");
    }
  };

  const updateCartQuantity = async (code: string, change: number) => {
    try {
      await fetch("/api/cart/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, change })
      });
      fetchCart();
    } catch (err) {
      triggerToast("Update failed", "error");
    }
  };

  const clearCart = async () => {
    try {
      await fetch("/api/cart/clear", { method: "POST" });
      fetchCart();
      triggerToast("Cart cleared", "success");
    } catch (err) {
      triggerToast("Clear failed", "error");
    }
  };

  // --- Helper Functions ---
  const triggerToast = (message: string, type: "success" | "error") => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 3000);
  };

  const startScanner = () => {
    if (scannerRef.current?.isScanning) return;
    
    setPermissionDenied(false);
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;
    
    scanner.start(
      { facingMode: "environment" },
      { 
        fps: 10, 
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.5
      },
      (decodedText) => {
        handleScan(decodedText);
        stopScanner();
      },
      () => {} // Ignored
    ).catch(err => {
      console.error("Scanner error:", err);
      if (err?.toString().includes("NotAllowedError") || err?.toString().includes("Permission denied")) {
        setPermissionDenied(true);
      }
      scannerRef.current = null;
    });
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        // Only log if it's not the "not running" error which we've mostly prevented
        if (!err?.toString().includes("not running")) {
          console.error("Scanner stop error", err);
        }
      }
    }
  };

  const cartTotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

  return (
    <div className="flex flex-col min-h-screen bg-bento-bg font-sans text-slate-300">
      {/* --- Sticky Header --- */}
      <header className="sticky top-0 z-50 bg-bento-bg/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-lg border border-primary/30 flex items-center justify-center font-bold text-primary text-xl italic shadow-lg shadow-primary/5">P</div>
          <h1 className="text-xl font-medium tracking-tight text-white italic">
            Scanner<span className="text-primary not-italic">Pro</span>
            <span className="text-slate-500 font-mono text-[10px] ml-2 font-normal not-italic px-1.5 py-0.5 bg-white/5 rounded">v4.0</span>
          </h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab(activeTab === "scan" ? "cart" : "scan")}
            className="group relative p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
          >
            <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-white" />
            {cartItems.length > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded border border-bento-bg shadow-sm"
              >
                {cartItems.length}
              </motion.span>
            )}
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full">
        
        <AnimatePresence mode="wait">
          {activeTab === "scan" ? (
            <motion.div 
              key="scan-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              {/* Scanner Module */}
              {!scanResult && !isNewProduct && (
                <div className="bento-card overflow-hidden shadow-2xl aspect-[4/3] relative">
                  <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <span className={cn("w-1.5 h-1.5 rounded-full", permissionDenied ? "bg-danger" : "bg-emerald-500 animate-pulse")} /> 
                       {permissionDenied ? "Camera Blocked" : "Live Scanner"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">FACING_ENVIRONMENT</span>
                  </div>
                  
                  {permissionDenied ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-danger/10">
                      <AlertCircle className="w-10 h-10 text-danger mb-4" />
                      <h3 className="font-bold text-white uppercase tracking-tight mb-2">Permission Denied</h3>
                      <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-[240px]">
                        We need camera access to scan products. Please enable it in your browser settings.
                      </p>
                      <button 
                        onClick={startScanner}
                        className="px-6 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-xl shadow-white/5 hover:bg-slate-200 transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      <div id="reader" className="w-full h-full grayscale brightness-110 contrast-125" />
                      <div className="absolute inset-0 pointer-events-none border-[16px] border-bento-bg opacity-40" />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-32 border-2 border-primary/40 rounded-xl relative">
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="bento-card p-12 flex flex-col items-center justify-center gap-4 border-dashed">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Reconciling Data...</p>
                </div>
              )}

              {/* Product Result Module */}
              {scanResult && !loading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bento-card flex flex-col overflow-hidden"
                >
                  <div className="bg-emerald-500/10 px-4 py-2 border-b border-emerald-500/20 flex justify-between items-center">
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-tighter">Recognized Entity</span>
                    <span className="text-[10px] text-slate-500 font-mono leading-none">ID: {scanResult.code}</span>
                  </div>
                  
                  <div className="p-6">
                    <h2 className="text-2xl font-medium tracking-tight text-white mb-6 uppercase">{scanResult.name}</h2>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bento-card-inner rounded-xl">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Unit Price</p>
                        <p className="text-2xl font-mono font-bold text-success">₱{scanResult.singlePrice.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bento-card-inner rounded-xl opacity-80">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Wholesale</p>
                        <p className="text-2xl font-mono font-bold text-primary">
                          {scanResult.wholePrice ? `₱${scanResult.wholePrice.toLocaleString()}` : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button 
                        onClick={() => setScanResult(null)}
                        className="flex-1 py-3 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all"
                      >
                        Dismiss
                      </button>
                      <button 
                        onClick={() => addToCart(scanResult.code)}
                        className="flex-1 py-3 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                      >
                        Capture Transaction
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Registration Module */}
              {isNewProduct && !loading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bento-card flex flex-col overflow-hidden"
                >
                  <div className="bg-warning/10 px-4 py-2 border-b border-warning/20 flex justify-between items-center">
                    <span className="text-warning text-xs font-bold uppercase tracking-tighter">Unregistered Device</span>
                    <span className="text-[10px] text-slate-500 font-mono">{currentCode}</span>
                  </div>
                  
                  <div className="p-6 flex flex-col gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Entity Name</label>
                      <input 
                        type="text" 
                        placeholder="IDENTIFICATION TAG"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-warning font-mono text-sm uppercase transition-colors"
                        value={registerForm.name}
                        onChange={e => setRegisterForm({...registerForm, name: e.target.value})}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Retail Value</label>
                        <input 
                          type="number" 
                          placeholder="0.00"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-warning font-mono text-sm transition-colors"
                          value={registerForm.singlePrice}
                          onChange={e => setRegisterForm({...registerForm, singlePrice: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bulk Value</label>
                        <input 
                          type="number" 
                          placeholder="0.00"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-warning font-mono text-sm transition-colors"
                          value={registerForm.wholePrice}
                          onChange={e => setRegisterForm({...registerForm, wholePrice: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button 
                        onClick={() => setIsNewProduct(false)}
                        className="flex-1 py-3 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all"
                      >
                        Abort
                      </button>
                      <button 
                        onClick={registerProduct}
                        className="flex-1 py-3 bg-warning text-black rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-warning/20 active:scale-[0.98] transition-all"
                      >
                        Confirm Registry
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="cart-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/10">
                <h2 className="text-lg font-medium tracking-tight text-white uppercase italic">Active Transaction</h2>
                {cartItems.length > 0 && (
                  <button 
                    onClick={clearCart}
                    className="text-[10px] font-bold text-danger uppercase tracking-widest hover:brightness-125 px-2 py-1 bg-danger/10 rounded border border-danger/20 transition-all"
                  >
                    Wipe session
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {cartItems.length === 0 ? (
                  <div className="bento-card p-12 text-center flex flex-col items-center gap-4 border-dashed">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <ShoppingCart className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Inventory empty</p>
                      <p className="text-xs text-slate-600 mt-1 uppercase italic">Awaiting source input...</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab("scan")}
                      className="mt-2 px-6 py-2 border border-white/10 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
                    >
                      Return to Scanner
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {cartItems.map((item) => (
                      <div 
                        key={item.code}
                        className="bento-card p-4 flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-[10px] font-mono text-slate-500 leading-none mb-1">{item.code}</p>
                          <h3 className="font-bold text-white uppercase tracking-tight truncate">{item.name}</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Value</span>
                            <span className="text-sm font-mono font-bold text-success">₱{item.totalPrice.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                          <button 
                            onClick={() => updateCartQuantity(item.code, -1)}
                            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs text-white">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.code, 1)}
                            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="mt-4 bento-card overflow-hidden">
                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-2 leading-none">Net Reconciliation</p>
                        <p className="text-4xl font-mono font-bold text-white">₱{cartTotal.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Batch</p>
                        <p className="text-xs font-mono text-white">{cartItems.reduce((s, i) => s + i.quantity, 0)} Units</p>
                      </div>
                    </div>
                    <button className="w-full py-4 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-2xl shadow-white/5 hover:bg-blue-400 hover:text-white active:scale-[0.98] transition-all">
                      Finalize Reconciliation
                    </button>
                  </div>
                  <div className="bg-white/5 px-6 py-2 border-t border-white/5 flex justify-between items-center text-[8px] font-mono text-slate-600 uppercase tracking-widest">
                    <span>Session: stable-v0.1</span>
                    <span>Status: Pending_Sync</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- Toast System --- */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-24 left-6 right-6 z-[100] px-6 py-4 rounded-xl border flex items-center justify-between backdrop-blur-2xl shadow-2xl",
              showToast.type === "success" 
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                : "bg-danger/20 border-danger/30 text-danger"
            )}
          >
            <div className="flex items-center gap-3">
              {showToast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="font-bold text-[10px] uppercase tracking-widest">{showToast.message}</span>
            </div>
            <span className="text-[8px] font-mono opacity-50 uppercase">LOG_MSG</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Navigation Bar --- */}
      <nav className="sticky bottom-0 bg-bento-bg/80 backdrop-blur-md border-t border-white/10 p-3 px-6 pb-8 flex justify-around items-center">
        <button 
          onClick={() => { setScanResult(null); setIsNewProduct(false); setActiveTab("scan"); }}
          className={cn(
            "flex flex-col items-center gap-1.5 py-2 transition-all w-20 relative",
            activeTab === "scan" ? "text-primary" : "text-slate-600"
          )}
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Scanner</span>
          {activeTab === "scan" && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab("cart")}
          className={cn(
            "flex flex-col items-center gap-1.5 py-2 transition-all w-20 relative",
            activeTab === "cart" ? "text-primary" : "text-slate-600"
          )}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Inventory</span>
          {activeTab === "cart" && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />}
        </button>
      </nav>
    </div>
  );
}
