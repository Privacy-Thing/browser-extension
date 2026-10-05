// Content scripts use the page's IndexedDB origin; this database belongs only to
// trusted extension pages and the background, on both Chromium and Firefox.
const DATABASE = "pt.experimental.control-d.credentials";
const STORE = "keys";
const KEY = "api-key";

const openKeyDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const accessApiKey = async (
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> => {
  const database = await openKeyDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error);
    });
  } finally {
    database.close();
  }
};

export const readPrivateApiKey = async (): Promise<string | null> => {
  const value = await accessApiKey("readonly", (store) => store.get(KEY));
  return typeof value === "string" && value.trim() ? value : null;
};

export const writePrivateApiKey = async (value: string): Promise<void> => {
  await accessApiKey("readwrite", (store) => store.put(value, KEY));
};

export const deletePrivateApiKey = async (): Promise<void> => {
  await accessApiKey("readwrite", (store) => store.delete(KEY));
};
