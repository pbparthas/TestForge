/**
 * Dashboard Components
 */

// Charts
export { TestExecutionChart } from './TestExecutionChart';
export type { ExecutionDataPoint } from './TestExecutionChart';

export { CoverageDonutChart } from './CoverageDonutChart';
export type { CoverageData } from './CoverageDonutChart';

export { StatusBarChart } from './StatusBarChart';
export type { StatusData } from './StatusBarChart';

export { TrendLineChart } from './TrendLineChart';
export type { TrendDataPoint } from './TrendLineChart';

// Widgets
export { StatsCard } from './StatsCard';

export { ActivityFeed } from './ActivityFeed';
export type { Activity, ActivityType } from './ActivityFeed';

export { QuickActions } from './QuickActions';
export type { QuickAction } from './QuickActions';

export { RecentTests } from './RecentTests';
export type { RecentTest, TestResult } from './RecentTests';

// AI & Monitoring Widgets
export { AIActivityWidget } from './AIActivityWidget';
export { FlakyTestsWidget } from './FlakyTestsWidget';
export { SelfHealingWidget } from './SelfHealingWidget';
export { VisualRegressionWidget } from './VisualRegressionWidget';
