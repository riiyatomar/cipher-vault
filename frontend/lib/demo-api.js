/**
 * CipherVault — Demo/Mock API Layer
 *
 * Simulates all backend operations using localStorage (metadata)
 * and IndexedDB (encrypted file data) so the frontend works
 * standalone without Docker or the Python microservices.
 *
 * Handles large files (up to 100MB) via IndexedDB.
 */

const DEMO_USERS_KEY = 'cv_demo_users';
const DEMO_DOCS_KEY  = 'cv_demo_docs';
const DEMO_CURRENT   = 'cv_demo_current_user';
const IDB_NAME       = 'CipherVaultDemo';
const IDB_STORE      = 'files';

// ── IndexedDB for large file storage ─────────────────────
function openFileDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFileData(id, arrayBuffer) {
  const db = await openFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(arrayBuffer, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getFileData(id) {
  const db = await openFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFileData(id) {
  const db = await openFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Default demo account (always available) ─────────────
const DEFAULT_DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@ciphervault.com',
  username: 'testuser',
  password: 'Demo@1234',
  role: 'user',
  is_active: true,
  created_at: '2025-01-01T00:00:00.000Z',
};

function ensureDemoAccount() {
  if (typeof window === 'undefined') return;
  const users = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || '[]');
  if (!users.find(u => u.email === DEFAULT_DEMO_USER.email)) {
    users.push(DEFAULT_DEMO_USER);
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
  }
}

// Seed the demo account on module load
if (typeof window !== 'undefined') {
  ensureDemoAccount();
}

// ── Helpers ──────────────────────────────────────────────
function getUsers() {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || '[]');
}
function saveUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}
function getDocs() {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(DEMO_DOCS_KEY) || '[]');
}
function saveDocs(docs) {
  localStorage.setItem(DEMO_DOCS_KEY, JSON.stringify(docs));
}
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function fakeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now() / 1000 }));
  const sig = btoa('demo-signature');
  return `${header}.${body}.${sig}`;
}
function delay(ms = 300) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Auth API (demo) ──────────────────────────────────────
export const demoAuthAPI = {
  async register(data) {
    await delay(400);
    const users = getUsers();
    if (users.find(u => u.email === data.email)) {
      throw { response: { data: { detail: 'Email already registered' } } };
    }
    const user = {
      id: uid(),
      email: data.email,
      username: data.username,
      role: 'user',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    users.push({ ...user, password: data.password });
    saveUsers(users);
    return { data: user };
  },

  async login(data) {
    await delay(400);
    const users = getUsers();
    const user = users.find(u => u.email === data.email && u.password === data.password);
    if (!user) {
      throw { response: { data: { detail: 'Invalid email or password' } } };
    }
    const access_token = fakeJwt({ sub: user.id, email: user.email });
    const refresh_token = fakeJwt({ sub: user.id, type: 'refresh' });
    localStorage.setItem(DEMO_CURRENT, JSON.stringify(user));
    return {
      data: { access_token, refresh_token, token_type: 'bearer', expires_in: 1800 },
    };
  },

  async getProfile() {
    await delay(200);
    const user = JSON.parse(localStorage.getItem(DEMO_CURRENT) || 'null');
    if (!user) throw { response: { status: 401, data: { detail: 'Not authenticated' } } };
    const { password, ...safe } = user;
    return { data: safe };
  },

  async refresh(token) {
    await delay(200);
    const user = JSON.parse(localStorage.getItem(DEMO_CURRENT) || 'null');
    if (!user) throw { response: { status: 401 } };
    return {
      data: {
        access_token: fakeJwt({ sub: user.id }),
        refresh_token: fakeJwt({ sub: user.id, type: 'refresh' }),
      },
    };
  },
};

// ── Documents API (demo) — uses IndexedDB for file data ──
export const demoDocumentsAPI = {
  async upload(formData) {
    await delay(600);
    const user = JSON.parse(localStorage.getItem(DEMO_CURRENT) || 'null');
    if (!user) throw { response: { status: 401 } };

    const file = formData.get('file');
    const salt = formData.get('salt');
    const iv = formData.get('iv');
    const fileHash = formData.get('file_hash');
    const expiryHours = formData.get('expiry_hours') || 'none';
    const iterations = parseInt(formData.get('iterations') || '600000');

    const docId = uid();

    // Store encrypted file data in IndexedDB (handles large files)
    const arrayBuffer = await file.arrayBuffer();
    await saveFileData(docId, arrayBuffer);

    // Calculate expiry — null means no expiration
    const expiry_time = expiryHours === 'none'
      ? null
      : new Date(Date.now() + parseInt(expiryHours) * 60 * 60 * 1000).toISOString();

    const doc = {
      id: docId,
      user_id: user.id,
      filename: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/pdf',
      file_hash: fileHash || 'demo-hash',
      salt: salt,
      iv: iv,
      encryption_algorithm: 'AES-256-GCM',
      iterations,
      upload_time: new Date().toISOString(),
      expiry_time,
      status: 'active',
      download_count: 0,
    };

    const docs = getDocs();
    docs.push(doc);
    saveDocs(docs);

    return { data: doc };
  },

  async list() {
    await delay(300);
    const user = JSON.parse(localStorage.getItem(DEMO_CURRENT) || 'null');
    if (!user) throw { response: { status: 401 } };
    const docs = getDocs().filter(d => d.user_id === user.id);
    return { data: docs };
  },

  async get(id) {
    await delay(200);
    const doc = getDocs().find(d => d.id === id);
    if (!doc) throw { response: { status: 404, data: { detail: 'Document not found' } } };
    return { data: doc };
  },

  async download(id) {
    await delay(300);
    const doc = getDocs().find(d => d.id === id);
    if (!doc) throw { response: { status: 404 } };

    // Update download count
    const docs = getDocs();
    const idx = docs.findIndex(d => d.id === id);
    if (idx >= 0) { docs[idx].download_count++; saveDocs(docs); }

    // Retrieve encrypted file data from IndexedDB
    const fileData = await getFileData(id);
    if (!fileData) throw { response: { status: 404, data: { detail: 'File data not found' } } };

    return {
      data: fileData,
      headers: {
        'x-file-hash': doc.file_hash,
        'x-salt': doc.salt,
        'x-iv': doc.iv,
      },
    };
  },

  async delete(id) {
    await delay(300);
    await deleteFileData(id);
    let docs = getDocs();
    docs = docs.filter(d => d.id !== id);
    saveDocs(docs);
    return { data: { message: 'Deleted' } };
  },
};

// ── Encryption API (demo — encryption happens client-side anyway) ──
export const demoEncryptionAPI = {
  async encrypt(data) { return { data: { status: 'ok' } }; },
  async decrypt(data) { return { data: { status: 'ok' } }; },
};

// ── Audit API (demo) ─────────────────────────────────────
export const demoAuditAPI = {
  async getLogs() { return { data: [] }; },
  async getStats() {
    const docs = getDocs();
    return {
      data: {
        total_documents: docs.length,
        total_events: docs.length * 2,
        security_events: 0,
      },
    };
  },
  async getSecurityEvents() { return { data: [] }; },
};
