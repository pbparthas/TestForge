/**
 * useExecutionPolling Hook
 * Real-time polling for execution status updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export interface ExecutionStatus {
  id: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration?: number;
  };
  progress?: {
    current: number;
    total: number;
    currentTest?: string;
  };
  output?: string[];
  screenshots?: Array<{
    name: string;
    path: string;
    timestamp: string;
  }>;
  error?: string;
}

interface UseExecutionPollingOptions {
  /** Polling interval in milliseconds (default: 3000) */
  interval?: number;
  /** Auto-stop polling on completion */
  autoStop?: boolean;
  /** Callback when execution completes */
  onComplete?: (execution: ExecutionStatus) => void;
  /** Callback when execution fails */
  onError?: (error: Error) => void;
  /** Callback on each status update */
  onUpdate?: (execution: ExecutionStatus) => void;
}

interface UseExecutionPollingReturn {
  /** Current execution status */
  execution: ExecutionStatus | null;
  /** Whether polling is active */
  isPolling: boolean;
  /** Error if any */
  error: Error | null;
  /** Start polling for an execution */
  startPolling: (executionId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Reset state */
  reset: () => void;
}

export function useExecutionPolling(options: UseExecutionPollingOptions = {}): UseExecutionPollingReturn {
  const {
    interval = 3000,
    autoStop = true,
    onComplete,
    onError,
    onUpdate,
  } = options;

  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!executionIdRef.current || !mountedRef.current) return;

    try {
      const response = await api.get<{ data: ExecutionStatus }>(
        `/executions/${executionIdRef.current}`
      );
      const data = response.data.data || response.data;

      if (!mountedRef.current) return;

      setExecution(data as ExecutionStatus);
      setError(null);

      onUpdate?.(data as ExecutionStatus);

      // Check if execution is complete
      const status = (data as ExecutionStatus).status;
      if (['passed', 'failed', 'cancelled'].includes(status)) {
        if (autoStop) {
          stopPollingInternal();
        }
        if (status === 'passed' || status === 'failed') {
          onComplete?.(data as ExecutionStatus);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error('Failed to fetch execution status');
      setError(error);
      onError?.(error);
    }
  }, [autoStop, onComplete, onError, onUpdate]);

  const stopPollingInternal = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback((executionId: string) => {
    // Stop any existing polling
    stopPollingInternal();

    executionIdRef.current = executionId;
    setIsPolling(true);
    setError(null);
    setExecution(null);

    // Fetch immediately
    fetchStatus();

    // Start interval
    intervalRef.current = window.setInterval(fetchStatus, interval);
  }, [fetchStatus, interval, stopPollingInternal]);

  const stopPolling = useCallback(() => {
    stopPollingInternal();
    executionIdRef.current = null;
  }, [stopPollingInternal]);

  const reset = useCallback(() => {
    stopPolling();
    setExecution(null);
    setError(null);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPollingInternal();
    };
  }, [stopPollingInternal]);

  return {
    execution,
    isPolling,
    error,
    startPolling,
    stopPolling,
    reset,
  };
}

/**
 * Hook for multiple execution polling
 */
export function useMultiExecutionPolling(
  executionIds: string[],
  options: UseExecutionPollingOptions = {}
): {
  executions: Map<string, ExecutionStatus>;
  isPolling: boolean;
  errors: Map<string, Error>;
} {
  const [executions, setExecutions] = useState<Map<string, ExecutionStatus>>(new Map());
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const { interval = 3000, autoStop = true, onComplete, onUpdate } = options;

  const fetchAll = useCallback(async () => {
    if (!mountedRef.current || executionIds.length === 0) return;

    const newExecutions = new Map(executions);
    const newErrors = new Map(errors);

    await Promise.all(
      executionIds.map(async (id) => {
        try {
          const response = await api.get<{ data: ExecutionStatus }>(`/executions/${id}`);
          const data = response.data.data || response.data;
          newExecutions.set(id, data as ExecutionStatus);
          newErrors.delete(id);
          onUpdate?.(data as ExecutionStatus);

          const status = (data as ExecutionStatus).status;
          if (['passed', 'failed', 'cancelled'].includes(status)) {
            onComplete?.(data as ExecutionStatus);
          }
        } catch (err) {
          newErrors.set(id, err instanceof Error ? err : new Error('Failed to fetch'));
        }
      })
    );

    if (mountedRef.current) {
      setExecutions(newExecutions);
      setErrors(newErrors);

      // Auto-stop if all complete
      if (autoStop) {
        const allComplete = executionIds.every((id) => {
          const exec = newExecutions.get(id);
          return exec && ['passed', 'failed', 'cancelled'].includes(exec.status);
        });
        if (allComplete && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsPolling(false);
        }
      }
    }
  }, [executionIds, executions, errors, autoStop, onComplete, onUpdate]);

  useEffect(() => {
    if (executionIds.length === 0) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    fetchAll();

    intervalRef.current = window.setInterval(fetchAll, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [executionIds.join(','), interval]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { executions, isPolling, errors };
}
