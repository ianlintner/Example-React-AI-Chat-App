import React, { useState, useRef, useEffect } from 'react';
import type { AgentType } from '../types';

interface TestResult {
  id: string;
  timestamp: string;
  endpoint: string;
  request: unknown;
  response: unknown;
  success: boolean;
  executionTime: number;
  error?: string;
}

interface AgentTestRequest {
  message: string;
  conversationHistory: unknown[];
  userId: string;
}

interface ClassifierTestRequest {
  message: string;
}


const DeveloperTestBench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('agents');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [agents, setAgents] = useState<{ id: string; name: string; description: string }[]>([]);
  const [systemHealth, setSystemHealth] = useState<Record<string, unknown> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  const validAgentTypes: AgentType[] = [
    'general', 'joke', 'trivia', 'gif', 'account_support', 'billing_support',
    'website_support', 'operator_support', 'hold_agent', 'story_teller',
    'riddle_master', 'quote_master', 'game_host', 'music_guru'
  ];

  const fetchAgentsList = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/test-bench/agents/list`);
      const data = await response.json();
      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to fetch agents list:', error);
    }
  }, [API_BASE]);

  const fetchSystemHealth = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/test-bench/health`);
      const data = await response.json();
      if (data.success) {
        setSystemHealth(data.health);
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchAgentsList();
    fetchSystemHealth();
  }, [fetchAgentsList, fetchSystemHealth]);

  const executeRequest = async (endpoint: string, method: string = 'POST', data?: unknown) => {
    const startTime = Date.now();
    const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/test-bench${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      const testResult: TestResult = {
        id: testId,
        timestamp: new Date().toISOString(),
        endpoint,
        request: data,
        response: result,
        success: response.ok && result.success,
        executionTime,
        error: !response.ok || !result.success ? (result.error || result.details || 'Unknown error') : undefined
      };

      setTestResults(prev => [testResult, ...prev.slice(0, 49)]); // Keep last 50 results
      
      // Auto-scroll to latest result
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const testResult: TestResult = {
        id: testId,
        timestamp: new Date().toISOString(),
        endpoint,
        request: data,
        response: null,
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Network error'
      };

      setTestResults(prev => [testResult, ...prev.slice(0, 49)]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const exportResults = () => {
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `test-results-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const AgentTestPanel = () => {
    const [selectedAgent, setSelectedAgent] = useState<AgentType>('general');
    const [message, setMessage] = useState<string>('Hello, how are you doing today?');
    const [userId, setUserId] = useState<string>('test-user');

    const handleAgentTest = () => {
      const request: AgentTestRequest = {
        message,
        conversationHistory: [],
        userId
      };
      executeRequest(`/agent/${selectedAgent}/test`, 'POST', request);
    };

    const handleBulkTest = () => {
      const request = {
        message,
        agentTypes: validAgentTypes,
        userId
      };
      executeRequest('/bulk-test', 'POST', request);
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Agent Type:</label>
            <select 
              value={selectedAgent} 
              onChange={(e) => setSelectedAgent(e.target.value as AgentType)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              {validAgentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">User ID:</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="test-user"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Test Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="Enter your test message here..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAgentTest}
            disabled={isLoading || !message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Test Selected Agent
          </button>
          <button
            onClick={handleBulkTest}
            disabled={isLoading || !message.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Test All Agents
          </button>
        </div>
      </div>
    );
  };

  const ClassifierTestPanel = () => {
    const [message, setMessage] = useState<string>('Tell me a funny joke!');

    const handleClassifierTest = () => {
      const request: ClassifierTestRequest = { message };
      executeRequest('/classifier/test', 'POST', request);
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Message to Classify:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="Enter message to classify..."
          />
        </div>

        <button
          onClick={handleClassifierTest}
          disabled={isLoading || !message.trim()}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Classifier
        </button>
      </div>
    );
  };

  const SystemHealthPanel = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">System Health Status</h3>
        <button
          onClick={fetchSystemHealth}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          Refresh
        </button>
      </div>
      
      {systemHealth && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(systemHealth).map(([key, value]) => (
            <div key={key} className="p-3 bg-gray-50 rounded border">
              <div className="text-xs text-gray-600 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div className={`font-medium ${
                value === 'operational' || value === 'configured' ? 'text-green-600' : 
                value === 'missing' ? 'text-red-600' : 'text-gray-800'
              }`}>
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h4 className="font-medium mb-3">Available Agents ({agents.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map((agent) => (
            <div key={agent.id} className="p-3 bg-blue-50 rounded border">
              <div className="font-medium text-blue-800">{agent.name}</div>
              <div className="text-sm text-blue-600">{agent.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'agents', label: 'Agent Testing', component: AgentTestPanel },
    { id: 'classifier', label: 'Classifier', component: ClassifierTestPanel },
    { id: 'health', label: 'System Health', component: SystemHealthPanel }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || AgentTestPanel;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Developer Test Bench</h1>
        <p className="text-gray-600">Comprehensive testing interface for all agents and features</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-50 p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">{tabs.find(tab => tab.id === activeTab)?.label}</h2>
            <ActiveComponent />
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Test Results</h3>
              <div className="flex gap-2">
                <button
                  onClick={exportResults}
                  disabled={testResults.length === 0}
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                >
                  Export
                </button>
                <button
                  onClick={clearResults}
                  disabled={testResults.length === 0}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600">Running test...</span>
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto" ref={resultsRef}>
              {testResults.length === 0 && !isLoading && (
                <p className="text-gray-500 text-center py-4">No test results yet</p>
              )}
              
              {testResults.map((result) => (
                <div
                  key={result.id}
                  className={`p-3 rounded border text-sm ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                      {result.endpoint}
                    </span>
                    <span className="text-xs text-gray-500">
                      {result.executionTime}ms
                    </span>
                  </div>
                  
                  {result.error && (
                    <div className="text-red-600 text-xs mb-2">
                      Error: {result.error}
                    </div>
                  )}
                  
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600">View Details</summary>
                    <div className="mt-2 p-2 bg-gray-100 rounded">
                      <div className="mb-2">
                        <strong>Request:</strong>
                        <pre className="text-xs overflow-x-auto">{JSON.stringify(result.request, null, 2)}</pre>
                      </div>
                      <div>
                        <strong>Response:</strong>
                        <pre className="text-xs overflow-x-auto">{JSON.stringify(result.response, null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                  
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperTestBench;
