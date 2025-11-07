// API service for communicating with Supabase (fetch-based, shared from local-farmers-inventory-system)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
    const config = {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      ...options,
    };

    try {
      // Client-side debug logging (only when window is available)
      const start = Date.now();
      if (typeof window !== 'undefined') {
        try {
          console.debug('[API] Request', { method: config.method || 'GET', url, body: config.body });
        } catch (e) {}
      }
      const response = await fetch(url, config);
      const duration = Date.now() - start;
      let text;
      try { text = await response.clone().text(); } catch (e) { text = '<no-body>'; }
      if (typeof window !== 'undefined') {
        console.debug('[API] Response', { url, status: response.status, duration, body: text });
      }
      if (!response.ok) {
        const errorData = text;
        throw new Error(`API request failed: ${response.status} ${errorData}`);
      }
      if (response.status === 204) {
        return { success: true };
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getProducts() {
    const products = await this.request('/products?select=*,category:categories(id,name,color)&is_active=eq.true&order=created_at.desc', { cache: 'no-store' });
    return products.map(product => ({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      unit: product.unit,
      price: product.price,
      categoryId: product.category_id,
      category: product.category?.name || 'Unknown',
      categoryColor: product.category?.color || '#6B7280',
      createdAt: product.created_at,
      updatedAt: product.updated_at
    }));
  }

  async getProduct(id) {
    const products = await this.request(`/products?id=eq.${id}&select=*,category:categories(id,name,color)&is_active=eq.true`, { cache: 'no-store' });
    if (products.length === 0) {
      throw new Error('Product not found');
    }
    const product = products[0];
    return {
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      unit: product.unit,
      price: product.price,
      categoryId: product.category_id,
      category: product.category?.name || 'Unknown',
      categoryColor: product.category?.color || '#6B7280',
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };
  }

  async createProduct(productData) {
    const supabaseData = {
      name: productData.name,
      quantity: productData.quantity,
      unit: productData.unit,
      price: productData.price || null,
      category_id: productData.categoryId,
      is_active: true
    };
    const products = await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(supabaseData),
    });
    const product = products[0];
    return await this.getProduct(product.id);
  }

  async updateProduct(id, productData) {
    const supabaseData = {
      name: productData.name,
      quantity: productData.quantity,
      unit: productData.unit,
      category_id: productData.categoryId
    };
    if (productData.price !== undefined) {
      supabaseData.price = productData.price;
    }
    await this.request(`/products?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(supabaseData),
    });
    return await this.getProduct(id);
  }

  async deleteProduct(id) {
    await this.request(`/products?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    return { success: true };
  }

  async getCategories() {
    const categories = await this.request('/categories?select=*&order=name.asc', { cache: 'no-store' });
    return categories.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color || '#6B7280',
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }));
  }

  async getCategory(id) {
    const categories = await this.request(`/categories?id=eq.${id}&select=*`);
    if (categories.length === 0) {
      throw new Error('Category not found');
    }
    const category = categories[0];
    return {
      id: category.id,
      name: category.name,
      color: category.color || '#6B7280',
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  async createCategory(categoryData) {
    const supabaseData = {
      name: categoryData.name,
      color: categoryData.color || '#6B7280'
    };
    const categories = await this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(supabaseData),
    });
    const category = categories[0];
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  async healthCheck() {
    try {
      await this.request('/categories?limit=1');
      return {
        status: 'OK',
        message: 'Supabase API is working',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error('Supabase API connection failed');
    }
  }
}

export default new ApiService();
