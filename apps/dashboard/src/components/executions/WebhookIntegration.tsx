/**
 * WebhookIntegration Component
 * Configure n8n webhook for execution notifications
 */

import { useState } from 'react';
import { Card, Button, Input } from '../ui';

interface WebhookIntegrationProps {
  webhookUrl: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function WebhookIntegration({
  webhookUrl,
  onChange,
  disabled = false,
}: WebhookIntegrationProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const testWebhook = async () => {
    if (!webhookUrl) return;

    setTestStatus('testing');
    setTestError(null);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          message: 'TestForge webhook test',
          source: 'TestForge',
        }),
      });

      if (response.ok) {
        setTestStatus('success');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Failed to test webhook');
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Webhook Notification</h4>
        <div className="flex items-center gap-2">
          {testStatus === 'success' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </span>
          )}
          {testStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              Failed
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Receive notifications via n8n, Zapier, or any webhook-compatible service when executions complete.
      </p>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={webhookUrl}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://your-n8n-instance.com/webhook/..."
              disabled={disabled}
              className="text-sm"
            />
          </div>
          <Button
            onClick={testWebhook}
            disabled={disabled || !webhookUrl || !isValidUrl(webhookUrl) || testStatus === 'testing'}
            variant="secondary"
            className="shrink-0"
          >
            {testStatus === 'testing' ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Testing
              </span>
            ) : (
              'Test'
            )}
          </Button>
        </div>

        {testError && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {testError}
          </div>
        )}

        {/* Webhook Events Info */}
        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Events sent to webhook
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            <pre className="text-xs text-gray-600 overflow-x-auto">
{`{
  "event": "execution_complete",
  "executionId": "abc-123",
  "projectId": "project-456",
  "status": "passed" | "failed",
  "summary": {
    "total": 10,
    "passed": 9,
    "failed": 1,
    "skipped": 0,
    "duration": 45000
  },
  "timestamp": "2026-02-02T12:00:00Z"
}`}
            </pre>
          </div>
        </details>
      </div>
    </Card>
  );
}
