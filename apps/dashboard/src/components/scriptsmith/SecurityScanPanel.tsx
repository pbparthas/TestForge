/**
 * SecurityScanPanel Component
 * Displays security vulnerabilities found in scripts (Sentinel integration)
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cwe?: string;
  owasp?: string;
  line?: number;
  code?: string;
  remediation?: string;
  references?: string[];
}

interface SecurityScanPanelProps {
  vulnerabilities: Vulnerability[];
  loading?: boolean;
  scanStatus?: 'idle' | 'scanning' | 'complete' | 'error';
  lastScanTime?: string;
  onRescan?: () => void;
  onVulnerabilityClick?: (vuln: Vulnerability) => void;
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    text: 'text-red-800',
    badge: 'bg-red-600 text-white',
  },
  high: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-800',
    badge: 'bg-orange-500 text-white',
  },
  medium: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    text: 'text-yellow-800',
    badge: 'bg-yellow-500 text-white',
  },
  low: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-800',
    badge: 'bg-blue-500 text-white',
  },
};

export function SecurityScanPanel({
  vulnerabilities,
  loading = false,
  scanStatus = 'idle',
  lastScanTime,
  onRescan,
  onVulnerabilityClick,
}: SecurityScanPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const counts = {
    critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
    high: vulnerabilities.filter((v) => v.severity === 'high').length,
    medium: vulnerabilities.filter((v) => v.severity === 'medium').length,
    low: vulnerabilities.filter((v) => v.severity === 'low').length,
  };

  const filteredVulns = filter === 'all'
    ? vulnerabilities
    : vulnerabilities.filter((v) => v.severity === filter);

  const securityScore = vulnerabilities.length === 0
    ? 100
    : Math.max(0, 100 - (counts.critical * 25 + counts.high * 15 + counts.medium * 5 + counts.low * 2));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900">Security Scan</h3>
          </div>
          {onRescan && (
            <Button
              variant="secondary"
              onClick={onRescan}
              disabled={scanStatus === 'scanning'}
              className="text-xs py-1 px-3"
            >
              {scanStatus === 'scanning' ? (
                <>
                  <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Rescan
                </>
              )}
            </Button>
          )}
        </div>

        {/* Score & Summary */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className={`text-3xl font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}
            </p>
            <p className="text-xs text-gray-500">Security Score</p>
          </div>
          <div className="flex-1 grid grid-cols-4 gap-2">
            {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
              <button
                key={severity}
                onClick={() => setFilter(filter === severity ? 'all' : severity)}
                className={`p-2 rounded text-center transition-colors ${
                  filter === severity ? SEVERITY_STYLES[severity].bg : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className={`text-lg font-semibold ${SEVERITY_STYLES[severity].text}`}>
                  {counts[severity]}
                </p>
                <p className="text-xs text-gray-500 capitalize">{severity}</p>
              </button>
            ))}
          </div>
        </div>

        {lastScanTime && (
          <p className="text-xs text-gray-400 mt-2">
            Last scan: {new Date(lastScanTime).toLocaleString()}
          </p>
        )}
      </div>

      {/* Vulnerabilities List */}
      {loading || scanStatus === 'scanning' ? (
        <div className="p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-gray-500">Scanning for vulnerabilities...</p>
        </div>
      ) : filteredVulns.length === 0 ? (
        <div className="p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="font-medium text-green-600">No vulnerabilities found</p>
          <p className="text-sm text-gray-500 mt-1">Your code passed security checks</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
          {filteredVulns.map((vuln) => {
            const styles = SEVERITY_STYLES[vuln.severity];
            const isExpanded = expandedId === vuln.id;

            return (
              <div
                key={vuln.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                  isExpanded ? 'bg-gray-50' : ''
                }`}
                onClick={() => {
                  setExpandedId(isExpanded ? null : vuln.id);
                  onVulnerabilityClick?.(vuln);
                }}
              >
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-0.5 text-xs rounded font-medium ${styles.badge}`}>
                    {vuln.severity.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{vuln.title}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{vuln.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {vuln.cwe && (
                        <span className="text-xs text-gray-500 font-mono">{vuln.cwe}</span>
                      )}
                      {vuln.owasp && (
                        <span className="text-xs text-gray-500">{vuln.owasp}</span>
                      )}
                      {vuln.line && (
                        <span className="text-xs text-gray-400">Line {vuln.line}</span>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        {vuln.code && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Vulnerable Code</p>
                            <pre className="p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
                              {vuln.code}
                            </pre>
                          </div>
                        )}
                        {vuln.remediation && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Remediation</p>
                            <p className="text-sm text-gray-600 bg-green-50 p-2 rounded border border-green-200">
                              {vuln.remediation}
                            </p>
                          </div>
                        )}
                        {vuln.references && vuln.references.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">References</p>
                            <ul className="space-y-1">
                              {vuln.references.map((ref, i) => (
                                <li key={i}>
                                  <a
                                    href={ref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {ref}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
