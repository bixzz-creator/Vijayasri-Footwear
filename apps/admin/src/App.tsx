import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  db,
  saveCredentials,
  loadCredentials,
  clearCredentials,
  hasCredentials,
  savePublicStorefrontConfig,
  clearPublicStorefrontConfig,
  assertUuid,
  sanitizeImportCategory,
  sanitizeImportCollections,
} from '@vijayasri/database';
import { ai, AIInitOptions, testOcrSpaceConnection } from '@vijayasri/ai';
import { useBatchProcessor } from './hooks/useBatchProcessor';
import { usePhotoRenamer } from './hooks/usePhotoRenamer';
import { generateSku, formatCurrency, Product, ProductStatus, PresentationSettings, DEFAULT_PRESENTATION_SETTINGS, loadPresentationSettings, savePresentationSettings, computePremiumPricing, ImportMode, ADMIN_FOOTWEAR_CATEGORIES, coerceAdminCategory } from '@vijayasri/shared';
import { Badge, Modal, ToastProvider, useToast } from '@vijayasri/ui';
import {
  LayoutDashboard,
  FolderInput,
  Database,
  Tag,
  PhoneCall,
  History,
  Settings,
  Plus,
  Save,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Edit,
  Sparkles,
  ShoppingBag,
  Play,
  Pause,
  XCircle,
  Eye,
  Download,
  Upload,
  User,
  FileText,
  FolderSync,
  Menu,
  X
} from 'lucide-react';
import '@vijayasri/ui';

