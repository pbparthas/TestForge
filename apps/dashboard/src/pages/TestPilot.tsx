/**
 * TestPilot Suite Dashboard Page
 * Multi-agent workflow orchestration for test automation
 */
import { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/project';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  Workflow,
  Play,
  History,
  Settings,
  AlertCircle,
  Check,
  Clock,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Copy,
  XCircle,
  Loader2,
  Filter,
  IndianRupee,
  Coins,
} from 'lucide-react';
type TabType = 'workflows' | 'execute' | 'history' | 'custom';
// Types for TestPilot
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type StepType = 'agent' | 'condition' | 'parallel' | 'sequential';
interface WorkflowAgent {
  id: string;
  name: string;
  type: string;
}
interface WorkflowStep {
  id: string;
  type: StepType;
  agentId?: string;
  agentName?: string;
  condition?: string;
  parallel?: string[];
  sequential?: string[];
  order: number;
}
interface Workflow {
  id: string;
  name: string;
  description: string;
  agents: WorkflowAgent[];
  steps: WorkflowStep[];
  isCustom: boolean;
  createdAt: string;
  estimatedCost?: {
    usd: number;
    inr: number;
    tokens: number;
  };
}
interface CostEstimate {
  usd: number;
  inr: number;
  tokens: number;
  breakdown: Array<{
    agentId: string;
    agentName: string;
    usd: number;
    inr: number;
    tokens: number;
  }>;
}
interface ExecutionStep {
  id: string;
  agentId: string;
  agentName: string;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}
interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  cost?: CostEstimate;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
// Status colors
const statusColors: Record<ExecutionStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  running: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};
const stepTypeColors: Record<StepType, string> = {
  agent: 'bg-purple-100 text-purple-700',
  condition: 'bg-yellow-100 text-yellow-700',
  parallel: 'bg-blue-100 text-blue-700',
  sequential: 'bg-green-100 text-green-700',
};
// Agent type colors
const agentColors: Record<string, string> = {
  testweaver: 'bg-purple-500',
  scriptsmith: 'bg-blue-500',
  codeguardian: 'bg-green-500',
  flowpilot: 'bg-orange-500',
  selfhealing: 'bg-red-500',
  visualtesting: 'bg-pink-500',
  bugpattern: 'bg-yellow-500',
  codeanalysis: 'bg-cyan-500',
  default: 'bg-gray-500',
};
export function TestPilotPage() {
  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('workflows');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const isAdmin = user?.role === 'admin';
  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TestPilot Suite</h1>
            <p className="text-sm text-gray-500">Multi-agent workflow orchestration for test automation</p>
          </div>
        </div>
      </div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'workflows'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Workflow className="w-4 h-4" />
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('execute')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'execute'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Play className="w-4 h-4" />
            Execute
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'custom'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Custom Workflows
            </button>
          )}
        </nav>
      </div>
      {activeTab === 'workflows' && (
        <WorkflowsPanel
          projectId={currentProject.id}
          onSelectWorkflow={(workflow) => {
            setSelectedWorkflow(workflow);
            setActiveTab('execute');
          }}
        />
      )}
      {activeTab === 'execute' && (
        <ExecutePanel
          projectId={currentProject.id}
          selectedWorkflow={selectedWorkflow}
          onWorkflowChange={setSelectedWorkflow}
        />
      )}
      {activeTab === 'history' && <HistoryPanel projectId={currentProject.id} />}
      {activeTab === 'custom' && isAdmin && <CustomWorkflowsPanel projectId={currentProject.id} />}
    </div>
  );
}
// ============================================================================
// Workflows Panel
// ============================================================================
function WorkflowsPanel({
  projectId,
  onSelectWorkflow,
}: {
  projectId: string;
  onSelectWorkflow: (workflow: Workflow) => void;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get<{ data: Workflow[] }>('/testpilot/workflows', { projectId });
        setWorkflows(response.data.data || getMockWorkflows());
      } catch (err) {
        console.error('Failed to fetch workflows:', err);
        // Use mock data for development
        setWorkflows(getMockWorkflows());
      } finally {
        setLoading(false);
      }
    };
    fetchWorkflows();
  }, [projectId]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-red-600">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onSelect={() => onSelectWorkflow(workflow)}
        />
      ))}
    </div>
  );
}
function WorkflowCard({
  workflow,
  onSelect,
}: {
  workflow: Workflow;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
          </div>
          {workflow.isCustom && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              Custom
            </span>
          )}
        </div>
        {/* Agent Badges */}
        <div className="flex flex-wrap gap-2">
          {workflow.agents.map((agent) => (
            <AgentBadge key={agent.id} agent={agent} />
          ))}
        </div>
        {/* Expandable Steps */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {workflow.steps.length} steps
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {workflow.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${stepTypeColors[step.type]}`}>
                    {step.type}
                  </span>
                  <span className="text-gray-600">{step.agentName || step.condition || 'Multiple agents'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Estimated Cost */}
        {workflow.estimatedCost && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${workflow.estimatedCost.usd.toFixed(2)}
            </span>
            <span className="flex items-center gap-1">
              <IndianRupee className="w-3 h-3" />
              {workflow.estimatedCost.inr.toFixed(2)}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {workflow.estimatedCost.tokens.toLocaleString()} tokens
            </span>
          </div>
        )}
        <Button
          onClick={onSelect}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          <Play className="w-4 h-4 mr-2" />
          Execute Workflow
        </Button>
      </div>
    </Card>
  );
}
function AgentBadge({ agent }: { agent: WorkflowAgent }) {
  const colorClass = agentColors[agent.type.toLowerCase()] || agentColors.default;
  return (
    <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${colorClass}`} />
      {agent.name}
    </span>
  );
}
// ============================================================================
// Execute Panel
// ============================================================================
function ExecutePanel({
  projectId,
  selectedWorkflow,
  onWorkflowChange,
}: {
  projectId: string;
  selectedWorkflow: Workflow | null;
  onWorkflowChange: (workflow: Workflow | null) => void;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'natural_language' | 'json'>('natural_language');
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  // Fetch workflows for selector
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await api.get<{ data: Workflow[] }>('/testpilot/workflows', { projectId });
        setWorkflows(response.data.data || getMockWorkflows());
      } catch {
        setWorkflows(getMockWorkflows());
      }
    };
    fetchWorkflows();
  }, [projectId]);
  // Poll execution status
  useEffect(() => {
    if (!execution || execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const response = await api.get<{ data: Execution }>(`/testpilot/executions/${execution.id}`);
        setExecution(response.data.data);
      } catch {
        // Continue polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [execution]);
  const handleEstimate = async () => {
    if (!selectedWorkflow || !input.trim()) {
      setError('Please select a workflow and provide input');
      return;
    }
    setEstimating(true);
    setError('');
    setCostEstimate(null);
    try {
      const response = await api.post<{ data: CostEstimate }>('/testpilot/estimate', {
        workflowId: selectedWorkflow.id,
        input: {
          projectId,
          ...(inputType === 'json' ? JSON.parse(input) : { specification: input }),
        },
      });
      setCostEstimate(response.data.data);
    } catch (err) {
      // Mock estimate for development
      setCostEstimate({
        usd: 0.15,
        inr: 12.45,
        tokens: 15000,
        breakdown: selectedWorkflow.agents.map((agent) => ({
          agentId: agent.id,
          agentName: agent.name,
          usd: 0.05,
          inr: 4.15,
          tokens: 5000,
        })),
      });
    } finally {
      setEstimating(false);
    }
  };
  const handleExecute = async () => {
    if (!selectedWorkflow || !input.trim()) {
      setError('Please select a workflow and provide input');
      return;
    }
    setLoading(true);
    setError('');
    setExecution(null);
    try {
      const response = await api.post<{ data: Execution }>('/testpilot/execute', {
        workflowId: selectedWorkflow.id,
        input: {
          projectId,
          ...(inputType === 'json' ? JSON.parse(input) : { specification: input }),
        },
      });
      setExecution(response.data.data);
    } catch (err) {
      // Mock execution for development
      setExecution(getMockExecution(selectedWorkflow));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Execute Workflow">
        <div className="space-y-4">
          {/* Workflow Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Workflow
            </label>
            <select
              value={selectedWorkflow?.id || ''}
              onChange={(e) => {
                const workflow = workflows.find((w) => w.id === e.target.value);
                onWorkflowChange(workflow || null);
                setCostEstimate(null);
                setExecution(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select a workflow --</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          {/* Selected Workflow Info */}
          {selectedWorkflow && (
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-sm font-medium text-indigo-900">{selectedWorkflow.name}</p>
              <p className="text-xs text-indigo-700 mt-1">{selectedWorkflow.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedWorkflow.agents.map((agent) => (
                  <AgentBadge key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          )}
          {/* Input Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setInputType('natural_language')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                inputType === 'natural_language'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Natural Language
            </button>
            <button
              onClick={() => setInputType('json')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                inputType === 'json'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              JSON Input
            </button>
          </div>
          {/* Input Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {inputType === 'natural_language' ? 'Describe what you want to test' : 'JSON Input'}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                inputType === 'natural_language'
                  ? 'e.g., Generate comprehensive tests for the user authentication flow including login, logout, password reset, and session management'
                  : '{\n  "specification": "...",\n  "options": {}\n}'
              }
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {/* Cost Estimate */}
          {costEstimate && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-2">Cost Estimate</p>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-xl font-bold text-green-700">${costEstimate.usd.toFixed(2)}</p>
                  <p className="text-xs text-green-600">USD</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-700">{costEstimate.inr.toFixed(2)}</p>
                  <p className="text-xs text-green-600">INR</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-700">{costEstimate.tokens.toLocaleString()}</p>
                  <p className="text-xs text-green-600">Tokens</p>
                </div>
              </div>
              <div className="space-y-1">
                {costEstimate.breakdown.map((item) => (
                  <div key={item.agentId} className="flex items-center justify-between text-xs">
                    <span className="text-green-700">{item.agentName}</span>
                    <span className="text-green-600">
                      ${item.usd.toFixed(2)} / {item.tokens.toLocaleString()} tokens
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleEstimate}
              isLoading={estimating}
              disabled={!selectedWorkflow || !input.trim()}
              variant="secondary"
              className="flex-1"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Estimate Cost
            </Button>
            <Button
              onClick={handleExecute}
              isLoading={loading}
              disabled={!selectedWorkflow || !input.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Execute
            </Button>
          </div>
        </div>
      </Card>
      {/* Execution Status Panel */}
      <Card title="Execution Status">
        {execution ? (
          <div className="space-y-4">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusBadge status={execution.status} />
                <span className="text-sm text-gray-500">
                  {execution.workflowName}
                </span>
              </div>
              {execution.status === 'running' && (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              )}
            </div>
            {/* Step Timeline */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Execution Steps</p>
              {execution.steps.map((step, index) => (
                <ExecutionStepItem key={step.id} step={step} index={index} />
              ))}
            </div>
            {/* Error Message */}
            {execution.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{execution.error}</p>
              </div>
            )}
            {/* Cost Summary */}
            {execution.cost && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-2">Final Cost</p>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-900">
                    ${execution.cost.usd.toFixed(2)} USD
                  </span>
                  <span className="text-sm text-gray-600">
                    {execution.cost.inr.toFixed(2)} INR
                  </span>
                  <span className="text-sm text-gray-600">
                    {execution.cost.tokens.toLocaleString()} tokens
                  </span>
                </div>
              </div>
            )}
            {/* Output */}
            {execution.output && execution.status === 'completed' && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 uppercase">Output</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(execution.output, null, 2))}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                  {JSON.stringify(execution.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Execution status will appear here</p>
            <p className="text-sm mt-1">Select a workflow and execute</p>
          </div>
        )}
      </Card>
    </div>
  );
}
function StatusBadge({ status }: { status: ExecutionStatus }) {
  const icons: Record<ExecutionStatus, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <Check className="w-3 h-3" />,
    failed: <XCircle className="w-3 h-3" />,
    cancelled: <XCircle className="w-3 h-3" />,
  };
  return (
    <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${statusColors[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
}
function ExecutionStepItem({ step, index }: { step: ExecutionStep; index: number }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
            step.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : step.status === 'running'
              ? 'bg-blue-100 text-blue-700'
              : step.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {step.status === 'running' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : step.status === 'completed' ? (
            <Check className="w-4 h-4" />
          ) : step.status === 'failed' ? (
            <XCircle className="w-4 h-4" />
          ) : (
            index + 1
          )}
        </div>
        {index < 3 && <div className="w-0.5 h-6 bg-gray-200 mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{step.agentName}</span>
          <StatusBadge status={step.status} />
        </div>
        {step.error && (
          <p className="text-xs text-red-600 mt-1">{step.error}</p>
        )}
        {step.completedAt && (
          <p className="text-xs text-gray-500 mt-1">
            Completed in {calculateDuration(step.startedAt, step.completedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
// ============================================================================
// History Panel
// ============================================================================
function HistoryPanel({ projectId }: { projectId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  useEffect(() => {
    const fetchExecutions = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get<{ data: Execution[] }>('/testpilot/executions', {
          projectId,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });
        setExecutions(response.data.data || getMockExecutions());
      } catch {
        setExecutions(getMockExecutions());
      } finally {
        setLoading(false);
      }
    };
    fetchExecutions();
  }, [projectId, statusFilter]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Executions List */}
      <div className="lg:col-span-2 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filter:</span>
          <div className="flex gap-1">
            {(['all', 'completed', 'failed', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        {/* Execution List */}
        <Card>
          {executions.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  onClick={() => setSelectedExecution(execution)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedExecution?.id === execution.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {execution.workflowName}
                    </span>
                    <StatusBadge status={execution.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatDate(execution.startedAt)}</span>
                    {execution.completedAt && (
                      <span>Duration: {calculateDuration(execution.startedAt, execution.completedAt)}</span>
                    )}
                    {execution.cost && (
                      <span>${execution.cost.usd.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No executions found</p>
            </div>
          )}
        </Card>
      </div>
      {/* Execution Details */}
      <div>
        <Card title="Execution Details">
          {selectedExecution ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">Workflow</p>
                <p className="text-sm font-medium">{selectedExecution.workflowName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={selectedExecution.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Started</p>
                <p className="text-sm">{formatDate(selectedExecution.startedAt)}</p>
              </div>
              {selectedExecution.completedAt && (
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm">
                    {calculateDuration(selectedExecution.startedAt, selectedExecution.completedAt)}
                  </p>
                </div>
              )}
              {selectedExecution.cost && (
                <div>
                  <p className="text-xs text-gray-500">Cost</p>
                  <p className="text-sm">
                    ${selectedExecution.cost.usd.toFixed(2)} / {selectedExecution.cost.tokens.toLocaleString()} tokens
                  </p>
                </div>
              )}
              {selectedExecution.error && (
                <div>
                  <p className="text-xs text-gray-500">Error</p>
                  <p className="text-sm text-red-600">{selectedExecution.error}</p>
                </div>
              )}
              {/* Steps Summary */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Steps</p>
                <div className="space-y-1">
                  {selectedExecution.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-gray-400">{i + 1}.</span>
                      <span className="flex-1">{step.agentName}</span>
                      <StatusBadge status={step.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Select an execution to view details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
// ============================================================================
// Custom Workflows Panel (Admin Only)
// ============================================================================
function CustomWorkflowsPanel({ projectId }: { projectId: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    steps: [] as WorkflowStep[],
  });
  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ data: Workflow[] }>('/testpilot/workflows', { projectId, custom: true });
        setWorkflows((response.data.data || getMockWorkflows()).filter((w) => w.isCustom));
      } catch {
        setWorkflows(getMockWorkflows().filter((w) => w.isCustom));
      } finally {
        setLoading(false);
      }
    };
    fetchWorkflows();
  }, [projectId]);
  const handleAddStep = (type: StepType) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type,
      order: newWorkflow.steps.length + 1,
    };
    if (type === 'agent') {
      newStep.agentId = '';
      newStep.agentName = '';
    } else if (type === 'condition') {
      newStep.condition = '';
    } else if (type === 'parallel') {
      newStep.parallel = [];
    } else if (type === 'sequential') {
      newStep.sequential = [];
    }
    setNewWorkflow((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
  };
  const handleRemoveStep = (stepId: string) => {
    setNewWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }));
  };
  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/testpilot/workflows/${workflowId}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    } catch {
      // Mock delete
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    }
  };
  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim()) return;
    try {
      const response = await api.post<{ data: Workflow }>('/testpilot/workflows', {
        projectId,
        ...newWorkflow,
      });
      setWorkflows((prev) => [...prev, response.data.data]);
      setNewWorkflow({ name: '', description: '', steps: [] });
      setShowCreate(false);
    } catch {
      // Mock create
      const mockWorkflow: Workflow = {
        id: `workflow-${Date.now()}`,
        name: newWorkflow.name,
        description: newWorkflow.description,
        agents: [],
        steps: newWorkflow.steps,
        isCustom: true,
        createdAt: new Date().toISOString(),
      };
      setWorkflows((prev) => [...prev, mockWorkflow]);
      setNewWorkflow({ name: '', description: '', steps: [] });
      setShowCreate(false);
    }
  };
  const availableAgents = [
    { id: 'testweaver', name: 'TestWeaver', type: 'testweaver' },
    { id: 'scriptsmith', name: 'ScriptSmith', type: 'scriptsmith' },
    { id: 'codeguardian', name: 'CodeGuardian', type: 'codeguardian' },
    { id: 'flowpilot', name: 'FlowPilot', type: 'flowpilot' },
    { id: 'selfhealing', name: 'Self-Healing', type: 'selfhealing' },
    { id: 'visualtesting', name: 'Visual Testing', type: 'visualtesting' },
    { id: 'bugpattern', name: 'Bug Pattern', type: 'bugpattern' },
    { id: 'codeanalysis', name: 'Code Analysis', type: 'codeanalysis' },
  ];
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Custom Workflows</h2>
          <p className="text-sm text-gray-500">Create and manage custom multi-agent workflows</p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Workflow
        </Button>
      </div>
      {/* Create Form */}
      {showCreate && (
        <Card title="Create Custom Workflow">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Full Test Generation Pipeline"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this workflow does"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {/* Step Builder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Workflow Steps
                </label>
                <div className="flex gap-1">
                  {(['agent', 'condition', 'parallel', 'sequential'] as StepType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleAddStep(type)}
                      className={`px-2 py-1 rounded text-xs font-medium ${stepTypeColors[type]} hover:opacity-80`}
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 min-h-[100px] p-3 bg-gray-50 rounded-lg">
                {newWorkflow.steps.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Add steps to define your workflow
                  </p>
                ) : (
                  newWorkflow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                      <span className="w-6 h-6 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${stepTypeColors[step.type]}`}>
                        {step.type}
                      </span>
                      {step.type === 'agent' && (
                        <select
                          value={step.agentId || ''}
                          onChange={(e) => {
                            const agent = availableAgents.find((a) => a.id === e.target.value);
                            setNewWorkflow((prev) => ({
                              ...prev,
                              steps: prev.steps.map((s) =>
                                s.id === step.id
                                  ? { ...s, agentId: agent?.id, agentName: agent?.name }
                                  : s
                              ),
                            }));
                          }}
                          className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs"
                        >
                          <option value="">Select agent</option>
                          {availableAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {step.type === 'condition' && (
                        <input
                          type="text"
                          value={step.condition || ''}
                          onChange={(e) =>
                            setNewWorkflow((prev) => ({
                              ...prev,
                              steps: prev.steps.map((s) =>
                                s.id === step.id ? { ...s, condition: e.target.value } : s
                              ),
                            }))
                          }
                          placeholder="e.g., tests.length > 0"
                          className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs"
                        />
                      )}
                      <button
                        onClick={() => handleRemoveStep(step.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkflow}
                disabled={!newWorkflow.name.trim()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Create Workflow
              </Button>
            </div>
          </div>
        </Card>
      )}
      {/* Custom Workflows List */}
      {workflows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="relative">
              <button
                onClick={() => handleDeleteWorkflow(workflow.id)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                  <p className="text-sm text-gray-500">{workflow.description}</p>
                </div>
                <div className="text-xs text-gray-500">
                  Created {formatDate(workflow.createdAt)}
                </div>
                <div className="space-y-1">
                  {workflow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-gray-400">{index + 1}.</span>
                      <span className={`px-1.5 py-0.5 rounded ${stepTypeColors[step.type]}`}>
                        {step.type}
                      </span>
                      <span className="text-gray-600">{step.agentName || step.condition || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No custom workflows yet</p>
            <p className="text-sm mt-1">Create your first custom workflow above</p>
          </div>
        </Card>
      )}
    </div>
  );
}
// ============================================================================
// Helper Functions
// ============================================================================
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function calculateDuration(start?: string, end?: string): string {
  if (!start || !end) return '-';
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const diff = endTime - startTime;
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}
// Mock Data Functions
function getMockWorkflows(): Workflow[] {
  return [
    {
      id: 'wf-1',
      name: 'Full Test Generation',
      description: 'Generate test cases, scripts, and validate with code analysis',
      agents: [
        { id: 'testweaver', name: 'TestWeaver', type: 'testweaver' },
        { id: 'scriptsmith', name: 'ScriptSmith', type: 'scriptsmith' },
        { id: 'codeanalysis', name: 'Code Analysis', type: 'codeanalysis' },
      ],
      steps: [
        { id: 's1', type: 'agent', agentId: 'testweaver', agentName: 'TestWeaver', order: 1 },
        { id: 's2', type: 'agent', agentId: 'scriptsmith', agentName: 'ScriptSmith', order: 2 },
        { id: 's3', type: 'agent', agentId: 'codeanalysis', agentName: 'Code Analysis', order: 3 },
      ],
      isCustom: false,
      createdAt: '2024-01-15T10:00:00Z',
      estimatedCost: { usd: 0.25, inr: 20.75, tokens: 25000 },
    },
    {
      id: 'wf-2',
      name: 'API Testing Pipeline',
      description: 'Generate and validate API tests with FlowPilot',
      agents: [
        { id: 'flowpilot', name: 'FlowPilot', type: 'flowpilot' },
        { id: 'codeguardian', name: 'CodeGuardian', type: 'codeguardian' },
      ],
      steps: [
        { id: 's1', type: 'agent', agentId: 'flowpilot', agentName: 'FlowPilot', order: 1 },
        { id: 's2', type: 'agent', agentId: 'codeguardian', agentName: 'CodeGuardian', order: 2 },
      ],
      isCustom: false,
      createdAt: '2024-01-15T10:00:00Z',
      estimatedCost: { usd: 0.18, inr: 14.94, tokens: 18000 },
    },
    {
      id: 'wf-3',
      name: 'Self-Healing Test Suite',
      description: 'Analyze failures and auto-fix locators',
      agents: [
        { id: 'selfhealing', name: 'Self-Healing', type: 'selfhealing' },
        { id: 'bugpattern', name: 'Bug Pattern', type: 'bugpattern' },
      ],
      steps: [
        { id: 's1', type: 'agent', agentId: 'selfhealing', agentName: 'Self-Healing', order: 1 },
        { id: 's2', type: 'condition', condition: 'fixes.length > 0', order: 2 },
        { id: 's3', type: 'agent', agentId: 'bugpattern', agentName: 'Bug Pattern', order: 3 },
      ],
      isCustom: false,
      createdAt: '2024-01-15T10:00:00Z',
      estimatedCost: { usd: 0.12, inr: 9.96, tokens: 12000 },
    },
    {
      id: 'wf-4',
      name: 'Visual Regression Pipeline',
      description: 'Run visual tests and analyze differences',
      agents: [
        { id: 'visualtesting', name: 'Visual Testing', type: 'visualtesting' },
        { id: 'bugpattern', name: 'Bug Pattern', type: 'bugpattern' },
      ],
      steps: [
        { id: 's1', type: 'agent', agentId: 'visualtesting', agentName: 'Visual Testing', order: 1 },
        { id: 's2', type: 'agent', agentId: 'bugpattern', agentName: 'Bug Pattern', order: 2 },
      ],
      isCustom: false,
      createdAt: '2024-01-15T10:00:00Z',
      estimatedCost: { usd: 0.20, inr: 16.60, tokens: 20000 },
    },
    {
      id: 'wf-5',
      name: 'My Custom Pipeline',
      description: 'Custom workflow with conditional logic',
      agents: [
        { id: 'testweaver', name: 'TestWeaver', type: 'testweaver' },
        { id: 'scriptsmith', name: 'ScriptSmith', type: 'scriptsmith' },
      ],
      steps: [
        { id: 's1', type: 'agent', agentId: 'testweaver', agentName: 'TestWeaver', order: 1 },
        { id: 's2', type: 'condition', condition: 'tests.length > 0', order: 2 },
        { id: 's3', type: 'agent', agentId: 'scriptsmith', agentName: 'ScriptSmith', order: 3 },
      ],
      isCustom: true,
      createdAt: '2024-01-20T14:30:00Z',
      estimatedCost: { usd: 0.15, inr: 12.45, tokens: 15000 },
    },
  ];
}
function getMockExecution(workflow: Workflow): Execution {
  return {
    id: `exec-${Date.now()}`,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'running',
    steps: workflow.steps.map((step, index) => ({
      id: `step-${index}`,
      agentId: step.agentId || '',
      agentName: step.agentName || step.type,
      status: index === 0 ? 'running' : 'pending',
      startedAt: index === 0 ? new Date().toISOString() : undefined,
    })),
    input: { specification: 'Mock input' },
    startedAt: new Date().toISOString(),
  };
}
function getMockExecutions(): Execution[] {
  return [
    {
      id: 'exec-1',
      workflowId: 'wf-1',
      workflowName: 'Full Test Generation',
      status: 'completed',
      steps: [
        { id: 's1', agentId: 'testweaver', agentName: 'TestWeaver', status: 'completed', startedAt: '2024-01-20T10:00:00Z', completedAt: '2024-01-20T10:01:30Z' },
        { id: 's2', agentId: 'scriptsmith', agentName: 'ScriptSmith', status: 'completed', startedAt: '2024-01-20T10:01:30Z', completedAt: '2024-01-20T10:03:00Z' },
        { id: 's3', agentId: 'codeanalysis', agentName: 'Code Analysis', status: 'completed', startedAt: '2024-01-20T10:03:00Z', completedAt: '2024-01-20T10:04:00Z' },
      ],
      input: { specification: 'User authentication flow tests' },
      output: { testsGenerated: 12, scriptsGenerated: 12, issuesFound: 2 },
      cost: { usd: 0.24, inr: 19.92, tokens: 24000, breakdown: [] },
      startedAt: '2024-01-20T10:00:00Z',
      completedAt: '2024-01-20T10:04:00Z',
    },
    {
      id: 'exec-2',
      workflowId: 'wf-2',
      workflowName: 'API Testing Pipeline',
      status: 'failed',
      steps: [
        { id: 's1', agentId: 'flowpilot', agentName: 'FlowPilot', status: 'completed', startedAt: '2024-01-19T14:00:00Z', completedAt: '2024-01-19T14:02:00Z' },
        { id: 's2', agentId: 'codeguardian', agentName: 'CodeGuardian', status: 'failed', startedAt: '2024-01-19T14:02:00Z', completedAt: '2024-01-19T14:02:30Z', error: 'Rate limit exceeded' },
      ],
      input: { openApiSpec: 'https://api.example.com/spec.json' },
      cost: { usd: 0.08, inr: 6.64, tokens: 8000, breakdown: [] },
      startedAt: '2024-01-19T14:00:00Z',
      completedAt: '2024-01-19T14:02:30Z',
      error: 'CodeGuardian agent failed: Rate limit exceeded',
    },
    {
      id: 'exec-3',
      workflowId: 'wf-3',
      workflowName: 'Self-Healing Test Suite',
      status: 'completed',
      steps: [
        { id: 's1', agentId: 'selfhealing', agentName: 'Self-Healing', status: 'completed', startedAt: '2024-01-18T09:00:00Z', completedAt: '2024-01-18T09:01:00Z' },
        { id: 's2', agentId: 'bugpattern', agentName: 'Bug Pattern', status: 'completed', startedAt: '2024-01-18T09:01:00Z', completedAt: '2024-01-18T09:02:30Z' },
      ],
      input: { testCaseId: 'tc-123', errorMessage: 'Element not found' },
      output: { locatorsFixed: 3, patternsDetected: 1 },
      cost: { usd: 0.11, inr: 9.13, tokens: 11000, breakdown: [] },
      startedAt: '2024-01-18T09:00:00Z',
      completedAt: '2024-01-18T09:02:30Z',
    },
  ];
}
