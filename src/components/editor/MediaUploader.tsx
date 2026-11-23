import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, Upload } from 'lucide-react';
import { MediaSlot, uploadMediaAsset } from '../../lib/utils';

export interface UploadedAssetResult {
  file: File;
  url: string;
  cleanUrl: string;
  info: string;
}

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  message?: string;
}

interface MediaUploaderProps {
  folder: string;
  slot?: MediaSlot;
  accept?: string;
  multiple?: boolean;
  label?: string;
  helperText?: string;
  maxFiles?: number;
  onUploaded: (results: UploadedAssetResult[]) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  folder,
  slot = 'inline',
  accept = 'image/*',
  multiple = false,
  label = 'Arrastra aquí o selecciona archivos',
  helperText = 'Se convierten a WebP optimizado automáticamente.',
  maxFiles = 20,
  onUploaded,
}) => {
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  const processSingleFile = async (itemId: string, file: File): Promise<UploadedAssetResult | null> => {
    setQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, status: 'uploading', progress: 5, message: 'Procesando...' } : q))
    );
    try {
      const res = await uploadMediaAsset(
        file,
        folder,
        (pct) => {
          setQueue((prev) => prev.map((q) => (q.id === itemId ? { ...q, progress: pct } : q)));
        },
        slot
      );
      setQueue((prev) =>
        prev.map((q) =>
          q.id === itemId ? { ...q, status: 'done', progress: 100, message: res.info } : q
        )
      );
      return { file, url: res.url, cleanUrl: res.cleanUrl, info: res.info };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo subir el archivo.';
      setQueue((prev) =>
        prev.map((q) => (q.id === itemId ? { ...q, status: 'error', message: errMsg } : q))
      );
      return null;
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, multiple ? maxFiles : 1);
    const items: UploadQueueItem[] = files.map((file, i) => ({
      id: `up_${Date.now()}_${i}`,
      file,
      progress: 0,
      status: 'uploading',
    }));
    setQueue(items);

    const successes: UploadedAssetResult[] = [];
    for (const item of items) {
      const result = await processSingleFile(item.id, item.file);
      if (result) successes.push(result);
    }
    if (successes.length > 0) {
      onUploaded(successes);
    }
  };

  const retryItem = async (item: UploadQueueItem) => {
    const result = await processSingleFile(item.id, item.file);
    if (result) {
      onUploaded([result]);
    }
  };

  return (
    <div className="space-y-2.5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-[var(--editorial-primary)] bg-[var(--editorial-primary)]/5'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-500 bg-[#F8F6F1]/60 dark:bg-[#191919]'
        }`}
      >
        <Upload className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="text-[11px] text-neutral-500">{helperText}</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {queue.length > 0 && (
        <ul className="space-y-1.5">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-2.5 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{item.file.name}</span>
                {item.status === 'done' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Listo
                  </span>
                ) : item.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => void retryItem(item)}
                    className="inline-flex items-center gap-1 text-[var(--editorial-primary)] font-display font-bold uppercase cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Reintentar
                  </button>
                ) : (
                  <span className="font-tabular text-neutral-500 shrink-0">{item.progress}%</span>
                )}
              </div>
              {item.status === 'uploading' && (
                <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-[var(--editorial-primary)] transition-all duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.status === 'error' && item.message && (
                <p className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{item.message}</span>
                </p>
              )}
              {item.status === 'done' && item.message && (
                <p className="text-[11px] text-neutral-500">{item.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
