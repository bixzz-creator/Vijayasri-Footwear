import { useCallback, useState } from 'react';
import { extractCatalogMetadata, type AIEngine } from '@vijayasri/ai';

export interface PhotoRenameEntry {
  oldName: string;
  newName: string;
  brand: string;
  gender: string;
  category: string;
  artNumber: string;
  color: string;
  price: number | null;
  status: 'pending' | 'analyzing' | 'ok' | 'error' | 'renamed' | 'skipped';
  error?: string;
}

function sanitizeToken(value: string) {
  return value
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function categoryFileToken(category: string) {
  return category.replace(/-/g, '_').replace(/\s+/g, '_');
}

function buildFilename(meta: {
  brand: string;
  gender: string;
  category: string;
  artNumber: string;
  color: string;
  price: number | null;
}, ext: string, usedNames: Set<string>) {
  const parts = [
    sanitizeToken(meta.brand),
    meta.gender || 'Unisex',
    categoryFileToken(meta.category || 'Casual_Slippers'),
    meta.artNumber || 'Unknown',
    sanitizeToken(meta.color || 'Standard'),
    meta.price ? String(meta.price) : '499',
  ].filter(Boolean);

  let base = parts.join('_');
  let candidate = `${base}${ext}`;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter}${ext}`;
    counter++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function usePhotoRenamer() {
  const [entries, setEntries] = useState<PhotoRenameEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const pickFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('Your browser does not support folder rename. Use the CLI script instead.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    setDirHandle(handle);
    setFolderName(handle.name);

    const files: { name: string; handle: FileSystemFileHandle }[] = [];
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && /\.(jpe?g|png|webp)$/i.test(entry.name)) {
        files.push({ name: entry.name, handle: entry as FileSystemFileHandle });
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name));

    setEntries(files.map(f => ({
      oldName: f.name,
      newName: f.name,
      brand: '',
      gender: '',
      category: '',
      artNumber: '',
      color: '',
      price: null,
      status: 'pending',
    })));
    return files.length;
  }, []);

  const analyzeWithAi = useCallback(async (
    provider: AIEngine,
    apiKey: string,
    modelId?: string,
    onProgress?: (done: number, total: number) => void
  ) => {
    if (!dirHandle || entries.length === 0) {
      throw new Error('Select a folder first.');
    }
    if (!apiKey.trim()) {
      throw new Error('AI API key is required.');
    }

    setIsAnalyzing(true);
    const usedNames = new Set(entries.map(e => e.oldName.toLowerCase()));
    const updated = [...entries];

    try {
      for (let i = 0; i < updated.length; i++) {
        const entry = updated[i];
        updated[i] = { ...entry, status: 'analyzing' };
        setEntries([...updated]);
        onProgress?.(i, updated.length);

        try {
          const fileHandle = await dirHandle.getFileHandle(entry.oldName);
          const file = await fileHandle.getFile();
          const base64 = await fileToBase64(file);
          const meta = await extractCatalogMetadata(provider, apiKey.trim(), base64, modelId);
          const ext = entry.oldName.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.jpeg';
          const newName = buildFilename({
            brand: meta.brand,
            gender: meta.gender,
            category: meta.category,
            artNumber: meta.artNumber.toUpperCase(),
            color: meta.color,
            price: meta.price,
          }, ext, usedNames);

          updated[i] = {
            oldName: entry.oldName,
            newName,
            brand: meta.brand,
            gender: meta.gender,
            category: meta.category,
            artNumber: meta.artNumber,
            color: meta.color,
            price: meta.price,
            status: 'ok',
          };
        } catch (err) {
          updated[i] = {
            ...entry,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          };
        }
        setEntries([...updated]);
      }
      onProgress?.(updated.length, updated.length);
    } finally {
      setIsAnalyzing(false);
    }
  }, [dirHandle, entries]);

  const applyRenames = useCallback(async () => {
    if (!dirHandle) throw new Error('Select a folder first.');
    setIsApplying(true);
    const updated = [...entries];
    let renamed = 0;

    try {
      for (let i = 0; i < updated.length; i++) {
        const entry = updated[i];
        if (entry.status !== 'ok' || entry.oldName === entry.newName) {
          updated[i] = { ...entry, status: 'skipped' };
          continue;
        }

        try {
          const fileHandle = await dirHandle.getFileHandle(entry.oldName);
          const file = await fileHandle.getFile();
          const newHandle = await dirHandle.getFileHandle(entry.newName, { create: true });
          const writable = await newHandle.createWritable();
          await writable.write(await file.arrayBuffer());
          await writable.close();
          await dirHandle.removeEntry(entry.oldName);
          updated[i] = { ...entry, status: 'renamed' };
          renamed++;
        } catch (err) {
          updated[i] = {
            ...entry,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          };
        }
        setEntries([...updated]);
      }
      return renamed;
    } finally {
      setIsApplying(false);
    }
  }, [dirHandle, entries]);

  const downloadManifest = useCallback(() => {
    const lines = [
      'old_name,new_name,brand,gender,category,art_number,color,price,status,error',
      ...entries.map(e =>
        [e.oldName, e.newName, e.brand, e.gender, e.category, e.artNumber, e.color, e.price, e.status, e.error ?? '']
          .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rename-manifest.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const reset = useCallback(() => {
    setEntries([]);
    setDirHandle(null);
    setFolderName('');
  }, []);

  return {
    entries,
    isAnalyzing,
    isApplying,
    folderName,
    pickFolder,
    analyzeWithAi,
    applyRenames,
    downloadManifest,
    reset,
    hasFolderSupport: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  };
}

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}
