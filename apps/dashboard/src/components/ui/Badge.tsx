/**
 * Badge Component
 */

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    passed: { variant: 'success', label: 'Passed' },
    failed: { variant: 'danger', label: 'Failed' },
    skipped: { variant: 'warning', label: 'Skipped' },
    pending: { variant: 'default', label: 'Pending' },
    running: { variant: 'info', label: 'Running' },
    open: { variant: 'danger', label: 'Open' },
    in_progress: { variant: 'warning', label: 'In Progress' },
    resolved: { variant: 'success', label: 'Resolved' },
    closed: { variant: 'default', label: 'Closed' },
    draft: { variant: 'default', label: 'Draft' },
    approved: { variant: 'success', label: 'Approved' },
    deprecated: { variant: 'warning', label: 'Deprecated' },
  };

  const config = statusMap[status] || { variant: 'default', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const priorityMap: Record<string, BadgeProps['variant']> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'default',
  };

  return <Badge variant={priorityMap[priority] || 'default'}>{priority}</Badge>;
}
