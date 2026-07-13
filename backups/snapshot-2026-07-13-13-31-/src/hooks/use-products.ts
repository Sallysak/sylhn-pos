"use client";

import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/lib/pos-data";

const PRODUCTS_KEY = "sylhn-products";

export interface UseProductsOptions {
  fetchOnMount?: boolean;
}

export function useProducts(opts: UseProductsOptions = {}) {
  const { fetchOnMount = false } = opts;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage first
  useEffect(() => {
    try {
      const cached = localStorage.getItem(PRODUCTS_KEY);
      if (cached) {
        setProducts(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch { /* ignore */ }

    if (fetchOnMount) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [fetchOnMount]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProduct = useCallback(async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id || ""}`, {
        method: product.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(prev => {
        const idx = prev.findIndex(p => p.id === product.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data.product;
          return next;
        }
        return [...prev, data.product];
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}?force=true`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProducts(prev => prev.filter(p => p.id !== id));
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, []);

  return { products, setProducts, loading, error, fetchProducts, saveProduct, deleteProduct };
}
