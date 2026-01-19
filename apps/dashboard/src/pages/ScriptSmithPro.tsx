/**
 * ScriptSmith Pro Page
 * AI-powered automation script generation
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, Input } from '../components/ui';
import { Sparkles, Code, FileCode, Wand2 } from 'lucide-react';

export function ScriptSmithProPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ScriptSmith Pro</h1>
            <p className="text-sm text-gray-500">AI-powered test automation script generation</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'generate'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Generate Script
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'edit'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Edit Script
          </button>
        </nav>
      </div>

      {activeTab === 'generate' && <GeneratePanel projectId={currentProject.id} />}
      {activeTab === 'edit' && <EditPanel projectId={currentProject.id} />}
    </div>
  );
}

function GeneratePanel({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [framework, setFramework] = useState('playwright');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ script?: string } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      const stepsArray = steps.split('\n').filter(s => s.trim()).map((action, i) => ({
        order: i + 1,
        action: action.trim(),
      }));
      const response = await api.generateScript(projectId, { title, steps: stepsArray });
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Test Case Input">
        <div className="space-y-4">
          <Input
            label="Test Case Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., User Login Flow"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Framework
            </label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="playwright">Playwright</option>
              <option value="cypress">Cypress</option>
              <option value="selenium">Selenium</option>
              <option value="puppeteer">Puppeteer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Steps (one per line)
            </label>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="Navigate to login page&#10;Enter username 'testuser'&#10;Enter password&#10;Click login button&#10;Verify dashboard is displayed"
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleGenerate} isLoading={loading} className="w-full bg-purple-600 hover:bg-purple-700">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Script
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated Script">
        {result?.script ? (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[500px]">
              <pre className="text-sm text-green-400 font-mono">
                {result.script}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(result.script || '')}>
                Copy to Clipboard
              </Button>
              <Button variant="secondary">
                Save to Scripts
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated script will appear here</p>
            <p className="text-sm mt-1">Enter test steps and click Generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function EditPanel({ projectId: _projectId }: { projectId: string }) {
  const [script, setScript] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ editedScript?: string } | null>(null);

  const handleEdit = async () => {
    if (!script.trim() || !instruction.trim()) return;
    setLoading(true);
    try {
      // API call to edit script would go here
      setResult({ editedScript: script + '\n// Edited based on: ' + instruction });
    } catch (err) {
      console.error('Failed to edit script', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Original Script">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste your existing script
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="// Paste your test script here..."
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What would you like to change?
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., Add error handling, convert to async/await, add retry logic..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <Button onClick={handleEdit} isLoading={loading} className="w-full bg-purple-600 hover:bg-purple-700">
            <Wand2 className="w-4 h-4 mr-2" />
            Apply Changes
          </Button>
        </div>
      </Card>

      <Card title="Edited Script">
        {result?.editedScript ? (
          <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[400px]">
            <pre className="text-sm text-green-400 font-mono">
              {result.editedScript}
            </pre>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileCode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Edited script will appear here</p>
          </div>
        )}
      </Card>
    </div>
  );
}
