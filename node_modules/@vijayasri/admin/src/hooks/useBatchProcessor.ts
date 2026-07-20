import { useState, useRef, useCallback, useMemo } from 'react';
import {
  QueueItem,
  ImportMode,
  generateSku,
  PresentationSettings,
  DEFAULT_PRESENTATION_SETTINGS,
  computePremiumPricing,
  generateSeoImageAlt,
} from '@vijayasri/shared';
import {
  fileToImage,
  computeCompositeHash,
  detectBlur,
  enhanceProductImage,
} from '@vijayasri/image-processing';
import { ai, AIAnalysisResult } from '@vijayasri/ai';
import {
  db,
  assertUuid,
  sanitizeImportCategory,
  sanitizeImportCollections,
  parseCatalogFilename,
} from '@vijayasri/database';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  let timer: number;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  return Promise.race([
    promise.then(val => {
      clearTimeout(timer);
      return val;
    }),
    timeoutPromise
  ]);
}

export function useBatchProcessor(
  mrpMargin: number,
  roundingRule: 'none' | 'nearest-9' | 'nearest-5',
  presentationSettings: PresentationSettings = DEFAULT_PRESENTATION_SETTINGS,
  importMode: ImportMode = 'catalog',
  onItemCompleted?: (item: QueueItem) => void,
  onBatchComplete?: (queue: QueueItem[]) => void
) {
  const [queue, _setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const presentationRef = useRef(presentationSettings);
  presentationRef.current = presentationSettings;
  const importModeRef = useRef(importMode);
  importModeRef.current = importMode;

  const setQueue = useCallback((newVal: QueueItem[] | ((prev: QueueItem[]) => QueueItem[])) => {
    _setQueue(prev => {
      const resolved = typeof newVal === 'function' ? (newVal as Function)(prev) : newVal;
      queueRef.current = resolved;
      return resolved;
    });
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const activeWorkersRef = useRef(0);
  const retriesRef = useRef<Record<string, number>>({});
  const batchHadWorkRef = useRef(false);
  const batchCompleteFiredRef = useRef(false);

  const notifyBatchCompleteIfDone = useCallback(() => {
    if (!onBatchComplete || !batchHadWorkRef.current || batchCompleteFiredRef.current) return;
    const q = queueRef.current;
    const stillRunning = q.some(item =>
      item.status === 'pending' || item.status === 'preprocessing' || item.status === 'analyzing'
    );
    if (stillRunning || processingRef.current) return;
    batchCompleteFiredRef.current = true;
    batchHadWorkRef.current = false;
    onBatchComplete(q);
  }, [onBatchComplete]);

  const getMaxConcurrency = () => (importModeRef.current === 'catalog' ? 6 : 3);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const addFiles = useCallback((files: FileList) => {
    const fileArray = Array.from(files).filter(file => {
      const lowerName = file.name.toLowerCase();
      return file.type.startsWith('image/') ||
             lowerName.endsWith('.jpg') ||
             lowerName.endsWith('.jpeg') ||
             lowerName.endsWith('.png') ||
             lowerName.endsWith('.webp');
    });

    const newQueueItems: QueueItem[] = fileArray.map(file => {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      let folderHint: string | undefined;
      if (relativePath && relativePath.includes('/')) {
        const parts = relativePath.split('/');
        if (parts.length >= 2) {
          folderHint = parts[parts.length - 2];
        }
      }
      return {
        id: crypto.randomUUID(),
        fileName: fileNameWithoutExt,
        fileSize: file.size,
        file: file,
        folderHint,
        status: 'pending',
        progress: 0,
        extractedData: undefined
      };
    });

    setQueue(prev => [...prev, ...newQueueItems]);
    setElapsedTime(0);
  }, []);

  const processQueue = useCallback(async () => {
    if (!processingRef.current) return;

    setQueue(currentQueue => {
      const pendingItems = currentQueue.filter(item => item.status === 'pending');
      const activeCount = activeWorkersRef.current;
      const maxConcurrency = getMaxConcurrency();
      const space = maxConcurrency - activeCount;

      if (space <= 0 || pendingItems.length === 0) {
        if (activeCount === 0 && pendingItems.length === 0) {
          setIsProcessing(false);
          processingRef.current = false;
          stopTimer();
          notifyBatchCompleteIfDone();
        }
        return currentQueue;
      }

      const itemsToStart = pendingItems.slice(0, space);
      itemsToStart.forEach(item => {
        activeWorkersRef.current++;
        processItem(item.id);
      });

      return currentQueue.map(item => {
        if (itemsToStart.some(x => x.id === item.id)) {
          return { ...item, status: 'preprocessing', progress: 10 };
        }
        return item;
      });
    });
  }, [stopTimer, notifyBatchCompleteIfDone]);

  const processItem = async (itemId: string) => {
    const currentItem = queueRef.current.find(x => x.id === itemId);
    if (!currentItem) {
      activeWorkersRef.current--;
      return;
    }

    const file = currentItem.file;
    const settings = presentationRef.current;
    const mode = importModeRef.current;
    const isCatalogMode = mode === 'catalog';
    if (!retriesRef.current[itemId]) {
      retriesRef.current[itemId] = 0;
    }

    try {
      setQueue(q => q.map(item => item.id === itemId ? { ...item, status: 'preprocessing', progress: 15, stage: 'Image Decoded' } : item));

      const img = await withTimeout(fileToImage(file), 10000, 'Validate timeout (decoding image took too long).');

      setQueue(q => q.map(item => item.id === itemId ? { ...item, progress: 30, stage: settings.enableImageEnhancement ? 'Enhancing product image' : 'Preparing catalog image' } : item));

      const enhanced = await withTimeout(
        Promise.resolve(enhanceProductImage(img, {
          enableEnhancement: settings.enableImageEnhancement,
          enableBackgroundReplacement: settings.enableBackgroundReplacement,
        })),
        15000,
        'Image processing timeout.'
      );

      console.log(`[Importer] Catalog background detected: ${enhanced.isCatalogBackground}`);
      console.log(`[Importer] Background theme: ${enhanced.backgroundTheme}`);
      console.log(`[Importer] Color palette: ${enhanced.colorPalette.dominant}`);

      const useProcessedImages = settings.enableImageEnhancement || settings.enableBackgroundReplacement;
      const displayImage = useProcessedImages ? enhanced.enhancedBase64 : enhanced.originalBase64;

      setQueue(q => q.map(item => item.id === itemId ? { ...item, progress: 45, stage: 'Thumbnail generated' } : item));

      const compositeHash = computeCompositeHash(img);
      const blurResult = detectBlur(img);

      setQueue(q => q.map(item => item.id === itemId ? {
        ...item,
        status: 'analyzing',
        progress: 65,
        stage: isCatalogMode ? 'Reading filename metadata' : `AI vision (${ai.mode})`,
        compositeHash,
        processedImageUrl: displayImage,
        thumbnailUrl: enhanced.thumbnailBase64,
        error: blurResult.isBlurry && !isCatalogMode ? 'Image detected as BLURRY.' : undefined
      } : item));

      const aiMargin = settings.enableSmartPricing ? 0 : mrpMargin;
      const aiRounding = settings.enableSmartPricing ? 'none' as const : roundingRule;

      let analysisResult: AIAnalysisResult;
      let fromCache = false;

      if (isCatalogMode) {
        const catalogMeta = parseCatalogFilename(currentItem.fileName, currentItem.folderHint);
        analysisResult = catalogMeta;
        console.log(`[Catalog Import] ${currentItem.fileName} → ${catalogMeta.name} (₹${catalogMeta.mrp})`);
      } else {
        const aiResult = await ai.analyzeSlipper(
          compositeHash,
          [enhanced.originalBase64],
          aiMargin,
          aiRounding
        );
        analysisResult = aiResult.result;
        fromCache = aiResult.fromCache;
      }

      setQueue(q => q.map(item => item.id === itemId ? { ...item, progress: 85, stage: 'Database insert started' } : item));

      const resolved = await db.resolveBrandIdForImport(
        analysisResult.brand,
        analysisResult.model,
        analysisResult.name
      );
      const branchId = await db.getDefaultBranchId();
      assertUuid(resolved.brandId, 'brand_id');
      assertUuid(branchId, 'branch_id');

      const ocrPrice = analysisResult.mrp;
      let sellingPrice = ocrPrice;
      let displayMrp = ocrPrice;

      if (settings.enableSmartPricing) {
        const pricing = computePremiumPricing(ocrPrice);
        sellingPrice = pricing.sellingPrice;
        displayMrp = settings.enableDiscountGenerator ? pricing.displayMrp : pricing.sellingPrice;
        console.log(`[Importer] Price: ₹${ocrPrice} → Selling: ₹${sellingPrice}, Display MRP: ₹${displayMrp}`);
      } else {
        sellingPrice = analysisResult.offer_price;
        displayMrp = analysisResult.mrp;
      }

      const seoImageAlt = generateSeoImageAlt(resolved.name, resolved.brand, analysisResult.color);

      const existingProductId = await db.findProductByCompositeHash(compositeHash);
      const productId = existingProductId ?? crypto.randomUUID();
      if (existingProductId) {
        console.log(`[Importer] Duplicate detected (hash ${compositeHash}) — updating product ${existingProductId}`);
      }

      console.log('[Importer] Publishing product...');

      const productPayload = {
        id: productId,
        branch_id: branchId,
        brand_id: resolved.brandId,
        sku: generateSku(analysisResult.gender, analysisResult.category, resolved.brand, Math.floor(Math.random() * 100000)),
        barcode: null,
        name: resolved.name,
        gender: analysisResult.gender,
        category: sanitizeImportCategory(analysisResult.category),
        material: analysisResult.material,
        mrp: displayMrp,
        offer_price: sellingPrice,
        description: analysisResult.description,
        status: 'published' as const,
        ai_prompt_version: isCatalogMode ? 'catalog-filename-v1' : `ai-${ai.mode}-v1`,
        ai_confidence_score: analysisResult.aiConfidence,
        ai_analysis_details: {
          ...analysisResult.aiAnalysisDetails,
          presentation: {
            colorPalette: enhanced.colorPalette,
            backgroundTheme: enhanced.backgroundTheme,
            isCatalogBackground: enhanced.isCatalogBackground,
            seoImageAlt,
            ocrPrice,
            sellingPrice,
            displayMrp,
            importMode: mode,
            sourceFileName: currentItem.fileName,
            folderHint: currentItem.folderHint,
          },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const sizesPayload = analysisResult.sizes.map(size => ({
        size_number: size,
        stock: 10
      }));

      const variantsPayload = [
        {
          color: analysisResult.color,
          compositeHash: compositeHash,
          images: useProcessedImages
            ? [
                { url: enhanced.enhancedBase64, is_primary: true, sort_order: 0 },
                { url: enhanced.originalBase64, is_primary: false, sort_order: 1 },
              ]
            : [{ url: enhanced.originalBase64, is_primary: true, sort_order: 0 }],
          sizes: sizesPayload
        }
      ];

      await db.saveProduct(
        productPayload,
        analysisResult.features,
        analysisResult.tags,
        sanitizeImportCollections(analysisResult.collections),
        variantsPayload
      );
      console.log('[Importer] Product published successfully.');

      setQueue(q => q.map(item => {
        if (item.id === itemId) {
          const completedItem: QueueItem = {
            ...item,
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            publishedProductId: productId,
            extractedData: {
              name: resolved.name,
              brand: resolved.brand,
              model: resolved.model,
              gender: analysisResult.gender,
              category: analysisResult.category,
              material: analysisResult.material,
              mrp: displayMrp,
              offer_price: sellingPrice,
              description: analysisResult.description,
              features: analysisResult.features,
              tags: analysisResult.tags,
              collections: analysisResult.collections,
              color: analysisResult.color,
              sizes: analysisResult.sizes,
              aiConfidence: analysisResult.aiConfidence,
              aiAnalysisDetails: productPayload.ai_analysis_details,
            },
            isDuplicate: fromCache
          };
          if (onItemCompleted) onItemCompleted(completedItem);
          return completedItem;
        }
        return item;
      }));

    } catch (err: any) {
      console.error(`[Batch Processor] [${currentItem.fileName}] Error:`, err);

      const isPreprocessing = currentItem.status === 'preprocessing' || (currentItem.stage?.includes('Image') ?? false);

      if (isPreprocessing && retriesRef.current[itemId] < 1) {
        retriesRef.current[itemId]++;
        setQueue(q => q.map(item => item.id === itemId ? { ...item, status: 'pending', progress: 0, stage: 'Retrying Preprocessing' } : item));
        activeWorkersRef.current--;
        setTimeout(() => processQueue(), 100);
        return;
      }

      setQueue(q => q.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status: 'failed',
            progress: 100,
            stage: 'Failed',
            error: err.message || 'Pipeline processing failed.'
          };
        }
        return item;
      }));
    } finally {
      activeWorkersRef.current--;
      setTimeout(() => processQueue(), 50);
    }
  };

  const start = useCallback(() => {
    if (isProcessing) return;
    batchHadWorkRef.current = queueRef.current.some(item => item.status === 'pending');
    batchCompleteFiredRef.current = false;
    setIsProcessing(true);
    processingRef.current = true;
    startTimer();
    processQueue();
  }, [isProcessing, startTimer, processQueue]);

  const pause = useCallback(() => {
    setIsProcessing(false);
    processingRef.current = false;
    stopTimer();
    setQueue(prev => prev.map(item => {
      if (item.status === 'preprocessing' || item.status === 'analyzing') {
        return { ...item, status: 'pending', progress: 0 };
      }
      return item;
    }));
    activeWorkersRef.current = 0;
  }, [stopTimer]);

  const cancel = useCallback(() => {
    setIsProcessing(false);
    processingRef.current = false;
    stopTimer();
    setQueue([]);
    activeWorkersRef.current = 0;
  }, [stopTimer]);

  const retryFailed = useCallback(() => {
    setQueue(prev => prev.map(item => {
      if (item.status === 'failed') {
        return { ...item, status: 'pending', progress: 0, error: undefined };
      }
      return item;
    }));
    if (!isProcessing) start();
  }, [isProcessing, start]);

  const retryItem = useCallback((itemId: string) => {
    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, status: 'pending', progress: 0, error: undefined };
      }
      return item;
    }));
    if (!isProcessing) start();
  }, [isProcessing, start]);

  const removeItem = useCallback((itemId: string) => {
    setQueue(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const remainingTime = useMemo(() => {
    const pendingCount = queue.filter(item => item.status === 'pending' || item.status === 'preprocessing' || item.status === 'analyzing').length;
    const completedCount = queue.filter(item => item.status === 'completed').length;
    if (pendingCount === 0) return 0;
    const averageTime = completedCount > 0 ? elapsedTime / completedCount : 5;
    const activeCon = Math.max(1, activeWorkersRef.current);
    return Math.round((pendingCount * averageTime) / activeCon);
  }, [queue, elapsedTime]);

  return {
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
  };
}
