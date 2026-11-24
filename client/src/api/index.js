const API_BASE = '';
const TOKEN_KEY = 'inventory_auth_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function toQuery(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

async function request(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['x-auth-token'] = token;

  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Make sure it is running.');
  }

  // A 401 on the login endpoint means bad credentials, not an expired session.
  if (res.status === 401 && url !== '/api/auth/login') {
    setToken(null);
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

const api = {
  // Auth
  login: (creds) =>
    request('POST', '/api/auth/login', creds).then((data) => {
      if (data.token) setToken(data.token);
      return data;
    }),
  logout: async () => {
    try {
      await request('POST', '/api/auth/logout');
    } catch {
      // Ignore network errors on logout.
    } finally {
      setToken(null);
    }
  },
  getMe: () => request('GET', '/api/auth/me'),
  isAuthenticated: () => !!getToken(),

  // Health
  health: () => request('GET', '/api/health'),

  // Dashboard
  getDashboard: () => request('GET', '/api/dashboard'),

  // Items
  getItems: (params = {}) => request('GET', `/api/items${toQuery(params)}`),
  getItem: (id) => request('GET', `/api/items/${id}`),
  getCategories: () => request('GET', '/api/items/categories'),
  createItem: (data) => request('POST', '/api/items', data),
  updateItem: (id, data) => request('PUT', `/api/items/${id}`, data),
  deleteItem: (id) => request('DELETE', `/api/items/${id}`),

  // Movements
  getMovements: (params = {}) => request('GET', `/api/movements${toQuery(params)}`),
  getMovement: (id) => request('GET', `/api/movements/${id}`),
  createMovement: (data) => request('POST', '/api/movements', data),
  deleteMovement: (id) => request('DELETE', `/api/movements/${id}`),

  // Locations
  getLocations: () => request('GET', '/api/locations'),
  getLocation: (id) => request('GET', `/api/locations/${id}`),
  createLocation: (data) => request('POST', '/api/locations', data),

  // Suppliers
  getSuppliers: () => request('GET', '/api/suppliers'),
  createSupplier: (data) => request('POST', '/api/suppliers', data),

  // Profile
  getProfile: () => request('GET', '/api/profile'),
  changePassword: (data) => request('PUT', '/api/profile/password', data),

  // Admin: user management
  getUsers: () => request('GET', '/api/admin/users'),
  createUser: (data) => request('POST', '/api/admin/users', data),
  updateUser: (id, data) => request('PUT', `/api/admin/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
};

export default api;
export { TOKEN_KEY };