// AdminDashboard Inner Component
function AdminDashboard() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'importer' | 'products' | 'brands' | 'leads' | 'logs' | 'settings' | 'studio' | 'profile'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Connection / Keys State
  const [passcode, setPasscode] = useState('VijayaSriSecretPass');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [showUnlockPasscode, setShowUnlockPasscode] = useState(false);
  const [dbMode, setDbMode] = useState<'demo' | 'supabase'>('demo');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [ocrApiKey, setOcrApiKey] = useState('');
  const [aiProvider] = useState<'ocrspace'>('ocrspace');
  const [showApiKey, setShowApiKey] = useState(false);
  const [liveAiMode, setLiveAiMode] = useState(false);
  const [aiConnectionStatus, setAiConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [testImageBase64, setTestImageBase64] = useState<string | null>(null);
  const [testResultJson, setTestResultJson] = useState<string | null>(null);
  const [isTestingImage, setIsTestingImage] = useState(false);

  // DB Data State
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);
  const [layout, setLayout] = useState<any>(null);
  const [festivalMode, setFestivalMode] = useState<string>('normal');

  // Configuration settings for AI Importer
  const [mrpMargin, setMrpMargin] = useState(15);
  const [roundingRule, setRoundingRule] = useState<'none' | 'nearest-9' | 'nearest-5'>('nearest-9');
  const [presentationSettings, setPresentationSettings] = useState<PresentationSettings>(() => loadPresentationSettings());
  const [importMode, setImportMode] = useState<ImportMode>(() => {
    if (typeof localStorage === 'undefined') return 'catalog';
    const saved = localStorage.getItem('vijayasri_import_mode');
    return saved === 'ai' ? 'ai' : 'catalog';
  });

  const handleImportModeChange = (mode: ImportMode) => {
    setImportMode(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('vijayasri_import_mode', mode);
    }
  };

  const aiProviderName = 'OCR.space';
  const activeAiApiKey = ocrApiKey;

  const hasAiApiKey = Boolean(ocrApiKey.trim());
  const aiLiveConnected = liveAiMode && hasAiApiKey && aiConnectionStatus !== 'failed';

  const buildAiInitOptions = (): AIInitOptions => ({
    ocrApiKey,
    aiProvider: 'ocrspace',
  });

  const initLiveAi = () => {
    if (!hasAiApiKey) {
      ai.init(undefined);
      return;
    }
    ai.init(buildAiInitOptions());
  };

  const testAiConnection = async (silent = false): Promise<boolean> => {
    if (!hasAiApiKey) {
      if (!silent) showToast(`Add a ${aiProviderName} API key in Settings first.`, 'error');
      return false;
    }
    setIsTestingAi(true);
    setAiConnectionStatus('testing');
    try {
      initLiveAi();
      if (!silent) showToast(`Testing ${aiProviderName} connection...`, 'info');
      await testOcrSpaceConnection(activeAiApiKey.trim());
      setLiveAiMode(true);
      setAiConnectionStatus('connected');
      initLiveAi();
      if (!silent) {
        showToast(
          `Live ${aiProviderName} connected! Using ${ai.activeModelLabel ?? aiProviderName}.`,
          'success'
        );
      }
      return true;
    } catch (err: unknown) {
      setLiveAiMode(false);
      setAiConnectionStatus('failed');
      ai.init(undefined);
      if (!silent) {
        showToast(`OCR connection failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
      return false;
    } finally {
      setIsTestingAi(false);
    }
  };

  const applyLoadedCredentials = (creds: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    ocrApiKey?: string;
    geminiApiKey?: string;
  }) => {
    setSupabaseUrl(creds.supabaseUrl ?? '');
    setSupabaseAnonKey(creds.supabaseAnonKey ?? '');
    const key = creds.ocrApiKey ?? creds.geminiApiKey ?? '';
    setOcrApiKey(key);
    const hasKey = Boolean(key.trim());
    setLiveAiMode(hasKey);
    setAiConnectionStatus(hasKey ? 'connected' : 'idle');
    if (hasKey) {
      ai.init({
        ocrApiKey: key,
        aiProvider: 'ocrspace',
      });
      handleImportModeChange('ai');
    } else {
      ai.init(undefined);
    }
  };

  useEffect(() => {
    if (!liveAiMode && importMode === 'ai') {
      handleImportModeChange('catalog');
    }
  }, [liveAiMode, importMode]);

  const updatePresentationSetting = (key: keyof PresentationSettings, value: boolean) => {
    setPresentationSettings(prev => {
      const next = { ...prev, [key]: value };
      savePresentationSettings(next);
      if (supabaseUrl.trim() && supabaseAnonKey.trim()) {
        savePublicStorefrontConfig({
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseAnonKey.trim(),
          presentationSettings: {
            enableSmartPricing: next.enableSmartPricing,
            enableDiscountGenerator: next.enableDiscountGenerator,
          },
        });
      }
      return next;
    });
  };

  // Product Editor Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  
  // Product Form Fields
  const [prodName, setProdName] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodCategory, setProdCategory] = useState('Slides');
  const [prodGender, setProdGender] = useState<'Men' | 'Women' | 'Kids' | 'Unisex'>('Men');
  const [prodMaterial, setProdMaterial] = useState('EVA');
  const [prodMrp, setProdMrp] = useState(499);
  const [prodOfferPrice, setProdOfferPrice] = useState(399);
  const [prodDesc, setProdDesc] = useState('');
  const [prodStatus, setProdStatus] = useState<ProductStatus>('draft');
  const [prodFeatures, setProdFeatures] = useState('');
  const [prodTags, setProdTags] = useState('');
  const [prodCollections, setProdCollections] = useState('');
  const [prodColor, setProdColor] = useState('Black');
  const [prodStock, setProdStock] = useState<Record<number, number>>({ 6: 10, 7: 10, 8: 10, 9: 10, 10: 10 });
  const [prodImages, setProdImages] = useState<{ url: string; is_primary: boolean; sort_order: number }[]>([]);
  const [customImageUrl, setCustomImageUrl] = useState('');

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setProdImages(prev => [
            ...prev,
            { url: dataUrl, is_primary: prev.length === 0, sort_order: prev.length }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddImageUrl = () => {
    if (!customImageUrl.trim()) return;
    setProdImages(prev => [
      ...prev,
      { url: customImageUrl.trim(), is_primary: prev.length === 0, sort_order: prev.length }
    ]);
    setCustomImageUrl('');
  };

  const handleRemoveProductImage = (index: number) => {
    setProdImages(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length > 0 && !filtered.some(img => img.is_primary)) {
        filtered[0].is_primary = true;
      }
      return filtered;
    });
  };

  const handleSetPrimaryImage = (index: number) => {
    setProdImages(prev => prev.map((img, i) => ({
      ...img,
      is_primary: i === index
    })));
  };

  const handleExportCSV = (type: 'products' | 'inventory' | 'leads') => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      if (type === 'products') {
        csvContent += "ID,Name,Brand,Category,Gender,MRP,OfferPrice,Status\n";
        products.forEach(p => {
          csvContent += `"${p.id}","${p.name}","${p.brandName}","${p.category}","${p.gender}",${p.mrp},${p.offer_price},"${p.status}"\n`;
        });
      } else if (type === 'inventory') {
        csvContent += "ProductID,ProductName,Color,Size,Stock\n";
        products.forEach(p => {
          p.variants?.forEach((v: any) => {
            v.sizes?.forEach((s: any) => {
              csvContent += `"${p.id}","${p.name}","${v.color}",${s.size_number},${s.stock}\n`;
            });
          });
        });
      } else if (type === 'leads') {
        csvContent += "ID,Phone,Source,Status,CreatedAt\n";
        leads.forEach(l => {
          csvContent += `"${l.id}","${l.phone}","${l.source}","${l.status}","${l.created_at}"\n`;
        });
      }
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `vijayasri_${type}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`${type.toUpperCase()} CSV Report downloaded!`);
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const handleBackupDatabase = async () => {
    try {
      const allProducts = await db.getProducts();
      const allLeads = await db.getLeads();
      const allLogs = await db.getLogs();
      const backupData = {
        products: allProducts,
        leads: allLeads,
        logs: allLogs,
        backupDate: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vijayasri_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      showToast('Database Backup exported successfully!');
    } catch (err: any) {
      showToast(`Backup failed: ${err.message}`, 'error');
    }
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        if (backupData.products) {
          for (const prod of backupData.products) {
            await db.saveProduct(prod, prod.features || [], prod.tags || [], prod.collections || [], prod.variants || []);
          }
          const refreshed = await db.getProducts();
          setProducts(refreshed);
          showToast('Database restored successfully from backup!');
        } else {
          showToast('Invalid backup file format.', 'error');
        }
      } catch (err: any) {
        showToast(`Restore failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const [newBrandName, setNewBrandName] = useState('');

  // AI Banner / Poster Generator
  const [bannerTitle, setBannerTitle] = useState('Comfort Slide');
  const [bannerDiscount, setBannerDiscount] = useState('Flat 20% Off');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleGenerateBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    // Set 800x400 dimensions
    canvas.width = 800;
    canvas.height = 400;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 800, 400);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 400);

    // Decorative circle
    ctx.fillStyle = 'rgba(197, 168, 128, 0.06)';
    ctx.beginPath();
    ctx.arc(600, 200, 240, 0, Math.PI * 2);
    ctx.fill();

    // Text details
    ctx.fillStyle = '#C5A880';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('VIJAYASRI FOOTWEAR SPECIALS', 50, 80);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(bannerTitle.toUpperCase(), 50, 150);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(bannerDiscount.toUpperCase(), 50, 215);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px sans-serif';
    ctx.fillText('Float through your day. Comfort EVA slippers.', 50, 275);

    // Button
    ctx.fillStyle = '#C5A880';
    ctx.fillRect(50, 315, 140, 40);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('SHOP NOW', 90, 338);

    // Slipper Image Overlay (drawing latest product)
    if (products.length > 0) {
      const activeProd = products.find(p => p.status === 'published') || products[0];
      const imgUrl = activeProd.variants?.[0]?.images?.[0]?.url;
      if (imgUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          ctx.translate(585, 200);
          ctx.rotate(-12 * Math.PI / 180);
          ctx.drawImage(img, -130, -130, 260, 260);
          ctx.restore();
        };
        img.src = imgUrl;
      }
    }
  };

  // Bulk table actions selection
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkPriceChange, setBulkPriceChange] = useState('');
  const [bulkOfferPriceChange, setBulkOfferPriceChange] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const catalogRefreshTimerRef = useRef<number | null>(null);
  const refreshAllDataRef = useRef<() => Promise<void>>(async () => {});

  // AI Details Edit Drawer
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<any | null>(null);
  const [drawerDesc, setDrawerDesc] = useState('');
  const [drawerFeatures, setDrawerFeatures] = useState('');
  const [drawerTags, setDrawerTags] = useState('');
  const [drawerCollections, setDrawerCollections] = useState('');

  // Folder Uploader Hook
  const {
    queue,
    isProcessing,
    elapsedTime,
    remainingTime,
    addFiles,
    start,
    pause,
    cancel,
    retryFailed,
    retryItem,
    removeItem,
    setQueue
  } = useBatchProcessor(mrpMargin, roundingRule, presentationSettings, importMode, () => {
    if (catalogRefreshTimerRef.current) window.clearTimeout(catalogRefreshTimerRef.current);
    catalogRefreshTimerRef.current = window.setTimeout(() => {
      void refreshAllDataRef.current();
    }, 1200);
  }, (finalQueue) => {
    const ok = finalQueue.filter(item => item.status === 'completed').length;
    const fail = finalQueue.filter(item => item.status === 'failed').length;
    if (catalogRefreshTimerRef.current) window.clearTimeout(catalogRefreshTimerRef.current);
    void refreshAllDataRef.current();
    showToast(
      fail > 0
        ? `Import finished: ${ok} published, ${fail} failed. Review failed items and retry.`
        : `Import finished: ${ok} products published. Catalog synced.`,
      fail > 0 ? 'warning' : 'success'
    );
  });

  const photoRenamer = usePhotoRenamer();

  // Attempt database unlock on boot
  useEffect(() => {
    async function checkSaved() {
      const saved = await hasCredentials();
      setVaultExists(saved);
      if (saved) {
        setIsUnlockModalOpen(true);
        await db.init();
        showToast('Secure credential vault detected. Please enter passcode to unlock.', 'info');
      } else {
        await db.init();
        await refreshAllData();
      }
    }
    checkSaved();
  }, []);

  const handleCreateVault = async () => {
    if (!passcode) {
      showToast('Passcode cannot be empty.', 'error');
      return;
    }
    try {
      await saveCredentials({
        supabaseUrl: '',
        supabaseAnonKey: '',
        ocrApiKey: '',
        aiProvider: 'ocrspace',
      }, passcode);
      setVaultExists(true);
      setIsUnlocked(true);
      await db.init();
      showToast('Secure vault created! Configure OCR API key and Supabase keys below.', 'success');
    } catch (e: any) {
      showToast('Failed to create secure vault: ' + e.message, 'error');
    }
  };

  const syncStorefrontConfig = (url: string, anonKey: string) => {
    if (url.trim() && anonKey.trim()) {
      savePublicStorefrontConfig({
        supabaseUrl: url.trim(),
        supabaseAnonKey: anonKey.trim(),
        presentationSettings: {
          enableSmartPricing: presentationSettings.enableSmartPricing,
          enableDiscountGenerator: presentationSettings.enableDiscountGenerator,
        },
      });
    }
  };

  const handleModalUnlock = async () => {
    if (!unlockPasscode) {
      showToast('Passcode cannot be empty.', 'error');
      return;
    }

    try {
      const creds = await loadCredentials(unlockPasscode);
      if (creds) {
        setPasscode(unlockPasscode);
        setIsUnlocked(true);
        applyLoadedCredentials(creds);

        if (creds.supabaseUrl && creds.supabaseAnonKey) {
          syncStorefrontConfig(creds.supabaseUrl, creds.supabaseAnonKey);
          const status = await db.init(unlockPasscode);
          if (!status.demoMode) {
            setDbMode('supabase');
            showToast('Successfully decrypted vault. Live Supabase database connected!', 'success');
          } else {
            setDbMode('demo');
            showToast('Vault decrypted. Supabase database offline.', 'info');
          }
        } else {
          setDbMode('demo');
          await db.init();
          showToast('Vault decrypted. Set Supabase keys to connect live database.', 'info');
        }
        setIsUnlockModalOpen(false);
      } else {
        showToast('Vault credentials empty.', 'warning');
      }
      await refreshAllData();
    } catch (e: any) {
      showToast('Incorrect passcode.', 'error');
    }
  };

  const handleModalResetVault = async () => {
    if (confirm('Are you sure you want to delete and reset the secure credential vault? All saved API keys will be lost.')) {
      await handleClearCredentials();
      setIsUnlockModalOpen(false);
    }
  };

  const handleUnlockAndConnect = async () => {
    if (!passcode) {
      showToast('Passcode cannot be empty.', 'error');
      return;
    }

    try {
      const creds = await loadCredentials(passcode);
      if (creds) {
        setIsUnlocked(true);
        applyLoadedCredentials(creds);
        
        if (creds.supabaseUrl && creds.supabaseAnonKey) {
          syncStorefrontConfig(creds.supabaseUrl, creds.supabaseAnonKey);
          const status = await db.init(passcode);
          if (!status.demoMode) {
            setDbMode('supabase');
            showToast('Successfully decrypted vault. Live Supabase database connected!', 'success');
          } else {
            setDbMode('demo');
            showToast('Vault decrypted successfully. Switched to offline Demo Mode since Supabase keys are inactive.', 'info');
          }
        } else {
          setDbMode('demo');
          await db.init();
          showToast('Vault decrypted successfully. Set Supabase keys to connect live database.', 'info');
        }
      } else {
        setIsUnlocked(true);
        setDbMode('demo');
        await db.init();
        showToast('Vault decrypted. Please configure Supabase and OCR API key.', 'info');
      }
      await refreshAllData();
    } catch (e: any) {
      setIsUnlocked(false);
      setDbMode('demo');
      showToast('Incorrect passcode. Decryption failed.', 'error');
    }
  };

  const handleSaveCredentials = async () => {
    if (!passcode) {
      showToast('Please set a passcode to encrypt credentials.', 'error');
      return;
    }
    try {
      await saveCredentials({
        supabaseUrl,
        supabaseAnonKey,
        ocrApiKey,
        aiProvider: 'ocrspace',
      }, passcode);
      
      setVaultExists(true);
      setIsUnlocked(true);
      
      if (supabaseUrl && supabaseAnonKey) {
        syncStorefrontConfig(supabaseUrl, supabaseAnonKey);
        const status = await db.init(passcode);
        if (!status.demoMode) {
          setDbMode('supabase');
        } else {
          setDbMode('demo');
        }
      } else {
        setDbMode('demo');
        await db.init();
      }
      
      setLiveAiMode(hasAiApiKey);
      initLiveAi();
      if (hasAiApiKey) {
        handleImportModeChange('ai');
        setAiConnectionStatus('connected');
        const ok = await testAiConnection(true);
        if (!ok) {
          showToast(`Key saved but ${aiProviderName} test failed. Click Test OCR Connection in Settings.`, 'error');
        }
      }
      showToast('API credentials encrypted and saved securely inside IndexedDB!', 'success');
      await refreshAllData();
    } catch (e: any) {
      showToast('Failed to encrypt credentials: ' + e.message, 'error');
    }
  };

  const handleClearCredentials = async () => {
    await clearCredentials();
    clearPublicStorefrontConfig();
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setOcrApiKey('');
    setLiveAiMode(false);
    setAiConnectionStatus('idle');
    ai.init(undefined);
    setIsUnlocked(false);
    setVaultExists(false);
    setDbMode('demo');
    await db.init();
    showToast('Secure credentials vault cleared. Returned to first-time setup.', 'info');
    await refreshAllData();
  };

  const refreshAllData = async () => {
    let currentStep = 'Supabase connection';
    try {
      currentStep = 'Fetching Products';
      const fetchedProducts = await db.getProducts();
      setProducts(fetchedProducts);

      currentStep = 'Fetching Brands';
      const fetchedBrands = await db.getBrands();
      setBrands(fetchedBrands);

      currentStep = 'Fetching CRM Leads';
      const fetchedLeads = await db.getLeads();
      setLeads(fetchedLeads);

      currentStep = 'Fetching Activity Logs';
      const fetchedLogs = await db.getLogs();
      setLogs(fetchedLogs);

      currentStep = 'Fetching Daily Summaries';
      const fetchedSummaries = await db.getDailySummaries();
      setDailySummaries(fetchedSummaries);

      currentStep = 'Fetching Homepage Layout';
      const branchId = await db.getDefaultBranchId();
      const fetchedLayout = await db.getHomepageLayout(branchId);
      setLayout(fetchedLayout);
      if (fetchedLayout) {
        setFestivalMode(fetchedLayout.festival_mode || 'normal');
      }
    } catch (e: any) {
      const errMsg = e?.message || e?.error_description || String(e);
      console.error(`[Database Sync Error] Failed during ${currentStep}:`, e);
      showToast(`Database Error during "${currentStep}": ${errMsg}`, 'error');
    }
  };

  refreshAllDataRef.current = refreshAllData;

  const catalogProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brandName?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.gender?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Bulk table selection toggles
  const handleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllProducts = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const handleApplyBulkPricing = async () => {
    if (selectedProductIds.length === 0) {
      showToast('No products selected for bulk editing.', 'warning');
      return;
    }
    const newMrp = parseFloat(bulkPriceChange);
    const newOffer = parseFloat(bulkOfferPriceChange);

    if (isNaN(newMrp) && isNaN(newOffer)) {
      showToast('Please enter a valid MRP or Offer Price.', 'error');
      return;
    }

    try {
      let count = 0;
      for (const id of selectedProductIds) {
        const fullProd = await db.getProduct(id);
        if (fullProd) {
          const updatedProduct = {
            ...fullProd,
            mrp: isNaN(newMrp) ? fullProd.mrp : newMrp,
            offer_price: isNaN(newOffer) ? fullProd.offer_price : newOffer,
            updated_at: new Date().toISOString()
          };

          const formattedVariants = fullProd.variants.map((v: any) => ({
            color: v.color,
            compositeHash: v.composite_hash,
            images: v.images.map((img: any) => ({ url: img.url, is_primary: img.is_primary, sort_order: img.sort_order })),
            sizes: v.sizes.map((s: any) => ({ size_number: s.size_number, stock: s.stock }))
          }));

          await db.saveProduct(
            updatedProduct,
            fullProd.features,
            fullProd.tags,
            fullProd.collections,
            formattedVariants
          );
          count++;
        }
      }

      await db.logActivity(
        dbMode === 'supabase' ? 'Admin Live' : 'Demo Admin',
        'BULK_PRICE_UPDATE',
        `Updated prices for ${count} products.`
      );

      showToast(`Successfully updated pricing for ${count} slippers!`, 'success');
      setSelectedProductIds([]);
      setBulkPriceChange('');
      setBulkOfferPriceChange('');
      await refreshAllData();
    } catch (e: any) {
      showToast('Bulk update failed: ' + e.message, 'error');
    }
  };

  // Brands Management
  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const slug = newBrandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await db.saveBrand({
        id: crypto.randomUUID(),
        name: newBrandName,
        logo_url: null,
        slug,
        created_at: new Date().toISOString()
      });
      showToast(`Brand "${newBrandName}" added successfully.`, 'success');
      setNewBrandName('');
      await refreshAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Product CRUD Modals
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdBrand(brands[0]?.id || '');
    setProdCategory('Slides');
    setProdGender('Men');
    setProdMaterial('EVA');
    setProdMrp(499);
    setProdOfferPrice(399);
    setProdDesc('');
    setProdStatus('published'); // Published directly so newly added items appear on the website!
    setProdFeatures('');
    setProdTags('');
    setProdCollections('');
    setProdColor('Black');
    setProdStock({ 6: 10, 7: 10, 8: 10, 9: 10, 10: 10 });
    setProdImages([]);
    setCustomImageUrl('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: any) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdBrand(product.brand_id);
    setProdCategory(coerceAdminCategory(product.category || 'Casual Slippers'));
    setProdGender(product.gender);
    setProdMaterial(product.material);
    setProdMrp(product.mrp);
    setProdOfferPrice(product.offer_price);
    setProdDesc(product.description);
    setProdStatus(product.status);
    setProdFeatures(product.features?.join('\n') || '');
    setProdTags(product.tags?.join(', ') || '');
    setProdCollections(product.collections?.join(', ') || '');
    
    const firstVariant = product.variants?.[0];
    setProdColor(firstVariant?.color || 'Black');
    
    const stockMap: Record<number, number> = {};
    firstVariant?.sizes?.forEach((s: any) => {
      stockMap[s.size_number] = s.stock;
    });
    setProdStock(stockMap);
    
    const existingImgs = firstVariant?.images || [];
    setProdImages(existingImgs.map((img: any) => ({
      url: img.url,
      is_primary: img.is_primary ?? false,
      sort_order: img.sort_order ?? 0
    })));
    setCustomImageUrl('');
    
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodBrand) {
      showToast('Product Name and Brand are required.', 'error');
      return;
    }

    try {
      const productId = editingProduct ? editingProduct.id : crypto.randomUUID();
      const sku = editingProduct 
        ? editingProduct.sku 
        : generateSku(prodGender, prodCategory, brands.find(b => b.id === prodBrand)?.name || 'VSF', products.length + 1);

      const branchId = await db.getDefaultBranchId();
      const productPayload: Product = {
        id: productId,
        branch_id: branchId,
        brand_id: prodBrand,
        sku,
        barcode: null,
        name: prodName,
        gender: prodGender,
        category: sanitizeImportCategory(prodCategory),
        material: prodMaterial,
        mrp: prodMrp,
        offer_price: prodOfferPrice,
        description: prodDesc,
        status: prodStatus,
        ai_prompt_version: 'v1',
        ai_confidence_score: 100,
        ai_analysis_details: {
          brandStatus: 'exact',
          modelStatus: 'certain',
          categoryStatus: 'certain',
          materialStatus: 'certain'
        },
        created_at: editingProduct ? editingProduct.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const sizesPayload = Object.entries(prodStock).map(([size, quantity]) => ({
        size_number: parseInt(size),
        stock: quantity
      }));

      const images = prodImages.length > 0
        ? prodImages
        : (editingProduct?.variants?.[0]?.images || [
            { url: '/hero.jpg', is_primary: true, sort_order: 0 }
          ]);

      const variantsPayload = [
        {
          color: prodColor,
          compositeHash: editingProduct?.variants?.[0]?.composite_hash || 'hash-' + prodColor.toLowerCase(),
          images,
          sizes: sizesPayload
        }
      ];

      const featuresList = prodFeatures.split('\n').filter(f => f.trim() !== '');
      const tagsList = prodTags.split(',').map(t => t.trim()).filter(t => t !== '');
      const collectionsList = prodCollections.split(',').map(c => c.trim()).filter(c => c !== '');

      await db.saveProduct(
        productPayload,
        featuresList,
        tagsList,
        collectionsList,
        variantsPayload
      );

      await db.logActivity(
        dbMode === 'supabase' ? 'Admin Live' : 'Demo Admin',
        editingProduct ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
        `Product SKU ${sku} updated.`
      );

      showToast(`Product "${prodName}" saved successfully!`, 'success');
      setIsProductModalOpen(false);
      await refreshAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this footwear product?')) return;
    try {
      await db.deleteProduct(id);
      showToast('Product deleted from catalog.', 'success');
      await refreshAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Leads Status update
  const handleUpdateLeadStatus = async (id: string, newStatus: any) => {
    try {
      await db.updateLeadStatus(id, newStatus);
      showToast('Lead status updated.', 'success');
      await refreshAllData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Inline edits in the Importer Review Table
  const handleInlineChange = (itemId: string, field: string, value: any) => {
    setQueue(prev => prev.map(item => {
      if (item.id === itemId && item.extractedData) {
        return {
          ...item,
          extractedData: {
            ...item.extractedData,
            [field]: value
          }
        };
      }
      return item;
    }));
  };

  // Drawer modal details editor (Description, features, tags)
  const openDetailDrawer = (item: any) => {
    setDrawerItem(item);
    setDrawerDesc(item.extractedData.description);
    setDrawerFeatures(item.extractedData.features.join('\n'));
    setDrawerTags(item.extractedData.tags.join(', '));
    setDrawerCollections(item.extractedData.collections.join(', '));
    setIsDetailDrawerOpen(true);
  };

  const saveDrawerDetails = () => {
    if (!drawerItem) return;
    setQueue(prev => prev.map(item => {
      if (item.id === drawerItem.id && item.extractedData) {
        return {
          ...item,
          extractedData: {
            ...item.extractedData,
            description: drawerDesc,
            features: drawerFeatures.split('\n').filter(f => f.trim() !== ''),
            tags: drawerTags.split(',').map(t => t.trim()).filter(t => t !== ''),
            collections: drawerCollections.split(',').map(c => c.trim()).filter(c => c !== '')
          }
        };
      }
      return item;
    }));
    setIsDetailDrawerOpen(false);
    showToast('AI descriptions and features updated locally. Ready for catalog publishing.', 'success');
  };

  // Batch Publish to DB/Supabase
  const handlePublishAllCompleted = async () => {
    const completedItems = queue.filter(
      item => item.status === 'completed' && item.extractedData && !item.publishedProductId
    );
    if (completedItems.length === 0) {
      const alreadyPublished = queue.filter(item => item.status === 'completed' && item.publishedProductId).length;
      if (alreadyPublished > 0) {
        showToast(`All ${alreadyPublished} item(s) already published during import.`, 'info');
      } else {
        showToast('No processed products ready to publish.', 'warning');
      }
      return;
    }

    try {
      let count = 0;
      for (const item of completedItems) {
        const data = item.extractedData!;

        const resolved = await db.resolveBrandIdForImport(data.brand, data.model, data.name);
        const branchId = await db.getDefaultBranchId();
        assertUuid(resolved.brandId, 'brand_id');
        assertUuid(branchId, 'branch_id');

        const existingId = item.compositeHash
          ? await db.findProductByCompositeHash(item.compositeHash)
          : null;
        const productId = existingId ?? crypto.randomUUID();

        console.log('[Importer] Publishing product...');

        const sku = generateSku(data.gender, data.category, resolved.brand, products.length + count + 1);

        const productPayload: Product = {
          id: productId,
          branch_id: branchId,
          brand_id: resolved.brandId,
          sku,
          barcode: null,
          name: resolved.name,
          gender: data.gender,
          category: sanitizeImportCategory(data.category),
          material: data.material,
          mrp: data.mrp,
          offer_price: data.offer_price,
          description: data.description,
          status: 'published', // Published directly to catalog
          ai_prompt_version: 'v1',
          ai_confidence_score: data.aiConfidence,
          ai_analysis_details: {
            brandStatus: data.aiAnalysisDetails.brandStatus,
            modelStatus: data.aiAnalysisDetails.modelStatus,
            categoryStatus: data.aiAnalysisDetails.categoryStatus,
            materialStatus: data.aiAnalysisDetails.materialStatus
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const sizesPayload = data.sizes.map(sz => ({
          size_number: sz,
          stock: 12 // Default initial stock for imported slippers
        }));

        const imagesPayload = [
          { url: item.processedImageUrl || '', is_primary: true, sort_order: 0 }
        ];

        const variantsPayload = [
          {
            color: data.color || 'Standard',
            compositeHash: item.compositeHash || 'hash-' + (data.color || 'std').toLowerCase(),
            images: imagesPayload,
            sizes: sizesPayload
          }
        ];

        await db.saveProduct(
          productPayload,
          data.features,
          data.tags,
          sanitizeImportCollections(data.collections),
          variantsPayload
        );
        console.log('[Importer] Product published successfully.');
        setQueue(prev => prev.map(qItem =>
          qItem.id === item.id ? { ...qItem, publishedProductId: productId } : qItem
        ));
        count++;
      }

      await db.logActivity(
        dbMode === 'supabase' ? 'Admin Live' : 'Demo Admin',
        'AI_BULK_IMPORT',
        `Bulk imported and published ${count} slippers via AI Vision.`
      );

      showToast(`One-Click Publish Successful! Created ${count} products in the live catalog!`, 'success');
      setQueue([]); // Clear queue
      await refreshAllData();
    } catch (err: any) {
      showToast('Publishing failed: ' + err.message, 'error');
    }
  };

  // Stats Calculations
  const stats = useMemo(() => {
    let totalStock = 0;
    let lowStockCount = 0;
    let publishedCount = 0;
    let draftCount = 0;

    products.forEach(p => {
      if (p.status === 'published') publishedCount++;
      if (p.status === 'draft') draftCount++;

      p.variants?.forEach((v: any) => {
        v.sizes?.forEach((s: any) => {
          totalStock += s.stock;
          if (s.stock > 0 && s.stock <= 3) lowStockCount++;
        });
      });
    });

    const totalViews = dailySummaries.reduce((acc, s) => acc + s.views_count, 0);
    const totalWhatsApp = dailySummaries.reduce((acc, s) => acc + s.whatsapp_clicks_count, 0);
    const totalCalls = dailySummaries.reduce((acc, s) => acc + s.calls_count, 0);

    return {
      totalProducts: products.length,
      publishedCount,
      draftCount,
      totalStock,
      lowStockCount,
      totalViews,
      totalWhatsApp,
      totalCalls,
      totalLeads: leads.length,
      pendingLeads: leads.filter(l => l.status === 'new').length
    };
  }, [products, leads, dailySummaries]);

  // Importer Queue metrics
  const queueStats = useMemo(() => {
    const total = queue.length;
    const completed = queue.filter(x => x.status === 'completed').length;
    const failed = queue.filter(x => x.status === 'failed').length;
    const pending = queue.filter(x => x.status === 'pending' || x.status === 'preprocessing' || x.status === 'analyzing').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, failed, pending, percent };
  }, [queue]);

  const handleNavClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="dark-theme admin-shell">

      {/* Sleek Mobile Top Bar (Visible only on mobile <= 900px) */}
      <div className="admin-mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ backgroundColor: '#FFFFFF', color: '#000000', padding: '0.35rem 0.65rem', borderRadius: '0.4rem', fontWeight: 900, fontSize: '0.8rem' }}>
            PIM
          </div>
          <div>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em', display: 'block', lineHeight: 1.1 }}>VSF STUDIO</span>
            <span style={{ fontSize: '0.6rem', color: '#A1A1AA', letterSpacing: '0.08em', fontWeight: 700 }}>ADMIN PANEL</span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="admin-mobile-menu-btn"
          aria-label="Toggle Mobile Menu"
        >
          {isMobileMenuOpen ? <X size={20} color="#FFFFFF" /> : <Menu size={20} color="#FFFFFF" />}
        </button>
      </div>

      {/* Sidebar Shell Layout (Desktop persistent, Mobile collapsible drawer) */}
      <aside className={`glass admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ backgroundColor: '#FFFFFF', color: '#000000', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontWeight: 900 }}>
              PIM
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#FFFFFF' }}>VSF STUDIO</h1>
              <span style={{ fontSize: '0.65rem', color: '#A1A1AA', letterSpacing: '0.05em' }}>ADMIN PANEL</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'none' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Database & AI Status indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 0.85rem',
            borderRadius: '0.5rem',
            backgroundColor: dbMode === 'supabase' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: dbMode === 'supabase' ? '#34D399' : '#FBBF24',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            {dbMode === 'supabase' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            <span>{dbMode === 'supabase' ? 'LIVE SUPABASE ACTIVE' : 'DEMO MODE (OFFLINE)'}</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 0.85rem',
            borderRadius: '0.5rem',
            backgroundColor: aiLiveConnected ? 'rgba(16, 185, 129, 0.15)' : hasAiApiKey ? 'rgba(197, 168, 128, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            color: aiLiveConnected ? '#34D399' : hasAiApiKey ? '#F3F4F6' : '#9CA3AF',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            {aiConnectionStatus === 'testing' ? <RefreshCw size={14} /> : aiLiveConnected ? <CheckCircle size={14} /> : <Sparkles size={14} />}
            <span>
              {aiConnectionStatus === 'testing'
                ? `TESTING ${aiProviderName.toUpperCase()}...`
                : aiLiveConnected
                  ? `LIVE ${aiProviderName.toUpperCase()} ACTIVE`
                  : hasAiApiKey
                    ? 'AI KEY SAVED — TEST IN SETTINGS'
                    : `${aiProviderName.toUpperCase()} OFFLINE`}
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
          <button onClick={() => handleNavClick('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <LayoutDashboard size={18} /> Dashboard
          </button>

          <button onClick={() => handleNavClick('importer')} className={`btn ${activeTab === 'importer' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <FolderInput size={18} /> Bulk Importer {queueStats.pending > 0 && <span style={{ backgroundColor: '#FFFFFF', color: '#000000', padding: '0.1rem 0.4rem', borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800 }}>{queueStats.pending}</span>}
          </button>

          <button onClick={() => handleNavClick('studio')} className={`btn ${activeTab === 'studio' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <Sparkles size={18} /> AI Catalog Studio
          </button>

          <button onClick={() => handleNavClick('products')} className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <Database size={18} /> Catalog CRUD
          </button>

          <button onClick={() => handleNavClick('brands')} className={`btn ${activeTab === 'brands' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <Tag size={18} /> Brand Registry
          </button>

          <button onClick={() => handleNavClick('leads')} className={`btn ${activeTab === 'leads' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <PhoneCall size={18} /> Leads CRM {stats.pendingLeads > 0 && <span style={{ backgroundColor: '#EF4444', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800 }}>{stats.pendingLeads}</span>}
          </button>

          <button onClick={() => handleNavClick('logs')} className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <History size={18} /> Activity Logs
          </button>
        </nav>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)', margin: '1rem 0 0.5rem 0', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <button onClick={() => handleNavClick('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <Settings size={18} /> Settings
          </button>
          <button onClick={() => handleNavClick('profile')} className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start' }}>
            <User size={18} /> Profile
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <div className="admin-main-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Header */}
        <header className="admin-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#FFFFFF' }}>
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'importer' && 'Bulk Product Importer'}
            {activeTab === 'products' && 'Product catalog Management'}
            {activeTab === 'brands' && 'Brand Directory'}
            {activeTab === 'leads' && 'WhatsApp Enquiry Leads (CRM)'}
            {activeTab === 'logs' && 'Administrative Audit Trails'}
            {activeTab === 'settings' && 'System Configuration & Settings'}
            {activeTab === 'studio' && 'AI Catalog Studio & Banners'}
            {activeTab === 'profile' && 'Admin Account Profile'}
          </h2>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={refreshAllData} className="btn btn-secondary" style={{ padding: '0.5rem 0.85rem', fontSize: '0.75rem', backgroundColor: '#FFFFFF', color: '#000000', fontWeight: 800, border: 'none' }}>
              <RefreshCw size={14} /> Sync Catalog
            </button>
          </div>
        </header>

        {/* Tab Content Renderer */}
        <div className="admin-content" style={{ overflowY: 'auto', flex: 1 }}>
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Stat Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                
                <div className="glass" style={{ padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase' }}>Total Products</span>
                  <p style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem' }}>{stats.totalProducts}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                    <span style={{ color: 'rgb(16, 185, 129)' }}>{stats.publishedCount} Active</span>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>|</span>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{stats.draftCount} Drafts</span>
                  </div>
                </div>

                <div className="glass" style={{ padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase' }}>Slipper Inventory</span>
                  <p style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem' }}>{stats.totalStock} Pairs</p>
                  {stats.lowStockCount > 0 ? (
                    <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                      <AlertTriangle size={12} />
                      <span>{stats.lowStockCount} sizes are running low</span>
                    </div>
                  ) : (
                    <span style={{ color: 'rgb(16, 185, 129)', fontSize: '0.7rem', display: 'block', marginTop: '0.5rem' }}>✔ Stock levels normal</span>
                  )}
                </div>

                <div className="glass" style={{ padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase' }}>WhatsApp Clicks</span>
                  <p style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem' }}>{stats.totalWhatsApp}</p>
                  <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', display: 'block', marginTop: '0.5rem' }}>Total direct buying intents</span>
                </div>

                <div className="glass" style={{ padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase' }}>CRM Leads</span>
                  <p style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem' }}>{stats.totalLeads}</p>
                  {stats.pendingLeads > 0 ? (
                    <span style={{ color: 'hsl(var(--destructive))', fontSize: '0.7rem', fontWeight: 700, display: 'block', marginTop: '0.5rem' }}>
                      ⚠ {stats.pendingLeads} new WhatsApp leads require reply
                    </span>
                  ) : (
                    <span style={{ color: 'rgb(16, 185, 129)', fontSize: '0.7rem', display: 'block', marginTop: '0.5rem' }}>✔ All inquiries answered</span>
                  )}
                </div>
              </div>

              {/* Analytical SVG Graph */}
              <div className="glass" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Catalog Views & Clicks Trend</h3>
                {dailySummaries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                    No analytics logged yet.
                  </div>
                ) : (
                  <div>
                    <svg viewBox="0 0 500 150" style={{ width: '100%', height: '200px' }}>
                      <line x1="0" y1="20" x2="500" y2="20" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" />
                      <line x1="0" y1="70" x2="500" y2="70" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" />
                      
                      <path
                        d={dailySummaries.reduce((path, s, i) => {
                          const x = (i / (dailySummaries.length - 1)) * 500;
                          const y = 140 - (s.views_count / 100) * 120;
                          return `${path} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }, '')}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                      />

                      <path
                        d={dailySummaries.reduce((path, s, i) => {
                          const x = (i / (dailySummaries.length - 1)) * 500;
                          const y = 140 - (s.whatsapp_clicks_count / 30) * 120;
                          return `${path} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }, '')}
                        fill="none"
                        stroke="#25D366"
                        strokeWidth="2"
                      />

                      {dailySummaries.map((s, i) => {
                        const x = (i / (dailySummaries.length - 1)) * 500;
                        return (
                          <g key={s.id}>
                            <circle cx={x} cy={140 - (s.views_count / 100) * 120} r="4" fill="hsl(var(--primary))" />
                            <text x={x} y="148" fill="hsl(var(--muted-foreground))" fontSize="8" textAnchor="middle">
                              {s.summary_date.slice(5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    
                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.8rem', marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: '12px', height: '12px', backgroundColor: 'hsl(var(--primary))', display: 'inline-block', borderRadius: '2px' }} />
                        <span>Product Page Views</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: '12px', height: '12px', backgroundColor: '#25D366', display: 'inline-block', borderRadius: '2px' }} />
                        <span>WhatsApp Actions</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Restock Alerts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} /> Restock Warnings (Low Sizes)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {products.flatMap(p => 
                      p.variants?.flatMap((v: any) => 
                        v.sizes?.filter((s: any) => s.stock > 0 && s.stock <= 3).map((s: any) => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', paddingBottom: '0.35rem' }}>
                            <span>{p.name} ({v.color} - Size {s.size_number})</span>
                            <Badge variant="warning">{s.stock} left</Badge>
                          </div>
                        ))
                      )
                    ).filter(Boolean)}
                  </div>
                </div>

                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#C5A880', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={16} /> Latest Leads Inquiries
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {leads.slice(0, 4).map(l => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', paddingBottom: '0.35rem' }}>
                        <div>
                          <p style={{ fontWeight: 700 }}>{l.phone}</p>
                          <span style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>Source: {l.source}</span>
                        </div>
                        <Badge variant={l.status === 'new' ? 'destructive' : 'secondary'}>{l.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Insights & Reports Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                
                {/* AI Customer Insights */}
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'hsl(var(--accent))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} /> AI Customer Insights
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>Top Category searched:</span>
                      <span style={{ fontWeight: 700 }}>Men's Sports Shoes</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>Popular color:</span>
                      <span style={{ fontWeight: 700 }}>Midnight Black</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>Average Size:</span>
                      <span style={{ fontWeight: 700 }}>UK 8 & 9</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>Ignored variants:</span>
                      <span style={{ fontWeight: 700 }}>2 (Women's Pink Sandals)</span>
                    </div>
                  </div>
                </div>

                {/* AI Sales Insights */}
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'hsl(var(--accent))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} /> AI Sales Insights
                  </h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', paddingLeft: '1rem', color: 'hsl(var(--foreground))', lineHeight: 1.4 }}>
                    <li>"This week's most popular category is Men's Sports Shoes."</li>
                    <li>"Black EVA Slides views increased by 37%."</li>
                    <li>"Women's Sandals have low engagement."</li>
                    <li>"Crocs Collection has the highest click-through rate."</li>
                  </ul>
                </div>

                {/* Operations Reports Export */}
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'hsl(var(--accent))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={16} /> Reports & Auditing
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <button onClick={() => handleExportCSV('products')} className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'flex-start' }}>
                      📥 Export Products Catalogue CSV
                    </button>
                    <button onClick={() => handleExportCSV('inventory')} className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'flex-start' }}>
                      📥 Export Slipper Inventory CSV
                    </button>
                    <button onClick={() => handleExportCSV('leads')} className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'flex-start' }}>
                      📥 Export WhatsApp Leads CSV
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: AI BULK IMPORTER & PIM REVIEW TABLE */}
          {activeTab === 'importer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* Live connection status */}
              <div style={{
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                border: `1px solid ${aiLiveConnected ? 'rgba(16, 185, 129, 0.35)' : hasAiApiKey ? 'rgba(197, 168, 128, 0.35)' : 'hsl(var(--border))'}`,
                backgroundColor: aiLiveConnected ? 'rgba(16, 185, 129, 0.08)' : hasAiApiKey ? 'rgba(197, 168, 128, 0.08)' : 'hsl(var(--muted) / 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {aiLiveConnected ? <CheckCircle size={20} style={{ color: 'rgb(16, 185, 129)' }} /> : <AlertTriangle size={20} style={{ color: hasAiApiKey ? 'hsl(var(--accent))' : 'rgb(245, 158, 11)' }} />}
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                      {aiLiveConnected
                        ? `Live ${aiProviderName} Connected`
                        : hasAiApiKey
                          ? `${aiProviderName} Key Saved — Enable Live Mode`
                          : `${aiProviderName} Not Connected`}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {aiLiveConnected
                        ? 'AI Vision Import and Fix Filenames are ready. Select your sleppers folder below.'
                        : hasAiApiKey
                          ? 'Go to Settings → choose Live OCR Mode → click Test OCR Connection.'
                          : `Go to Settings → paste ${aiProviderName} key → Save and Encrypt Vault → Test OCR Connection.`}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!aiLiveConnected && (
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setActiveTab('settings')}>
                      <Settings size={14} /> Open Settings
                    </button>
                  )}
                  {hasAiApiKey && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem' }}
                      disabled={isTestingAi}
                      onClick={() => testAiConnection()}
                    >
                      <RefreshCw size={14} /> {isTestingAi ? 'Testing...' : 'Test OCR Connection'}
                    </button>
                  )}
                </div>
              </div>

              {/* Import mode selector */}
              <div className="glass" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Import Mode</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '12px', border: importMode === 'catalog' ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))', flex: '1 1 260px' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'catalog'}
                      onChange={() => handleImportModeChange('catalog')}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>Catalog Bulk Import (No API Key)</strong>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        Best for 300+ manufacturer photos. Uses filename + folder names. Original catalog image kept as-is.
                      </span>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '12px', border: importMode === 'ai' ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))', flex: '1 1 260px', opacity: aiLiveConnected ? 1 : 0.55 }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'ai'}
                      disabled={!aiLiveConnected}
                      onChange={() => aiLiveConnected && handleImportModeChange('ai')}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>AI Vision Import ({aiProviderName})</strong>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {aiLiveConnected ? 'OCR + brand, gender, category, price from catalog image.' : `Save ${aiProviderName} key in Settings and test connection to enable.`}
                      </span>
                    </div>
                  </label>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                  Filename tips: <code>Walkaroo_Women_Sandals_W187_Blue_189.jpg</code> or folder <code>Walkaroo/W187.jpg</code>.
                  Gender (Men/Women/Unisex) and category (Sandals, Flip-Flops) are read from filename or inferred from art number.
                  Edit anytime in the <strong>Products</strong> tab after import.
                </p>
              </div>

              {/* Fix misnamed photos with OCR.space */}
              <div className="glass" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FolderSync size={18} style={{ color: 'hsl(var(--primary))' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Fix Wrong Filenames ({aiProviderName} OCR)</h4>
                  </div>
                  <Badge style={{
                    backgroundColor: aiLiveConnected ? 'rgb(16, 185, 129)' : '#6b7280',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                  }}>
                    {aiLiveConnected ? `LIVE ${aiProviderName.toUpperCase()} READY` : `CONNECT ${aiProviderName.toUpperCase()} FIRST`}
                  </Badge>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                  Re-read catalog text from images using {aiProviderName} vision — much more accurate than local Tesseract OCR.
                  Use this if renamed files in your <code>sleppers</code> folder have wrong art numbers, colors, or prices.
                </p>
                {!aiLiveConnected ? (
                  <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', backgroundColor: 'hsl(var(--muted) / 0.35)', fontSize: '0.8rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Setup once in Settings:</strong>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
                      <li>Go to <button type="button" className="btn btn-ghost" style={{ padding: 0, fontSize: 'inherit', textDecoration: 'underline' }} onClick={() => setActiveTab('settings')}>Settings</button></li>
                      <li>Paste your {aiProviderName} API key</li>
                      <li>Click <strong>Save and Encrypt Vault</strong></li>
                      <li>Select <strong>Live OCR Mode (OCR.space)</strong></li>
                      <li>Click <strong>Test OCR Connection</strong> — sidebar will show <strong>LIVE {aiProviderName.toUpperCase()} ACTIVE</strong></li>
                    </ol>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'rgb(16, 185, 129)', margin: 0, fontWeight: 600 }}>
                    ✔ {aiProviderName} connected. Follow: Select Folder → Analyze → Apply Renames
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!photoRenamer.hasFolderSupport || !aiLiveConnected}
                    onClick={async () => {
                      try {
                        const count = await photoRenamer.pickFolder();
                        showToast(`Selected folder with ${count} images. Click Analyze to read catalog text.`, 'info');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : String(err), 'error');
                      }
                    }}
                  >
                    <FolderInput size={14} /> 1. Select Folder
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!aiLiveConnected || photoRenamer.isAnalyzing || photoRenamer.entries.length === 0}
                    onClick={async () => {
                      try {
                        showToast(`Analyzing images with ${aiProviderName} vision...`, 'info');
                        await photoRenamer.analyzeWithAi(
                          'ocrspace',
                          activeAiApiKey.trim(),
                          undefined,
                          (done, total) => {
                            if (done % 10 === 0 || done === total) {
                              showToast(`OCR progress: ${done}/${total}`, 'info');
                            }
                          }
                        );
                        showToast('Analysis complete. Review names below, then Apply Renames.', 'success');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : String(err), 'error');
                      }
                    }}
                  >
                    <Sparkles size={14} /> {photoRenamer.isAnalyzing ? 'Analyzing...' : `2. Analyze with ${aiProviderName}`}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={photoRenamer.isApplying || !photoRenamer.entries.some(e => e.status === 'ok' && e.oldName !== e.newName)}
                    onClick={async () => {
                      try {
                        const count = await photoRenamer.applyRenames();
                        showToast(`Renamed ${count} files on disk.`, 'success');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : String(err), 'error');
                      }
                    }}
                  >
                    <FileText size={14} /> 3. Apply Renames
                  </button>
                  {photoRenamer.entries.length > 0 && (
                    <button type="button" className="btn btn-ghost" onClick={photoRenamer.downloadManifest}>
                      <Download size={14} /> Download Manifest
                    </button>
                  )}
                </div>
                {!photoRenamer.hasFolderSupport && (
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--destructive))', margin: 0 }}>
                    Folder rename requires Chrome/Edge. Or run in terminal:{' '}
                    <code>npm run rename-slippers:ai -- --ocr-key YOUR_KEY</code>
                  </p>
                )}
                {photoRenamer.folderName && (
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                    Folder: <strong>{photoRenamer.folderName}</strong> — {photoRenamer.entries.length} images
                    {photoRenamer.entries.filter(e => e.status === 'ok' && e.oldName !== e.newName).length > 0 &&
                      ` • ${photoRenamer.entries.filter(e => e.status === 'ok' && e.oldName !== e.newName).length} will be renamed`}
                  </p>
                )}
                {photoRenamer.entries.length > 0 && (
                  <div style={{ maxHeight: '240px', overflow: 'auto', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}>
                    <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'hsl(var(--muted))', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '0.4rem', textAlign: 'left' }}>Old name</th>
                          <th style={{ padding: '0.4rem', textAlign: 'left' }}>New name</th>
                          <th style={{ padding: '0.4rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {photoRenamer.entries.slice(0, 50).map((e, i) => (
                          <tr key={i} style={{ borderTop: '1px solid hsl(var(--border))' }}>
                            <td style={{ padding: '0.35rem', wordBreak: 'break-all' }}>{e.oldName}</td>
                            <td style={{ padding: '0.35rem', wordBreak: 'break-all', color: e.oldName !== e.newName ? 'hsl(var(--primary))' : undefined }}>{e.newName}</td>
                            <td style={{ padding: '0.35rem', textAlign: 'center' }}>{e.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {photoRenamer.entries.length > 50 && (
                      <p style={{ padding: '0.5rem', fontSize: '0.7rem', margin: 0, color: 'hsl(var(--muted-foreground))' }}>
                        Showing first 50 of {photoRenamer.entries.length}. Download manifest for full list.
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Folder Upload Selector */}
              <div className="glass" style={{ padding: '2rem', textAlign: 'center', border: '2px dashed hsl(var(--border))' }}>
                <FolderInput size={48} style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Select Footwear Images Folder</h3>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', maxWidth: '560px', margin: '0 auto 1.5rem auto' }}>
                  {importMode === 'catalog'
                    ? 'Choose a folder with your slipper catalog photos (e.g. import-photos/ or any folder with 300 images). Images are compressed and published — no AI key required.'
                    : `Choose a directory containing footwear slippers. Images are validated, hashed, and parsed through ${aiProviderName} AI vision in parallel.`}
                </p>
                <input
                  type="file"
                  id="folder-upload"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  {...({ webkitdirectory: "", directory: "" })}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addFiles(e.target.files);
                      showToast(`Added ${e.target.files.length} images from folder to import queue.`, 'info');
                    }
                  }}
                />
                <input
                  type="file"
                  id="files-upload"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addFiles(e.target.files);
                      showToast(`Added ${e.target.files.length} individual images to import queue.`, 'info');
                    }
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="folder-upload" className="btn btn-primary" style={{ padding: '0.8rem 1.6rem', cursor: 'pointer' }}>
                    📁 Select Folder
                  </label>
                  <label htmlFor="files-upload" className="btn btn-secondary" style={{ padding: '0.8rem 1.6rem', cursor: 'pointer' }}>
                    📄 Select Images (Single/Multiple)
                  </label>
                </div>
              </div>

              {/* Import Queue HUD Controls */}
              {queue.length > 0 && (
                <div className="glass animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    
                    {/* Progress details */}
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Import Progress Queue</h4>
                      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.15rem' }}>
                        Processed: {queueStats.completed} / {queueStats.total} • 
                        Remaining: {queueStats.pending} • 
                        Est. Time: {remainingTime > 0 ? `${Math.floor(remainingTime / 60)}m ${remainingTime % 60}s` : 'Done'} • 
                        Elapsed: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
                      </p>
                    </div>

                    {/* HUD Control buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!isProcessing ? (
                        <button onClick={start} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                          <Play size={14} /> Start Import
                        </button>
                      ) : (
                        <button onClick={pause} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                          <Pause size={14} /> Pause
                        </button>
                      )}
                      
                      <button onClick={cancel} className="btn btn-ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'hsl(var(--destructive))' }}>
                        <XCircle size={14} /> Cancel
                      </button>

                      {queueStats.failed > 0 && (
                        <button onClick={retryFailed} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                          <RefreshCw size={14} /> Retry Failed ({queueStats.failed})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'hsl(var(--border))', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${queueStats.percent}%`, height: '100%', backgroundColor: 'hsl(var(--primary))', transition: 'width 0.3s ease-in-out' }} />
                  </div>
                </div>
              )}

              {/* Active Processing Files Monitor */}
              {queue.some(x => x.status === 'preprocessing' || x.status === 'analyzing' || x.status === 'failed') && (
                <div className="glass" style={{ padding: '1.25rem', maxHeight: '180px', overflowY: 'auto' }}>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', marginBottom: '0.65rem' }}>Active Tasks Monitor</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {queue.filter(x => x.status === 'preprocessing' || x.status === 'analyzing' || x.status === 'failed').map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingBottom: '0.35rem', borderBottom: '1px solid hsl(var(--border) / 0.2)' }}>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>{item.file.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {item.status === 'failed' ? (
                            <span style={{ color: 'hsl(var(--destructive))', fontWeight: 700 }}>⚠ Failed: {item.error}</span>
                          ) : (
                            <span style={{ color: 'hsl(var(--primary))' }}>{item.status.toUpperCase()}{item.stage ? ` [${item.stage}]` : ''} ({item.progress}%)</span>
                          )}
                          {item.status === 'failed' && (
                            <button onClick={() => retryItem(item.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable review grid (The core PIM table) */}
              {queue.some(x => x.status === 'completed' && x.extractedData) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={18} /> Import Review — verify gender, category &amp; color
                    </h3>
                    
                    <button onClick={handlePublishAllCompleted} className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
                      <ShoppingBag size={16} /> One-Click Publish ({queue.filter(x => x.status === 'completed').length} items)
                    </button>
                  </div>

                  {/* Review Table */}
                  <div className="glass" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card) / 0.8)' }}>
                          <th style={{ padding: '0.75rem 1rem', width: '70px' }}>Image</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Slipper Name</th>
                          <th style={{ padding: '0.75rem 1rem', width: '120px' }}>Brand</th>
                          <th style={{ padding: '0.75rem 1rem', width: '100px' }}>Model</th>
                          <th style={{ padding: '0.75rem 1rem', width: '90px' }}>Gender</th>
                          <th style={{ padding: '0.75rem 1rem', width: '120px' }}>Category</th>
                          <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Material</th>
                          <th style={{ padding: '0.75rem 1rem', width: '100px' }}>Color</th>
                          <th style={{ padding: '0.75rem 1rem', width: '75px' }}>MRP (₹)</th>
                          <th style={{ padding: '0.75rem 1rem', width: '75px' }}>Offer (₹)</th>
                          <th style={{ padding: '0.75rem 1rem', width: '80px' }}>Confidence</th>
                          <th style={{ padding: '0.75rem 1rem', width: '110px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.filter(item => item.status === 'completed' && item.extractedData).map(item => {
                          const data = item.extractedData!;
                          const isLowConfidence = data.aiConfidence < 70;

                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: '1px solid hsl(var(--border) / 0.3)',
                                borderLeft: isLowConfidence ? '3px solid hsl(var(--destructive))' : 'none'
                              }}
                            >
                              {/* Thumbnail preview */}
                              <td style={{ padding: '0.5rem 1rem' }}>
                                <img
                                  src={item.processedImageUrl}
                                  alt=""
                                  style={{ width: '45px', height: '45px', objectFit: 'contain', background: '#ffffff', borderRadius: '0.25rem', border: '1px solid hsl(var(--border))' }}
                                />
                              </td>
                              
                              {/* Name Input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.name}
                                  onChange={(e) => handleInlineChange(item.id, 'name', e.target.value)}
                                />
                              </td>

                              {/* Brand Input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.brand}
                                  onChange={(e) => handleInlineChange(item.id, 'brand', e.target.value)}
                                />
                              </td>

                              {/* Model Input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.model ?? ''}
                                  onChange={(e) => handleInlineChange(item.id, 'model', e.target.value)}
                                />
                              </td>

                              {/* Gender select */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <select
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.gender}
                                  onChange={(e) => handleInlineChange(item.id, 'gender', e.target.value)}
                                >
                                  <option value="Men">Men</option>
                                  <option value="Women">Women</option>
                                  <option value="Kids">Kids</option>
                                  <option value="Unisex">Unisex</option>
                                </select>
                              </td>

                              {/* Category select */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <select
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.category}
                                  onChange={(e) => handleInlineChange(item.id, 'category', e.target.value)}
                                >
                                  {ADMIN_FOOTWEAR_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Material input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.material}
                                  onChange={(e) => handleInlineChange(item.id, 'material', e.target.value)}
                                />
                              </td>

                              {/* Color input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.color}
                                  onChange={(e) => handleInlineChange(item.id, 'color', e.target.value)}
                                />
                              </td>

                              {/* MRP Input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="number"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.mrp}
                                  onChange={(e) => handleInlineChange(item.id, 'mrp', parseInt(e.target.value) || 0)}
                                />
                              </td>

                              {/* Offer Price Input */}
                              <td style={{ padding: '0.5rem 0.5rem' }}>
                                <input
                                  type="number"
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                  value={data.offer_price}
                                  onChange={(e) => handleInlineChange(item.id, 'offer_price', parseInt(e.target.value) || 0)}
                                />
                              </td>

                              {/* Confidence score */}
                              <td style={{ padding: '0.5rem 1rem' }}>
                                <Badge variant={isLowConfidence ? 'destructive' : 'success'}>
                                  {data.aiConfidence}%
                                </Badge>
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                  <button onClick={() => openDetailDrawer(item)} className="btn btn-secondary" style={{ padding: '0.3rem 0.45rem' }}>
                                    <Eye size={12} />
                                  </button>
                                  <button onClick={() => removeItem(item.id)} className="btn btn-ghost" style={{ padding: '0.3rem 0.45rem', color: 'hsl(var(--destructive))' }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRODUCT CATALOG TABLE */}
          {activeTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={openAddProductModal} className="btn btn-primary">
                    <Plus size={16} /> Add Product
                  </button>
                  <input
                    type="search"
                    className="input-field"
                    placeholder="Search name, SKU, brand, category..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{ minWidth: '240px', maxWidth: '320px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                    {catalogProducts.length} of {products.length} products
                  </span>
                </div>
                
                {selectedProductIds.length > 0 && (
                  <div className="glass animate-fade-in" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      Selected {selectedProductIds.length} items
                    </span>
                    <input
                      type="number"
                      placeholder="Bulk MRP"
                      value={bulkPriceChange}
                      onChange={(e) => setBulkPriceChange(e.target.value)}
                      className="input-field"
                      style={{ width: '100px', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    />
                    <input
                      type="number"
                      placeholder="Bulk Offer"
                      value={bulkOfferPriceChange}
                      onChange={(e) => setBulkOfferPriceChange(e.target.value)}
                      className="input-field"
                      style={{ width: '100px', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    />
                    <button onClick={handleApplyBulkPricing} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                      Apply Prices
                    </button>
                  </div>
                )}
              </div>

              <div className="glass" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card) / 0.8)' }}>
                      <th style={{ padding: '0.9rem 1.25rem', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.length === products.length && products.length > 0}
                          onChange={handleSelectAllProducts}
                        />
                      </th>
                      <th style={{ padding: '0.9rem 1.25rem', width: '56px' }}></th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>SKU</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Product</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Gender</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Category</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Price</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Confidence</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Status</th>
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogProducts.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--muted-foreground))' }}>
                          {products.length === 0
                            ? 'No products yet. Import catalog photos from Bulk Importer.'
                            : 'No products match your search.'}
                        </td>
                      </tr>
                    ) : (
                      catalogProducts.map((product) => {
                        const isSelected = selectedProductIds.includes(product.id);
                        const isLowConfidence = product.ai_confidence_score < 70;
                        const colorsCount = product.variants?.length || 1;
                        const thumbUrl =
                          product.variants?.[0]?.images?.find((img: { is_primary?: boolean }) => img.is_primary)?.url
                          ?? product.variants?.[0]?.images?.[0]?.url
                          ?? null;

                        return (
                          <tr
                            key={product.id}
                            style={{
                              borderBottom: '1px solid hsl(var(--border) / 0.3)',
                              backgroundColor: isSelected ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                              transition: 'background-color 0.15s'
                            }}
                          >
                            <td style={{ padding: '0.9rem 1.25rem' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectProduct(product.id)}
                              />
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '0.35rem',
                                overflow: 'hidden',
                                background: 'hsl(var(--muted))',
                                border: '1px solid hsl(var(--border))'
                              }}>
                                {thumbUrl ? (
                                  <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: '0.55rem', color: 'hsl(var(--muted-foreground))' }}>—</div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '0.9rem 1.25rem', fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>
                              {product.sku}
                            </td>
                            <td style={{ padding: '0.9rem 1.25rem' }}>
                              <div>
                                <span style={{ fontWeight: 700, display: 'block' }}>{product.name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                                  Brand: {product.brandName} • {colorsCount} colors
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.9rem 1.25rem' }}>{product.gender}</td>
                            <td style={{ padding: '0.9rem 1.25rem' }}>{product.category}</td>
                            <td style={{ padding: '0.9rem 1.25rem' }}>
                              <div>
                                <span style={{ fontWeight: 700 }}>{formatCurrency(product.offer_price)}</span>
                                <span style={{ textDecoration: 'line-through', fontSize: '0.7rem', opacity: 0.5, marginLeft: '0.35rem' }}>
                                  {formatCurrency(product.mrp)}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.9rem 1.25rem' }}>
                              <Badge variant={isLowConfidence ? 'destructive' : 'success'}>
                                {product.ai_confidence_score}%
                              </Badge>
                            </td>
                            <td style={{ padding: '0.9rem 1.25rem' }}>
                              <Badge variant={product.status === 'published' ? 'success' : 'outline'}>
                                {product.status.toUpperCase()}
                              </Badge>
                            </td>
                            <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => openEditProductModal(product)} className="btn btn-secondary" style={{ padding: '0.35rem 0.5rem' }}>
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeleteProduct(product.id)} className="btn btn-destructive" style={{ padding: '0.35rem 0.5rem' }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BRANDS */}
          {activeTab === 'brands' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
              <div className="glass" style={{ padding: '1.5rem', height: 'fit-content' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '1.2rem' }}>Add Slipper Brand</h4>
                <form onSubmit={handleAddBrand} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>BRAND NAME</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      placeholder='E.g. Puma, Paragon...'
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <Save size={16} /> Save Brand
                  </button>
                </form>
              </div>

              <div className="glass" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '1.2rem' }}>Registered Brands Directory</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {brands.map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', border: '1px solid hsl(var(--border) / 0.3)', borderRadius: '0.4rem' }}>
                      <span style={{ fontWeight: 700 }}>{b.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>slug: {b.slug}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LEADS CRM */}
          {activeTab === 'leads' && (
            <div className="glass" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card) / 0.8)' }}>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Lead Date</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Source</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Phone / Identifier</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Details</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>CRM Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--muted-foreground))' }}>
                        No WhatsApp or phone click leads captured yet.
                      </td>
                    </tr>
                  ) : (
                    leads.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <Badge variant="outline">{l.source}</Badge>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: 700 }}>
                          {l.phone}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {l.notes}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <Badge variant={l.status === 'new' ? 'destructive' : l.status === 'sold' ? 'success' : 'secondary'}>
                            {l.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                          <select
                            className="input-field"
                            style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            value={l.status}
                            onChange={(e) => handleUpdateLeadStatus(l.id, e.target.value)}
                          >
                            <option value="new">New Inquire</option>
                            <option value="contacted">Contacted</option>
                            <option value="reserved">Reserved</option>
                            <option value="sold">Sold</option>
                            <option value="closed">Closed / Dead</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: LOGS */}
          {activeTab === 'logs' && (
            <div className="glass" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto' }}>
                {logs.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: '2rem' }}>No activity logged yet.</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', paddingBottom: '0.65rem', fontSize: '0.8rem' }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      <strong style={{ color: 'hsl(var(--primary))', flexShrink: 0 }}>
                        [{log.action}]
                      </strong>
                      <span style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                        by {log.admin_name}
                      </span>
                      <span style={{ flex: 1 }}>
                        {log.details}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '650px' }}>
              <div className="glass" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={16} /> Secure API Key Vault (Encrypted IndexedDB)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {!vaultExists ? (
                    /* FIRST TIME SETUP FLOW */
                    <>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                        No secure credentials vault detected. Set a master passcode to create an encrypted IndexedDB vault for your database configuration and OCR API key.
                      </p>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>CREATE MASTER PASSCODE</label>
                        <input
                          type="password"
                          className="input-field"
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value)}
                          placeholder="Enter a secure passcode..."
                        />
                      </div>
                      <div>
                        <button onClick={handleCreateVault} className="btn btn-primary" style={{ width: '100%' }}>
                          <Lock size={16} /> Create Secure Vault
                        </button>
                      </div>
                    </>
                  ) : !isUnlocked ? (
                    /* UNLOCK FLOW */
                    <>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                        Secure credentials vault detected. Enter your master passcode to unlock live mode and edit configuration.
                      </p>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>MASTER PASSCODE</label>
                        <input
                          type="password"
                          className="input-field"
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value)}
                          placeholder="Enter passcode..."
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={handleUnlockAndConnect} className="btn btn-primary" style={{ flex: 1 }}>
                          <Unlock size={16} /> Unlock Vault
                        </button>
                        <button onClick={handleClearCredentials} className="btn btn-destructive">
                          Reset Vault
                        </button>
                      </div>
                    </>
                  ) : (
                    /* UNLOCKED VAULT & CONFIGURATION EDIT FLOW */
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(197, 168, 128, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(197, 168, 128, 0.2)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--accent))', fontWeight: 700 }}>✔ Secure Vault Unlocked</span>
                        <button 
                          onClick={() => {
                            setIsUnlocked(false);
                            setPasscode('');
                            setSupabaseUrl('');
                            setSupabaseAnonKey('');
                            setOcrApiKey('');
                            showToast('Vault locked.', 'info');
                          }} 
                          className="btn btn-ghost" 
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                        >
                          Lock Vault
                        </button>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>SUPABASE DATABASE URL</label>
                        <input
                          type="text"
                          className="input-field"
                          value={supabaseUrl}
                          onChange={(e) => setSupabaseUrl(e.target.value)}
                          placeholder="https://xxxx.supabase.co"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>SUPABASE ANON PUBLIC KEY</label>
                        <textarea
                          className="input-field"
                          value={supabaseAnonKey}
                          onChange={(e) => setSupabaseAnonKey(e.target.value)}
                          placeholder="eyJhbGciOi..."
                          rows={3}
                          style={{ resize: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>OCR API KEY (OCR.space)</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            className="input-field"
                            value={ocrApiKey}
                            onChange={(e) => setOcrApiKey(e.target.value)}
                            placeholder="K8… (15 chars from ocr.space email)"
                            style={{ paddingRight: '2.5rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            style={{
                              position: 'absolute',
                              right: '0.75rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {showApiKey ? <Eye size={16} /> : <Eye size={16} style={{ opacity: 0.4 }} />}
                          </button>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.35rem' }}>
                          Your OCR.space key is usually ~15 characters and starts with <strong>K</strong> (from the signup email at{' '}
                          <a href="https://ocr.space/OCRAPI" target="_blank" rel="noopener noreferrer">ocr.space/OCRAPI</a>).
                          Paste it here, click <strong>Save and Encrypt Vault</strong>, then <strong>Test OCR Connection</strong>.
                          After saving, select <strong>Live OCR Mode</strong>, then click <strong>Test OCR Connection</strong>.
                          E550 = bad/inactive key. E505 was a test-image bug (now fixed) — retry the test after refresh.
                        </p>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>OCR ENGINE OPERATION MODE</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="radio"
                              name="aiMode"
                              checked={!liveAiMode}
                              onChange={() => {
                                setLiveAiMode(false);
                                setAiConnectionStatus('idle');
                                ai.init(undefined);
                                showToast('Switched to Demo Mode (Mock AI).', 'info');
                              }}
                            />
                            <span>Demo Mode (Mock AI)</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="radio"
                              name="aiMode"
                              checked={liveAiMode}
                              disabled={!hasAiApiKey}
                              onChange={() => {
                                if (hasAiApiKey) {
                                  setLiveAiMode(true);
                                  initLiveAi();
                                  setAiConnectionStatus('connected');
                                  showToast('Switched to Live OCR Mode (OCR.space).', 'info');
                                }
                              }}
                            />
                            <span style={{ opacity: hasAiApiKey ? 1 : 0.5 }}>Live OCR Mode (OCR.space)</span>
                          </label>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>OCR Status:</span>
                          <Badge style={{ backgroundColor: aiLiveConnected ? '#10b981' : liveAiMode ? '#C5A880' : '#6b7280', color: '#ffffff', fontWeight: 800, fontSize: '0.65rem' }}>
                            {aiConnectionStatus === 'testing'
                              ? 'Testing OCR connection...'
                              : aiLiveConnected
                                ? 'Live OCR Connected (OCR.space)'
                                : liveAiMode
                                  ? 'Live Mode (Not Verified)'
                                  : 'Offline Demo Mode (Mock AI)'}
                          </Badge>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={handleSaveCredentials} className="btn btn-primary">
                          <Save size={16} /> Save and Encrypt Vault
                        </button>
                        <button 
                          type="button"
                          onClick={handleClearCredentials}
                          className="btn btn-destructive"
                        >
                          Clear Vault
                        </button>
                        {hasAiApiKey && (
                          <button 
                            type="button"
                            disabled={isTestingAi}
                            onClick={() => testAiConnection()}
                            className="btn btn-secondary"
                          >
                            <RefreshCw size={16} /> {isTestingAi ? 'Testing...' : 'Test OCR Connection'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Presentation & Catalog Settings */}
              <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 800 }}>Product Presentation Engine</h4>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
                  Controls automatic image enhancement, premium backgrounds, and smart pricing for AI imports and the storefront.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {([
                    ['enableImageEnhancement', 'Enable Image Enhancement'],
                    ['enableBackgroundReplacement', 'Enable Background Replacement'],
                    ['enableSmartPricing', 'Enable Smart Pricing (OCR = Selling Price)'],
                    ['enableDiscountGenerator', 'Enable Discount Generator (Display MRP)'],
                    ['allowOriginalImageToggle', 'Allow Original Image Toggle on Storefront'],
                  ] as const).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}>
                      <input
                        type="checkbox"
                        checked={presentationSettings[key]}
                        onChange={(e) => updatePresentationSetting(key, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {!presentationSettings.enableSmartPricing && (
                  <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>LEGACY MRP MARGIN %</label>
                      <input type="number" className="input-field" value={mrpMargin} min={0} max={50} onChange={(e) => setMrpMargin(parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>ROUNDING RULE</label>
                      <select className="input-field" value={roundingRule} onChange={(e) => setRoundingRule(e.target.value as typeof roundingRule)}>
                        <option value="nearest-9">Nearest ₹9</option>
                        <option value="nearest-5">Nearest ₹5</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Single-Image structured JSON response verification block */}
              {hasAiApiKey && (
                <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} /> OCR Verification (OCR.space)
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
                    Upload a sample catalog image to verify AI vision — brand, gender, category, price, and color JSON output.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setTestImageBase64(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="input-field"
                      style={{ width: '250px', fontSize: '0.75rem' }}
                    />
                    
                    <button
                      type="button"
                      disabled={!testImageBase64 || isTestingImage}
                      onClick={async () => {
                        if (!testImageBase64) return;
                        setIsTestingImage(true);
                        setTestResultJson(null);
                        try {
                          initLiveAi();
                          showToast('Sending sample to OCR.space...', 'info');
                          const result = await ai.analyzeFootwearImages([testImageBase64]);
                          setTestResultJson(JSON.stringify(result, null, 2));
                          showToast('Sample image parsed successfully!', 'success');
                        } catch (err: any) {
                          setTestResultJson(JSON.stringify({ error: err.message }, null, 2));
                          showToast(`Verification failed: ${err.message}`, 'error');
                        } finally {
                          setIsTestingImage(false);
                        }
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {isTestingImage ? 'Processing...' : 'Run Vision Verification'}
                    </button>
                  </div>

                  {testImageBase64 && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                      <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '4px', padding: '0.25rem', backgroundColor: '#f9f9f9', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={testImageBase64} alt="Sample Slipper Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      {testResultJson && (
                        <div style={{ flex: 1, minWidth: '250px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>STRUCTURED JSON RESPONSE</span>
                          <pre style={{ fontSize: '0.7rem', backgroundColor: '#1e1e1e', color: '#39ff14', padding: '0.75rem', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', margin: '0.25rem 0 0 0' }}>
                            {testResultJson}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Database Backup & Restore Card */}
              <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={16} /> One-Click Database Backup & Restore
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
                  Create backups of all products, category listings, and CRM leads. You can restore this data at any time.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={handleBackupDatabase} className="btn btn-primary">
                    <Download size={16} /> Backup & Export Database
                  </button>
                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    <Upload size={16} /> Restore from JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreDatabase}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: PROFILE */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '550px' }}>
              <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary))', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, margin: '0 auto 1rem auto' }}>
                  A
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Authenticated Admin</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>Role: Store Owner</span>
                
                <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border) / 0.5)', margin: '1.5rem 0' }} />
                
                <div style={{ textAlign: 'left', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Active Session:</span>
                    <span style={{ fontWeight: 700 }}>Encrypted IndexedDB Vault</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Database Status:</span>
                    <span style={{ color: dbMode === 'supabase' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)', fontWeight: 700 }}>
                      {dbMode === 'supabase' ? 'Supabase Live Connected' : 'Offline Demo Mode'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Connected Client IP:</span>
                    <span style={{ fontWeight: 700 }}>127.0.0.1 (Localhost)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: DYNAMIC CATALOG STUDIO */}
          {activeTab === 'studio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                
                {/* Homepage Section Builder & Festival Mode */}
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '1.25rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} /> Homepage Builder & Themes
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.35rem' }}>ACTIVE FESTIVAL THEME</label>
                      <select
                        className="input-field"
                        value={festivalMode}
                        onChange={async (e) => {
                          const mode = e.target.value;
                          setFestivalMode(mode);
                          if (layout) {
                            const updated = { ...layout, festival_mode: mode };
                            await db.saveHomepageLayout(updated);
                            setLayout(updated);
                            showToast(`Store theme changed to: ${mode.toUpperCase()}!`, 'success');
                          }
                        }}
                      >
                        <option value="normal">Normal Mode (Default Clean)</option>
                        <option value="diwali">Diwali (Festive Crimson & Gold)</option>
                        <option value="pongal">Pongal (Harvest Festive Green)</option>
                        <option value="christmas">Christmas (Winter Crimson)</option>
                        <option value="ramzan">Ramzan (Emerald Crescent)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '0.5rem' }}>HOMEPAGE SECTION ORDER (JSON CONFIGURED)</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {layout?.layout_json?.sections?.map((sect: string, idx: number) => {
                          const sects = layout.layout_json.sections;
                          return (
                            <div key={sect} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', borderRadius: '0.35rem', fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: 600 }}>{sect.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={async () => {
                                    const newSects = [...sects];
                                    const temp = newSects[idx];
                                    newSects[idx] = newSects[idx - 1];
                                    newSects[idx - 1] = temp;
                                    const updated = { ...layout, layout_json: { sections: newSects } };
                                    await db.saveHomepageLayout(updated);
                                    setLayout(updated);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                                >
                                  🔼
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === sects.length - 1}
                                  onClick={async () => {
                                    const newSects = [...sects];
                                    const temp = newSects[idx];
                                    newSects[idx] = newSects[idx + 1];
                                    newSects[idx + 1] = temp;
                                    const updated = { ...layout, layout_json: { sections: newSects } };
                                    await db.saveHomepageLayout(updated);
                                    setLayout(updated);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: idx === sects.length - 1 ? 0.3 : 1 }}
                                >
                                  🔽
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Marketing Poster Canvas Generator */}
                <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShoppingBag size={16} /> AI Social Poster Studio
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Poster Title (e.g. comfort slides)"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Discount Tagline (e.g. flat 20% off)"
                      value={bannerDiscount}
                      onChange={(e) => setBannerDiscount(e.target.value)}
                    />
                    <button onClick={handleGenerateBanner} className="btn btn-primary">
                      Render Poster Banner
                    </button>
                  </div>
                  
                  <div style={{ border: '1px dashed hsl(var(--border))', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', justifyContent: 'center', backgroundColor: '#000000' }}>
                    <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', maxHeight: '140px', objectFit: 'contain' }} />
                  </div>
                  {canvasRef.current && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.download = `${bannerTitle.toLowerCase().replace(/ /g, '_')}_poster.png`;
                        link.href = canvasRef.current!.toDataURL();
                        link.click();
                      }}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                    >
                      Download Shareable PNG Poster
                    </button>
                  )}
                </div>
              </div>

              {/* Groupings Summary Catalog Tree */}
              <div className="glass" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '1.25rem', color: 'hsl(var(--primary))' }}>
                  Visual Catalog Grouping Structure (Dynamic PIM Tree)
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {['Men', 'Women', 'Kids', 'Unisex'].map(gender => {
                    const genderProducts = products.filter(p => p.gender === gender);
                    const cats = Array.from(new Set(genderProducts.map(p => p.category)));
                    return (
                      <div key={gender} style={{ padding: '1rem', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: '0.5rem' }}>
                        <h5 style={{ fontWeight: 800, borderBottom: '1px solid hsl(var(--border) / 0.4)', paddingBottom: '0.4rem', marginBottom: '0.65rem' }}>
                          {gender} ({genderProducts.length})
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                          {cats.length === 0 ? (
                            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>No products in collection</span>
                          ) : (
                            cats.map(cat => (
                              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{cat}</span>
                                <Badge variant="outline">{genderProducts.filter(p => p.category === cat).length}</Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product edit modal */}
      {isProductModalOpen && (
        <Modal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          title={editingProduct ? 'Edit Product' : 'Add Product'}
          size="md"
        >
          <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>PRODUCT NAME</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="E.g. Soft Slide 2.0"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>BRAND</label>
                <select
                  required
                  className="input-field"
                  value={prodBrand}
                  onChange={(e) => setProdBrand(e.target.value)}
                >
                  <option value="" disabled>Select Brand</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>GENDER</label>
                <select
                  className="input-field"
                  value={prodGender}
                  onChange={(e: any) => setProdGender(e.target.value)}
                >
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Kids">Kids</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>CATEGORY</label>
                <select
                  className="input-field"
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                >
                  {ADMIN_FOOTWEAR_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {prodCategory && !ADMIN_FOOTWEAR_CATEGORIES.includes(prodCategory as typeof ADMIN_FOOTWEAR_CATEGORIES[number]) && (
                    <option value={prodCategory}>{prodCategory}</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>MATERIAL</label>
                <input
                  type="text"
                  className="input-field"
                  value={prodMaterial}
                  onChange={(e) => setProdMaterial(e.target.value)}
                  placeholder="EVA, Rubber..."
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>SUGGESTED MRP (₹)</label>
                <input
                  type="number"
                  className="input-field"
                  value={prodMrp}
                  onChange={(e) => setProdMrp(parseInt(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>OFFER PRICE (₹)</label>
                <input
                  type="number"
                  className="input-field"
                  value={prodOfferPrice}
                  onChange={(e) => setProdOfferPrice(parseInt(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>STATUS</label>
                <select
                  className="input-field"
                  value={prodStatus}
                  onChange={(e: any) => setProdStatus(e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>SLIPPER STORY (DESCRIPTION)</label>
              <textarea
                className="input-field"
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Evocative description..."
                rows={3}
              />
            </div>

            {/* Product Image Upload Section */}
            <div style={{ borderTop: '1px solid hsl(var(--border) / 0.5)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={16} /> PRODUCT IMAGES
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}>
                    <Upload size={14} /> Choose Image Files
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={handleProductImageUpload} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>or paste Image URL:</span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://example.com/slipper-photo.jpg"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddImageUrl}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                  >
                    Add URL
                  </button>
                </div>

                {/* Previews */}
                {prodImages.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {prodImages.map((img, idx) => (
                      <div key={idx} style={{
                        position: 'relative',
                        width: '85px',
                        height: '85px',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        border: img.is_primary ? '2px solid #DC2626' : '1px solid hsl(var(--border))',
                        backgroundColor: '#000'
                      }}>
                        <img src={img.url} alt={`Product ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {img.is_primary ? (
                          <span style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            background: '#DC2626',
                            color: '#fff',
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '999px'
                          }}>
                            PRIMARY
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              left: '4px',
                              background: 'rgba(0,0,0,0.75)',
                              color: '#fff',
                              fontSize: '0.55rem',
                              padding: '0.1rem 0.3rem',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Set Main
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveProductImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(0,0,0,0.8)',
                            color: '#ff4d4d',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '1rem',
                    textAlign: 'center',
                    border: '1px dashed hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '0.78rem',
                    color: 'hsl(var(--muted-foreground))'
                  }}>
                    📷 No image uploaded yet. Click <strong>Choose Image Files</strong> to pick photos from your device.
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid hsl(var(--border) / 0.5)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem' }}>Variant & Size Inventory</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>COLOR</label>
                  <input
                    type="text"
                    className="input-field"
                    value={prodColor}
                    onChange={(e) => setProdColor(e.target.value)}
                    placeholder="E.g. Carbon Black"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>STOCK BY SIZES</label>
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
                    {[6, 7, 8, 9, 10].map(sz => (
                      <div key={sz} style={{ minWidth: '45px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, marginBottom: '0.2rem' }}>S-{sz}</span>
                        <input
                          type="number"
                          className="input-field"
                          value={prodStock[sz] || 0}
                          onChange={(e) => setProdStock({ ...prodStock, [sz]: Math.max(0, parseInt(e.target.value) || 0) })}
                          style={{ padding: '0.3rem', textAlign: 'center' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>TAGS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  className="input-field"
                  value={prodTags}
                  onChange={(e) => setProdTags(e.target.value)}
                  placeholder="eva, slide, light"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>COLLECTIONS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  className="input-field"
                  value={prodCollections}
                  onChange={(e) => setProdCollections(e.target.value)}
                  placeholder="Daily Wear, Trending"
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>KEY ADVANTAGES (ONE PER LINE)</label>
              <textarea
                className="input-field"
                value={prodFeatures}
                onChange={(e) => setProdFeatures(e.target.value)}
                placeholder="Cloud cushion midsole..."
                rows={3}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.85rem' }}>
              <Save size={18} /> Save Product
            </button>
          </form>
        </Modal>
      )}

      {/* AI Details Review Drawer Modal */}
      {isDetailDrawerOpen && drawerItem && (
        <Modal
          isOpen={isDetailDrawerOpen}
          onClose={() => setIsDetailDrawerOpen(false)}
          title={`Review Details: ${drawerItem.fileName}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <img
                src={drawerItem.processedImageUrl}
                alt=""
                style={{ width: '80px', height: '80px', objectFit: 'contain', background: '#ffffff', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
              />
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>{drawerItem.extractedData?.name}</h4>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  AI Confidence: {drawerItem.extractedData?.aiConfidence}% • 
                  Blur Score: {drawerItem.blurScore} ({drawerItem.isBlurry ? 'Blurry' : 'Sharp'})
                </p>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>NIKE-STYLE PRODUCT DESCRIPTION</label>
              <textarea
                className="input-field"
                value={drawerDesc}
                onChange={(e) => setDrawerDesc(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>KEY ADVANTAGES (ONE PER LINE)</label>
              <textarea
                className="input-field"
                value={drawerFeatures}
                onChange={(e) => setDrawerFeatures(e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>TAGS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  className="input-field"
                  value={drawerTags}
                  onChange={(e) => setDrawerTags(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>COLLECTIONS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  className="input-field"
                  value={drawerCollections}
                  onChange={(e) => setDrawerCollections(e.target.value)}
                />
              </div>
            </div>

            <button onClick={saveDrawerDetails} className="btn btn-primary" style={{ padding: '0.85rem', marginTop: '0.5rem' }}>
              <Save size={16} /> Save Product Details
            </button>
          </div>
        </Modal>
      )}

      {isUnlockModalOpen && (
        <Modal
          isOpen={isUnlockModalOpen}
          onClose={() => setIsUnlockModalOpen(false)}
          title="Unlock API Key Vault"
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              Enter your master passcode to decrypt and unlock live mode.
            </p>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>MASTER PASSCODE</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showUnlockPasscode ? 'text' : 'password'}
                  className="input-field"
                  value={unlockPasscode}
                  onChange={(e) => setUnlockPasscode(e.target.value)}
                  placeholder="Enter passcode..."
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPasscode(!showUnlockPasscode)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showUnlockPasscode ? <Eye size={16} /> : <Eye size={16} style={{ opacity: 0.4 }} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={handleModalUnlock} className="btn btn-primary" style={{ flex: 1 }}>
                <Unlock size={16} /> Unlock
              </button>
              <button onClick={() => setIsUnlockModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border) / 0.5)', margin: '0.25rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={() => showToast('Forgot Passcode: To reset your passcode, click "Reset Vault" to delete the current vault and set up a new master passcode.', 'info')} 
                className="btn btn-ghost" 
                style={{ padding: 0, fontSize: '0.75rem', textDecoration: 'underline' }}
              >
                Forgot Passcode?
              </button>
              <button 
                type="button" 
                onClick={handleModalResetVault} 
                className="btn btn-destructive" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                Reset Vault
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// App wrapper providing Toast Context
export default function App() {
  return (
    <ToastProvider>
      <AdminDashboard />
    </ToastProvider>
  );
}
