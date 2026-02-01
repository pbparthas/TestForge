/**
 * ImportExportPanel Component
 * Import/Export functionality for test cases
 */

import { useState, useRef } from 'react';
import { cn } from '../../utils/cn';
import {
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  FileUp,
  ArrowRight,
} from 'lucide-react';

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'xml';

export interface ImportExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, format: ExportFormat) => Promise<ImportResult>;
  onExport: (format: ExportFormat, selectedIds?: string[]) => Promise<void>;
  selectedCount: number;
  totalCount: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

type TabType = 'import' | 'export';

const formatOptions: { value: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'json',
    label: 'JSON',
    icon: <FileJson className="w-5 h-5" />,
    description: 'Full data with all fields preserved',
  },
  {
    value: 'csv',
    label: 'CSV',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    description: 'Spreadsheet compatible format',
  },
  {
    value: 'xlsx',
    label: 'Excel',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    description: 'Microsoft Excel workbook',
  },
  {
    value: 'xml',
    label: 'XML',
    icon: <FileText className="w-5 h-5" />,
    description: 'Standard XML format',
  },
];

export function ImportExportPanel({
  isOpen,
  onClose,
  onImport,
  onExport,
  selectedCount,
  totalCount,
}: ImportExportPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [dragActive, setDragActive] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportComplete, setExportComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        handleFileSelect(file);
      }
    }
  };

  const handleFileSelect = (file: File) => {
    setImportFile(file);
    setImportResult(null);

    // Auto-detect format from extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'json') setSelectedFormat('json');
    else if (extension === 'csv') setSelectedFormat('csv');
    else if (extension === 'xlsx' || extension === 'xls') setSelectedFormat('xlsx');
    else if (extension === 'xml') setSelectedFormat('xml');
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsProcessing(true);
    try {
      const result = await onImport(importFile, selectedFormat);
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        imported: 0,
        failed: 0,
        errors: ['Import failed. Please check the file format.'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    setExportComplete(false);
    try {
      await onExport(selectedFormat, exportScope === 'selected' ? undefined : undefined);
      setExportComplete(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-white shadow-xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Import / Export</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex mt-4 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('import')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    activeTab === 'import'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    activeTab === 'export'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'import' && (
                <div className="space-y-6">
                  {/* Drop Zone */}
                  {!importFile && !importResult && (
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={cn(
                        'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
                        dragActive
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      )}
                    >
                      <FileUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Drop your file here, or{' '}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-gray-500">
                        Supports JSON, CSV, Excel, and XML files
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.csv,.xlsx,.xls,.xml"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            if (file) handleFileSelect(file);
                          }
                        }}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Selected File */}
                  {importFile && !importResult && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <FileJson className="w-8 h-8 text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {importFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(importFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={resetImport}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Format Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Import as
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {formatOptions.map(format => (
                            <button
                              key={format.value}
                              onClick={() => setSelectedFormat(format.value)}
                              className={cn(
                                'flex items-center gap-2 p-3 rounded-lg border transition-all text-left',
                                selectedFormat === format.value
                                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                                  : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <span className="text-gray-500">{format.icon}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {format.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Import Button */}
                      <button
                        onClick={handleImport}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Import Test Cases
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Import Result */}
                  {importResult && (
                    <div className="space-y-4">
                      <div
                        className={cn(
                          'p-4 rounded-lg',
                          importResult.success ? 'bg-green-50' : 'bg-red-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {importResult.success ? (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                          ) : (
                            <AlertCircle className="w-8 h-8 text-red-500" />
                          )}
                          <div>
                            <p
                              className={cn(
                                'font-medium',
                                importResult.success ? 'text-green-700' : 'text-red-700'
                              )}
                            >
                              {importResult.success ? 'Import Successful' : 'Import Failed'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {importResult.imported} imported, {importResult.failed} failed
                            </p>
                          </div>
                        </div>
                      </div>

                      {importResult.errors.length > 0 && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {importResult.errors.map((error, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-500">•</span>
                                {error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={resetImport}
                        className="w-full px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Import Another File
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'export' && (
                <div className="space-y-6">
                  {/* Export Scope */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What to export
                    </label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setExportScope('all')}
                        className={cn(
                          'w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left',
                          exportScope === 'all'
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">All Test Cases</p>
                          <p className="text-xs text-gray-500">{totalCount} test cases</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setExportScope('selected')}
                        disabled={selectedCount === 0}
                        className={cn(
                          'w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left',
                          exportScope === 'selected'
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : selectedCount === 0
                            ? 'border-gray-200 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">Selected Only</p>
                          <p className="text-xs text-gray-500">
                            {selectedCount === 0
                              ? 'No test cases selected'
                              : `${selectedCount} test cases selected`}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Export format
                    </label>
                    <div className="space-y-2">
                      {formatOptions.map(format => (
                        <button
                          key={format.value}
                          onClick={() => setSelectedFormat(format.value)}
                          className={cn(
                            'w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left',
                            selectedFormat === format.value
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <span className="text-gray-500">{format.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{format.label}</p>
                            <p className="text-xs text-gray-500">{format.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    disabled={isProcessing || (exportScope === 'selected' && selectedCount === 0)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export {exportScope === 'all' ? totalCount : selectedCount} Test Cases
                      </>
                    )}
                  </button>

                  {/* Export Complete */}
                  {exportComplete && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-green-700">Export Complete</p>
                          <p className="text-xs text-gray-600">
                            Your file has been downloaded
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                {activeTab === 'import'
                  ? 'Import test cases from external files. Duplicates will be skipped.'
                  : 'Export test cases for backup or sharing with other tools.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
