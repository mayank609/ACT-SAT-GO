import React, { useState, useRef, useEffect } from 'react';
import { Upload, Link, Trash2, Eye, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface UploadedImage {
  url: string;
  path: string;
  fileName: string;
  size: number;
}

interface ImageUploaderProps {
  onInsertImage: (url: string) => void;
  context?: string;
  className?: string;
}

export function ImageUploader({
  onInsertImage,
  context = 'questions',
  className = '',
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Upload status tracking
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Clipboard Paste Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleUpload(file);
            break;
          }
        }
      }
    };

    // Attach paste listener to the drop zone container
    const element = dropZoneRef.current;
    if (element) {
      element.addEventListener('paste', handlePaste);
    }
    return () => {
      if (element) {
        element.removeEventListener('paste', handlePaste);
      }
    };
  }, [dropZoneRef.current]);

  const validateFile = (file: File): boolean => {
    setError(null);
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please upload PNG, JPEG, GIF, WEBP or SVG.');
      return false;
    }

    if (file.size > MAX_SIZE) {
      setError('File size too large. Maximum size is 5MB.');
      return false;
    }

    return true;
  };

  const handleUpload = async (file: File) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const localPreviewUrl = URL.createObjectURL(file);
    setUploadPreview(localPreviewUrl);

    const cleanup = () => {
      URL.revokeObjectURL(localPreviewUrl);
      setUploadPreview(null);
      setUploading(false);
    };

    try {
      // ── 1. Resolve a fresh access token ─────────────────────────────────────
      let token: string | null = null;
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData.session) {
        token = refreshData.session.access_token;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData.session?.access_token ?? null;
      }

      if (!token) {
        cleanup();
        setError('Session expired — please log out and log in again.');
        return;
      }

      // ── 2. Try direct Supabase Storage upload (no backend proxy needed) ─────
      const uniqueId = crypto.randomUUID();
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${context}/${uniqueId}_${cleanName}`;

      const { error: storageError } = await supabase.storage
        .from('images')
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true,
        });

      if (!storageError) {
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(storagePath);
        const result: UploadedImage = { url: publicUrl, path: storagePath, fileName: file.name, size: file.size };
        setImages((prev) => [result, ...prev]);
        onInsertImage(publicUrl);
        setUploadProgress(100);
        cleanup();
        return;
      }

      // Log the Supabase storage error so the user can set up the bucket if needed
      console.warn(
        '[ImageUploader] Direct Supabase upload failed:', storageError.message,
        '\nIf the bucket does not exist, run in Supabase SQL Editor:\n',
        'INSERT INTO storage.buckets (id,name,public) VALUES (\'images\',\'images\',true) ON CONFLICT DO NOTHING;\n',
        'CREATE POLICY "auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id=\'images\');\n',
        'CREATE POLICY "public_read"  ON storage.objects FOR SELECT  TO public        USING  (bucket_id=\'images\');'
      );

      // ── 3. Fallback: backend proxy route (saves to local filesystem if no Supabase) ──
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', context);

        const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
        xhr.open('POST', `${apiBase}/api/images/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText) as UploadedImage;
              setImages((prev) => [result, ...prev]);
              onInsertImage(result.url);
              resolve();
            } catch {
              reject(new Error('Failed to parse upload response.'));
            }
          } else {
            try {
              const errBody = JSON.parse(xhr.responseText);
              reject(new Error(errBody.error || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error — is the platform server running on port 3000?'));
        xhr.send(formData);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      cleanup();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    onInsertImage(urlInput.trim());
    setUrlInput('');
  };

  const handleDeleteImage = async (path: string) => {
    try {
      await api.deleteImage(path);
      setImages((prev) => prev.filter((img) => img.path !== path));
    } catch (err: any) {
      setError(err.message || 'Failed to delete image.');
    }
  };

  return (
    <div className={`p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-inner ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
          <ImageIcon size={14} className="text-blue-500" />
          Image Manager
        </span>
        <span className="text-[10px] text-slate-400">Ctrl+V inside dropzone to paste</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload Zone */}
        <div className="space-y-3">
          <div
            ref={dropZoneRef}
            tabIndex={0}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center cursor-pointer outline-none transition-all duration-300 ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50 text-blue-600 shadow-md scale-[1.02]'
                : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/20 bg-white text-slate-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />

            {uploading ? (
              <div className="space-y-3 w-full py-2">
                {uploadPreview && (
                  <img
                    src={uploadPreview}
                    alt="Uploading preview"
                    className="h-16 mx-auto object-contain rounded opacity-60 max-w-full"
                  />
                )}
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  Uploading... {uploadProgress}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-250 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 bg-slate-100 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-500 rounded-xl flex items-center justify-center mb-2 transition-colors">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Drop image, paste clipboard, or click to browse
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports PNG, JPG, GIF, WEBP, SVG (max 5MB)
                </p>
              </>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* URL Input field */}
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Link size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Or paste external image URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Add URL
            </button>
          </form>
        </div>

        {/* Gallery / Preview List */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col h-[180px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">
            Images in this Session ({images.length})
          </span>
          {images.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-300 py-4">
              <ImageIcon size={28} className="opacity-20 mb-1" />
              <p className="text-[11px]">No images uploaded yet</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {images.map((img) => (
                <div
                  key={img.path}
                  className="flex items-center gap-2 p-1.5 border border-slate-100 rounded-lg bg-slate-50 hover:bg-slate-100/50 group transition-all"
                >
                  <img
                    src={img.url}
                    alt={img.fileName}
                    className="w-10 h-10 object-cover rounded bg-white border border-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{img.fileName}</p>
                    <p className="text-[9px] text-slate-400 font-mono">
                      {(img.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onInsertImage(img.url)}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Insert into Editor"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(img.url, '_blank')}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded"
                      title="Open in new tab"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.path)}
                      className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete from Storage"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
