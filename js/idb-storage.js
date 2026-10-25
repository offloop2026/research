/**
 * ARCHIVE OF MATTER - INDEXEDDB STORAGE MANAGER (idb-storage.js)
 * Provides high-capacity, persistent local storage for Field Research entries
 * and large media assets (photos, videos, audio) avoiding localStorage's ~5MB limit.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.idbStorage = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const DB_NAME = 'ArchiveOfMatterDB';
  const DB_VERSION = 2;
  const STORE_RESEARCH = 'field_research';
  const STORE_MEDIA = 'media_store';
  const STORE_ARCHIVE = 'archive_state';
  const LS_RESEARCH_KEY = 'archive_field_research_v1';
  const LS_MIGRATED_KEY = 'archive_fr_migrated_to_idb';
  const LS_CUSTOM_KEY = 'archive_user_custom_v3';

  const isSupported = (typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null);

  let dbPromise = null;
  const activeObjectUrls = new Map(); // mediaId -> objectUrl

  /**
   * Open or get existing IndexedDB instance
   */
  function getDB() {
    if (!isSupported) {
      return Promise.reject(new Error('IndexedDB is not supported in this environment'));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // 1. Field Research Object Store
        if (!db.objectStoreNames.contains(STORE_RESEARCH)) {
          const researchStore = db.createObjectStore(STORE_RESEARCH, { keyPath: 'id' });
          researchStore.createIndex('date', 'date', { unique: false });
          researchStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        // 2. Large Media Blobs Store (Photos & Videos)
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          const mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
          mediaStore.createIndex('mimeType', 'mimeType', { unique: false });
          mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        // 3. Complete Archive State Store (Objects, Memos, Layout)
        if (!db.objectStoreNames.contains(STORE_ARCHIVE)) {
          db.createObjectStore(STORE_ARCHIVE);
        }
      };

      req.onsuccess = (e) => {
        const db = e.target.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      req.onerror = (e) => {
        console.error('[IndexedDB] Open request failed:', e.target.error);
        dbPromise = null;
        reject(e.target.error);
      };

      req.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked. Please close other open tabs of this app.');
      };
    });

    return dbPromise;
  }

  /**
   * Helper: Promisify an IDBRequest
   */
  function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDBRequest failed'));
    });
  }

  /**
   * Helper: Promisify an IDBTransaction completion
   */
  function promisifyTx(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      tx.onerror = () => reject(tx.error || new Error('Transaction error'));
    });
  }

  /**
   * Convert DataURL / Base64 string to Blob
   */
  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return null;
    }
    try {
      const parts = dataUrl.split(',');
      const match = parts[0].match(/:(.*?);/);
      const mime = match ? match[1] : 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.warn('[idbStorage] dataUrlToBlob failed:', e);
      return null;
    }
  }

  /**
   * Store a media Blob/File in media_store
   * @param {Blob|File} fileOrBlob
   * @param {string} [customId]
   * @returns {Promise<{ id: string, mimeType: string, url: string, size: number }>}
   */
  async function saveMediaBlob(fileOrBlob, customId = null) {
    if (!fileOrBlob) throw new Error('No file or blob provided');

    const id = customId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const mimeType = fileOrBlob.type || 'application/octet-stream';
    const name = fileOrBlob.name || id;
    const size = fileOrBlob.size || 0;

    const record = {
      id,
      blob: fileOrBlob,
      mimeType,
      name,
      size,
      createdAt: new Date().toISOString()
    };

    if (!isSupported) {
      // Memory fallback for environments without IndexedDB
      const url = (typeof URL !== 'undefined' && URL.createObjectURL)
        ? URL.createObjectURL(fileOrBlob)
        : '';
      activeObjectUrls.set(id, url);
      return { id, mimeType, url, size };
    }

    const db = await getDB();
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    store.put(record);
    await promisifyTx(tx);

    let url = '';
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      url = URL.createObjectURL(fileOrBlob);
      activeObjectUrls.set(id, url);
    }

    return { id, mimeType, url, size };
  }

  /**
   * Retrieve a media Blob by ID and return with active ObjectURL
   */
  async function getMediaBlob(id) {
    if (!id) return null;

    if (activeObjectUrls.has(id)) {
      const cachedUrl = activeObjectUrls.get(id);
      return { id, url: cachedUrl };
    }

    if (!isSupported) return null;

    try {
      const db = await getDB();
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const record = await promisifyRequest(store.get(id));
      if (!record || !record.blob) return null;

      let url = '';
      if (typeof URL !== 'undefined' && URL.createObjectURL) {
        url = URL.createObjectURL(record.blob);
        activeObjectUrls.set(id, url);
      }
      return { id, blob: record.blob, mimeType: record.mimeType, url, name: record.name };
    } catch (e) {
      console.warn('[idbStorage] getMediaBlob error for', id, e);
      return null;
    }
  }

  /**
   * Delete a media item by ID
   */
  async function deleteMediaBlob(id) {
    if (!id) return;
    if (activeObjectUrls.has(id)) {
      try {
        URL.revokeObjectURL(activeObjectUrls.get(id));
      } catch (e) {}
      activeObjectUrls.delete(id);
    }
    if (!isSupported) return;

    try {
      const db = await getDB();
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      tx.objectStore(STORE_MEDIA).delete(id);
      await promisifyTx(tx);
    } catch (e) {
      console.warn('[idbStorage] deleteMediaBlob error:', e);
    }
  }

  /**
   * Rehydrate research entry blocks: resolve mediaId to live Object URLs
   */
  async function hydrateEntryMedia(entry) {
    if (!entry || !entry.blocks || !Array.isArray(entry.blocks)) return entry;

    for (const blk of entry.blocks) {
      if (!blk) continue;

      // If block has mediaId, fetch the blob and get live URL
      if (blk.mediaId) {
        const media = await getMediaBlob(blk.mediaId);
        if (media && media.url) {
          if (blk.type === 'video') {
            blk.video = media.url;
            blk.mediaUrl = media.url;
          } else {
            blk.image = media.url;
            blk.mediaUrl = media.url;
          }
        }
      } else if (blk.image && blk.image.startsWith('data:')) {
        // Transparently migrate heavy Base64 strings to IndexedDB Blobs
        try {
          const blob = dataUrlToBlob(blk.image);
          if (blob) {
            const savedMedia = await saveMediaBlob(blob);
            blk.mediaId = savedMedia.id;
            blk.image = savedMedia.url;
          }
        } catch (e) {
          console.warn('[idbStorage] Auto-migrating Base64 block failed:', e);
        }
      }
    }
    return entry;
  }

  /**
   * Prepare research entry before saving: extract any raw Blobs or heavy Base64 to STORE_MEDIA
   */
  async function prepareEntryForSave(entry) {
    if (!entry) return entry;
    const cleanEntry = JSON.parse(JSON.stringify(entry));
    cleanEntry.updatedAt = new Date().toISOString();

    if (cleanEntry.blocks && Array.isArray(cleanEntry.blocks)) {
      for (let i = 0; i < cleanEntry.blocks.length; i++) {
        const blk = cleanEntry.blocks[i];
        if (!blk) continue;

        // Check if original entry had an active File or Blob in blk._file or blk._blob
        const origBlk = entry.blocks[i];
        const rawFile = origBlk && (origBlk._file || origBlk._blob || origBlk.file || origBlk.blob);

        if (rawFile && (rawFile instanceof Blob || (typeof File !== 'undefined' && rawFile instanceof File))) {
          const media = await saveMediaBlob(rawFile, blk.mediaId || null);
          blk.mediaId = media.id;
          if (blk.type === 'video') {
            blk.video = media.url;
            blk.mediaUrl = media.url;
          } else {
            blk.image = media.url;
            blk.mediaUrl = media.url;
          }
        } else if (blk.image && blk.image.startsWith('data:')) {
          // If Base64 string was inserted, convert to Blob and store in media_store
          const blob = dataUrlToBlob(blk.image);
          if (blob) {
            const media = await saveMediaBlob(blob, blk.mediaId || null);
            blk.mediaId = media.id;
            blk.image = media.url;
          }
        } else if (blk.video && blk.video.startsWith('data:')) {
          const blob = dataUrlToBlob(blk.video);
          if (blob) {
            const media = await saveMediaBlob(blob, blk.mediaId || null);
            blk.mediaId = media.id;
            blk.video = media.url;
            blk.mediaUrl = media.url;
          }
        }
      }
    }

    return cleanEntry;
  }

  // Fallback in-memory store for unit test / Node.js environments
  const memoryStore = new Map();

  /**
   * Get all Field Research entries from IndexedDB
   * @returns {Promise<Array>}
   */
  async function getAllResearch() {
    if (!isSupported) {
      return Array.from(memoryStore.values());
    }

    const db = await getDB();
    const tx = db.transaction(STORE_RESEARCH, 'readonly');
    const store = tx.objectStore(STORE_RESEARCH);
    const rawList = await promisifyRequest(store.getAll());
    const list = Array.isArray(rawList) ? rawList : [];

    // Hydrate all media blobs into active object URLs
    for (const item of list) {
      await hydrateEntryMedia(item);
    }

    // Sort by numStr or id or date descending
    list.sort((a, b) => {
      const numA = parseInt(a.numStr || '0', 10);
      const numB = parseInt(b.numStr || '0', 10);
      if (numA && numB && numA !== numB) return numB - numA;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

    return list;
  }

  /**
   * Get a single Field Research entry by ID
   */
  async function getResearch(id) {
    if (!id) return null;
    if (!isSupported) {
      return memoryStore.get(id) || null;
    }

    const db = await getDB();
    const tx = db.transaction(STORE_RESEARCH, 'readonly');
    const store = tx.objectStore(STORE_RESEARCH);
    const item = await promisifyRequest(store.get(id));
    if (!item) return null;
    await hydrateEntryMedia(item);
    return item;
  }

  /**
   * Save (insert or update) a Field Research entry in IndexedDB
   */
  async function saveResearch(entry) {
    if (!entry || !entry.id) throw new Error('Cannot save research without a valid ID');

    const cleanEntry = await prepareEntryForSave(entry);

    if (!isSupported) {
      memoryStore.set(cleanEntry.id, cleanEntry);
      return cleanEntry;
    }

    const db = await getDB();
    const tx = db.transaction(STORE_RESEARCH, 'readwrite');
    const store = tx.objectStore(STORE_RESEARCH);

    // IndexedDB record does not need transient runtime object URLs, keep mediaId
    store.put(cleanEntry);
    await promisifyTx(tx);

    // Rehydrate media in return object for immediate rendering
    await hydrateEntryMedia(cleanEntry);
    return cleanEntry;
  }

  /**
   * Delete a Field Research entry from IndexedDB
   */
  async function deleteResearch(id) {
    if (!id) return;
    if (!isSupported) {
      memoryStore.delete(id);
      return;
    }

    const db = await getDB();
    const tx = db.transaction(STORE_RESEARCH, 'readwrite');
    const store = tx.objectStore(STORE_RESEARCH);
    store.delete(id);
    await promisifyTx(tx);
  }

  /**
   * Migrate existing localStorage records to IndexedDB once
   */
  async function migrateFromLocalStorage() {
    if (!isSupported) return false;

    try {
      const raw = localStorage.getItem(LS_RESEARCH_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return false;

      console.log(`[idbStorage] Migrating ${parsed.length} entries from localStorage to IndexedDB...`);

      const db = await getDB();
      const tx = db.transaction([STORE_RESEARCH, STORE_MEDIA], 'readwrite');
      const rStore = tx.objectStore(STORE_RESEARCH);
      const mStore = tx.objectStore(STORE_MEDIA);

      for (const entry of parsed) {
        if (!entry || !entry.id) continue;

        // Extract Base64 images into STORE_MEDIA to prevent Bloat
        if (entry.blocks && Array.isArray(entry.blocks)) {
          for (const blk of entry.blocks) {
            if (blk && blk.image && blk.image.startsWith('data:')) {
              try {
                const blob = dataUrlToBlob(blk.image);
                if (blob) {
                  const mediaId = `media-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                  mStore.put({
                    id: mediaId,
                    blob: blob,
                    mimeType: blob.type,
                    name: mediaId,
                    size: blob.size,
                    createdAt: new Date().toISOString()
                  });
                  blk.mediaId = mediaId;
                  blk.image = ''; // clear huge Base64 string
                }
              } catch (e) {
                console.warn('[idbStorage] Base64 migration error for block:', e);
              }
            }
          }
        }

        entry.updatedAt = entry.updatedAt || new Date().toISOString();
        rStore.put(entry);
      }

      await promisifyTx(tx);
      console.log('[idbStorage] Migration to IndexedDB completed successfully.');

      // Safely clear localStorage key to permanently eliminate QuotaExceededError
      try {
        localStorage.removeItem(LS_RESEARCH_KEY);
        localStorage.setItem(LS_MIGRATED_KEY, 'true');
      } catch (e) {}

      return true;
    } catch (err) {
      console.error('[idbStorage] Migration error:', err);
      return false;
    }
  }

  /**
   * Synchronously get live Object URL if already hydrated for a media ID
   */
  function getMediaUrl(id) {
    if (!id || typeof id !== 'string') return '';
    return activeObjectUrls.get(id) || '';
  }

  /**
   * Retrieve all Media Blob records (photos, videos) from STORE_MEDIA
   */
  async function getAllMediaBlobs() {
    if (!isSupported) return [];
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const records = await promisifyRequest(store.getAll());
      if (!Array.isArray(records)) return [];
      const result = [];
      for (const rec of records) {
        if (!rec || !rec.blob) continue;
        let url = activeObjectUrls.get(rec.id);
        if (!url && typeof URL !== 'undefined' && URL.createObjectURL) {
          url = URL.createObjectURL(rec.blob);
          activeObjectUrls.set(rec.id, url);
        }
        result.push({
          id: rec.id,
          url,
          mimeType: rec.mimeType,
          name: rec.name,
          createdAt: rec.createdAt
        });
      }
      return result;
    } catch (e) {
      console.warn('[idbStorage] getAllMediaBlobs error:', e);
      return [];
    }
  }

  /**
   * Save complete Archive state (objects, memos, positions, connections) to IndexedDB
   * @param {Object} state
   * @returns {Promise<Object>}
   */
  async function saveArchiveState(state) {
    if (!state) return null;
    const cleanState = JSON.parse(JSON.stringify(state));
    cleanState.updatedAt = cleanState.updatedAt || new Date().toISOString();

    if (!isSupported) {
      memoryStore.set('main_archive', cleanState);
      return cleanState;
    }

    const db = await getDB();
    const tx = db.transaction(STORE_ARCHIVE, 'readwrite');
    const store = tx.objectStore(STORE_ARCHIVE);
    store.put(cleanState, 'main_archive');
    await promisifyTx(tx);
    return cleanState;
  }

  /**
   * Retrieve complete Archive state from IndexedDB
   * @returns {Promise<Object|null>}
   */
  async function getArchiveState() {
    if (!isSupported) {
      return memoryStore.get('main_archive') || null;
    }

    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORE_ARCHIVE)) return null;

      const tx = db.transaction(STORE_ARCHIVE, 'readonly');
      const store = tx.objectStore(STORE_ARCHIVE);
      const state = await promisifyRequest(store.get('main_archive'));
      if (state && Array.isArray(state.objects) && state.objects.length > 0) {
        return state;
      }
      return null;
    } catch (e) {
      console.warn('[idbStorage] getArchiveState error:', e);
      return null;
    }
  }

  /**
   * Clear Archive state from IndexedDB
   */
  async function clearArchiveState() {
    if (!isSupported) {
      memoryStore.delete('main_archive');
      return;
    }
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORE_ARCHIVE)) return;
      const tx = db.transaction(STORE_ARCHIVE, 'readwrite');
      tx.objectStore(STORE_ARCHIVE).delete('main_archive');
      await promisifyTx(tx);
    } catch (e) {
      console.warn('[idbStorage] clearArchiveState error:', e);
    }
  }

  // Public API
  return {
    isSupported,
    getDB,
    getAllResearch,
    getResearch,
    saveResearch,
    deleteResearch,
    saveMediaBlob,
    getMediaBlob,
    deleteMediaBlob,
    getAllMediaBlobs,
    getMediaUrl,
    saveArchiveState,
    getArchiveState,
    clearArchiveState,
    dataUrlToBlob,
    hydrateEntryMedia,
    migrateFromLocalStorage
  };
}));
