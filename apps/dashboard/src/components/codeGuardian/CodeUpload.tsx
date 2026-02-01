/**
 * CodeUpload Component
 * Multi-file drag-drop upload with file type validation and progress indicator
 */

import { useState, useRef, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Upload, X, CheckCircle, AlertCircle, FileCode } from 'lucide-react';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  content: string;
  language: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface CodeUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  acceptedLanguages: string[];
  maxFileSize?: number; // in bytes, default 1MB
  maxFiles?: number; // default 20
}

const languageExtensions: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs'],
  python: ['.py'],
  java: ['.java'],
  csharp: ['.cs'],
  go: ['.go'],
};

const extensionToLanguage: Record<string, string> = {};
Object.entries(languageExtensions).forEach(([lang, exts]) => {
  exts.forEach(ext => {
    extensionToLanguage[ext] = lang;
  });
});

export function CodeUpload({
  files,
  onFilesChange,
  acceptedLanguages,
  maxFileSize = 1024 * 1024, // 1MB
  maxFiles = 20,
}: CodeUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedExtensions = acceptedLanguages.flatMap(lang => languageExtensions[lang] || []);

  const validateFile = (file: File): { valid: boolean; error?: string; language?: string } => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!acceptedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file type. Accepted: ${acceptedExtensions.join(', ')}`,
      };
    }

    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File too large. Max size: ${formatFileSize(maxFileSize)}`,
      };
    }

    return { valid: true, language: extensionToLanguage[ext] };
  };

  const processFiles = useCallback(async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    const remainingSlots = maxFiles - files.length;
    const fileArray = Array.from(fileList);

    for (let i = 0; i < Math.min(fileArray.length, remainingSlots); i++) {
      const file = fileArray[i];
      if (!file) continue;
      const validation = validateFile(file);

      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${i}-${file.name}`,
        name: file.name,
        size: file.size,
        content: '',
        language: validation.language || 'unknown',
        status: validation.valid ? 'uploading' : 'error',
        progress: 0,
        error: validation.error,
      };

      newFiles.push(uploadedFile);
    }

    // Update state with new files (showing uploading state)
    let currentFiles = [...files, ...newFiles];
    onFilesChange(currentFiles);

    // Read file contents
    for (const uploadedFile of newFiles) {
      if (uploadedFile.status === 'error') continue;

      const file = fileArray.find(f => f.name === uploadedFile.name);
      if (!file) continue;

      try {
        const content = await readFileContent(file, (progress) => {
          currentFiles = currentFiles.map((f: UploadedFile) =>
            f.id === uploadedFile.id ? { ...f, progress } : f
          );
          onFilesChange(currentFiles);
        });

        currentFiles = currentFiles.map((f: UploadedFile) =>
          f.id === uploadedFile.id
            ? { ...f, content, status: 'success' as const, progress: 100 }
            : f
        );
        onFilesChange(currentFiles);
      } catch {
        currentFiles = currentFiles.map((f: UploadedFile) =>
          f.id === uploadedFile.id
            ? { ...f, status: 'error' as const, error: 'Failed to read file' }
            : f
        );
        onFilesChange(currentFiles);
      }
    }
  }, [files, maxFiles, onFilesChange, acceptedExtensions, maxFileSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    onFilesChange(files.filter(f => f.id !== fileId));
  };

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedExtensions.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <Upload className={cn(
          'w-10 h-10 mx-auto mb-3',
          isDragging ? 'text-green-500' : 'text-gray-400'
        )} />

        <p className="text-sm font-medium text-gray-700">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Accepted: {acceptedExtensions.join(', ')} • Max {formatFileSize(maxFileSize)} per file • Up to {maxFiles} files
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Uploaded Files ({files.length}/{maxFiles})
            </span>
            <div className="flex items-center gap-3 text-xs">
              {successCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  {successCount} ready
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  {errorCount} failed
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {files.map(file => (
              <div
                key={file.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg border',
                  file.status === 'success' && 'bg-green-50 border-green-200',
                  file.status === 'error' && 'bg-red-50 border-red-200',
                  file.status === 'uploading' && 'bg-gray-50 border-gray-200'
                )}
              >
                <FileCode className={cn(
                  'w-5 h-5 flex-shrink-0',
                  file.status === 'success' && 'text-green-600',
                  file.status === 'error' && 'text-red-600',
                  file.status === 'uploading' && 'text-gray-400'
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  {file.status === 'uploading' && (
                    <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}

                  {file.error && (
                    <p className="text-xs text-red-600 mt-0.5">{file.error}</p>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileContent(file: File, onProgress: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
