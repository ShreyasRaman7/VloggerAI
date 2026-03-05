import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.env.DATA_ROOT || (process.env.VERCEL ? '/tmp/vlogger-ai' : path.join(process.cwd(), '.data'));
const STORE_PATH = path.join(ROOT, 'store.json');

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ projects: [], assets: [] }, null, 2));
  }
}

export function getPaths() {
  ensureRoot();
  return {
    root: ROOT,
    uploads: path.join(ROOT, 'uploads'),
    outputs: path.join(ROOT, 'outputs'),
    chunks: path.join(ROOT, 'chunks')
  };
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function readStore() {
  ensureRoot();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

export function writeStore(store) {
  ensureRoot();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function createProject(name) {
  const store = readStore();
  const project = {
    id: makeId('proj'),
    name,
    status: 'draft',
    theme: 'Spain',
    prompt: '',
    assets: [],
    audioAssetId: null,
    outputPath: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.projects.unshift(project);
  writeStore(store);
  return project;
}

export function updateProject(projectId, patch) {
  const store = readStore();
  const idx = store.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;
  store.projects[idx] = { ...store.projects[idx], ...patch, updatedAt: new Date().toISOString() };
  writeStore(store);
  return store.projects[idx];
}

export function addAsset(projectId, asset) {
  const store = readStore();
  const p = store.projects.find((x) => x.id === projectId);
  if (!p) return null;
  const item = { id: makeId('asset'), projectId, createdAt: new Date().toISOString(), ...asset };
  store.assets.push(item);
  p.assets.push(item.id);
  p.updatedAt = new Date().toISOString();
  writeStore(store);
  return item;
}

export function getProject(projectId) {
  const store = readStore();
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const assets = store.assets.filter((a) => a.projectId === projectId);
  return { ...project, assetsMeta: assets };
}

export function listProjects() {
  return readStore().projects;
}

export function getAsset(assetId) {
  return readStore().assets.find((a) => a.id === assetId) || null;
}

export function mediaFolderForProject(projectId) {
  const p = getPaths();
  const dir = path.join(p.uploads, projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
