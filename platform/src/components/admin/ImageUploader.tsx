'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, Link, Trash2, Eye, Check, Loader2, Image as ImageIcon } from 'lucide-react'

interface UploadedImage {
  url: string
  path: string
  fileName: string
  size: number
}

interface ImageUploaderProps {
  onInsertImage: (url: string) => void
  context?: string
  className?: string
}

export function ImageUploader({
  onInsertImage,
  context = 'questions',
  className = '',
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // Upload status tracking
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Clipboard Paste Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            e.preventDefault()
            handleUpload(file)
            break
          }
        }
      }
    }

    // Attach paste listener to the drop zone container
    const element = dropZoneRef.current
    if (element) {
      element.addEventListener('paste', handlePaste)
    }
    return () => {
      if (element) {
        element.removeEventListener('paste', handlePaste)
      }
    }
  }, [dropZoneRef.current])

  const validateFile = (file: File): boolean => {
    setError(null)
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please upload PNG, JPEG, GIF, WEBP or SVG.')
      return false
    }

    if (file.size > MAX_SIZE) {
      setError('File size too large. Maximum size is 5MB.')
      return false
    }

    return true
  }

  const handleUpload = (file: File) => {
    if (!validateFile(file)) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    // Create a local preview before upload finishes
    const localUrl = URL.createObjectURL(file)
    setUploadPreview(localUrl)

    // Use XMLHttpRequest for real upload progress
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('context', context)

    xhr.open('POST', '/api/images/upload')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(percentComplete)
      }
    }

    xhr.onload = () => {
      URL.revokeObjectURL(localUrl)
      setUploadPreview(null)
      setUploading(false)

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as UploadedImage
          setImages((prev) => [result, ...prev])
          // Automatically insert the uploaded image
          onInsertImage(result.url)
        } catch (e) {
          setError('Failed to parse upload response.')
        }
      } else {
        try {
          const errResponse = JSON.parse(xhr.responseText)
          setError(errResponse.error || 'Failed to upload image.')
        } catch {
          setError('Failed to upload image.')
        }
      }
    }

    xhr.onerror = () => {
      URL.revokeObjectURL(localUrl)
      setUploadPreview(null)
      setUploading(false)
      setError('Network error occurred during upload.')
    }

    xhr.send(formData)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0])
    }
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    onInsertImage(urlInput.trim())
    setUrlInput('')
  }

  const handleDeleteImage = async (path: string) => {
    try {
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'Delete failed')
      }
      setImages((prev) => prev.filter((img) => img.path !== path))
    } catch (err: any) {
      setError(err.message || 'Failed to delete image.')
    }
  }

  return (
    <div className={`p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 shadow-inner ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <ImageIcon size={14} className="text-emerald-500" />
          Image Manager
        </span>
        <span className="text-[10px] text-slate-500">Ctrl+V inside dropzone to paste</span>
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
                ? 'border-emerald-500 bg-slate-800/60 text-emerald-400 shadow-md scale-[1.02]'
                : 'border-slate-700 hover:border-emerald-500 hover:bg-slate-800/30 bg-slate-950 text-slate-400'
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
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-400 animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  Uploading... {uploadProgress}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-250 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 bg-slate-800 text-slate-400 group-hover:text-emerald-500 rounded-xl flex items-center justify-center mb-2 transition-colors">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Drop image, paste clipboard, or click to browse
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Supports PNG, JPG, GIF, WEBP, SVG (max 5MB)
                </p>
              </>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* URL Input field */}
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Link size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Or paste external image URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-950 text-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-650 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors bg-emerald-600"
            >
              Add URL
            </button>
          </form>
        </div>

        {/* Gallery / Preview List */}
        <div className="bg-slate-950 border border-slate-750 rounded-xl p-3 flex flex-col h-[180px]">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 block">
            Images in this Session ({images.length})
          </span>
          {images.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600 py-4">
              <ImageIcon size={28} className="opacity-20 mb-1" />
              <p className="text-[11px]">No images uploaded yet</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {images.map((img) => (
                <div
                  key={img.path}
                  className="flex items-center gap-2 p-1.5 border border-slate-800 rounded-lg bg-slate-900 hover:bg-slate-850 group transition-all"
                >
                  <img
                    src={img.url}
                    alt={img.fileName}
                    className="w-10 h-10 object-cover rounded bg-slate-950 border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{img.fileName}</p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {(img.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onInsertImage(img.url)}
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded"
                      title="Insert into Editor"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(img.url, '_blank')}
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                      title="Open in new tab"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.path)}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-950 rounded"
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
  )
}
