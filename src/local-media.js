import { uuid, safeUrl } from './utils.js';

const urls = new Map();
let database;
function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('nabin-portfolio-preview-media', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser could not open local image storage.'));
  });
  return database;
}
async function transaction(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', mode); const request = action(tx.objectStore('assets'));
    let result; request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result); tx.onerror = () => reject(new Error('Local media could not be saved. Your browser storage may be full.'));
    tx.onabort = () => reject(new Error('Local media operation was cancelled.'));
  });
}
function register(asset) {
  const reference = `local-media:${asset.id}`;
  if (urls.has(reference)) URL.revokeObjectURL(urls.get(reference));
  urls.set(reference, URL.createObjectURL(asset.blob));
  return reference;
}
export async function hydrateLocalMedia() {
  const assets = await transaction('readonly', store => store.getAll());
  for (const asset of assets) if (!urls.has(`local-media:${asset.id}`)) register(asset);
  return assets;
}
export async function putLocalMedia(file) {
  const id = uuid();
  const asset = { id, name: file.name, type: file.type, size: file.size, createdAt: new Date().toISOString(), blob: file };
  await transaction('readwrite', store => store.put(asset));
  return { path: id, url: register(asset) };
}
export async function listLocalMedia() {
  const assets = await hydrateLocalMedia();
  return assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(asset => ({ name: asset.name, path: asset.id, url: `local-media:${asset.id}`, size: asset.size }));
}
export async function deleteLocalMedia(id) {
  await transaction('readwrite', store => store.delete(id));
  const reference = `local-media:${id}`; if (urls.has(reference)) URL.revokeObjectURL(urls.get(reference)); urls.delete(reference);
}
export function mediaUrl(value) {
  if (typeof value === 'string' && value.startsWith('local-media:')) return urls.get(value) || '';
  return safeUrl(value);
}
