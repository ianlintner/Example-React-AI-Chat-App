import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface ValidationStats {
  totalValidations: number;
  averageScore: number;
  validationRate: number;
  issueBreakdown: { [key: string]: number };
}

interface ValidationLog {
  id: string;
  timestamp: Date;
  agentType: string;
  userMessage: string;
  aiResponse: string;
  validationResult: {
    isValid: boolean;
    score: number;
    issues: Array<{
      type: string;
      severity: string;
      message: string;
      suggestion?: string;
    }>;
    metrics: {
      responseLength: number;
      sentenceCount: number;
      readabilityScore: number;
      technicalAccuracy: number;
      appropriatenessScore: number;
      coherenceScore: number;
    };
  };
  conversationId: string;
  userId: string;
  isProactive: boolean;
}

interface ValidationSummary {
  [agentType: string]: {
    total: number;
    valid: number;
    invalid: number;
    averageScore: number;
    validationRate: number;
    issues: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

const ValidationDashboard: React.FC = () => {
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch validation data
  const fetchValidationData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, logsResponse, summaryResponse] = await Promise.all([
        api.get('/api/validation/stats'),
        api.get('/api/validation/logs?limit=50'),
        api.get('/api/validation/summary')
      ]);

      setStats(statsResponse.data.data);
      setLogs(logsResponse.data.data.logs);
      setSummary(summaryResponse.data.data);
    } catch (err) {
      setError('Failed to fetch validation data');
      console.error('Error fetching validation data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch filtered logs
  const fetchFilteredLogs = useCallback(async () => {
    try {
      let endpoint = '/api/validation/logs?limit=50';
      
      if (showFailedOnly) {
        endpoint = '/api/validation/failed?limit=50';
      } else if (selectedAgent !== 'all') {
        endpoint = `/api/validation/logs/${selectedAgent}?limit=50`;
      }

      const response = await api.get(endpoint);
      setLogs(response.data.data.logs);
    } catch (err) {
      console.error('Error fetching filtered logs:', err);
    }
  }, [selectedAgent, showFailedOnly]);

  // Clear validation logs
  const clearLogs = async () => {
    try {
      await api.post('/api/validation/clear');
      await fetchValidationData();
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  useEffect(() => {
    fetchValidationData();
    const interval = setInterval(fetchValidationData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchFilteredLogs();
    }
  }, [selectedAgent, showFailedOnly, loading, fetchFilteredLogs]);

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.6) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getAgentColor = (agentType: string): string => {
    const colors: { [key: string]: string } = {
      'technical': '#3b82f6',
      'dad_joke': '#f59e0b',
      'trivia': '#8b5cf6',
      'general': '#6b7280',
      'gif': '#ec4899'
    };
    return colors[agentType] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Response Validation Dashboard</h1>
        <p className="mt-2 text-gray-600">Monitor and analyze AI response quality in real-time</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Validations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalValidations}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <span className="text-green-600 font-semibold">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{(stats.validationRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">⭐</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageScore.toFixed(3)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <span className="text-red-600 font-semibold">⚠️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Issues</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(stats.issueBreakdown).reduce((a, b) => a + b, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Performance Summary */}
      {summary && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Agent Performance Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(summary).map(([agentType, data]) => (
                <div key={agentType} className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div 
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: getAgentColor(agentType) }}
                    ></div>
                    <h3 className="font-semibold text-gray-900 capitalize">{agentType}</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">{data.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Success Rate:</span>
                      <span className="font-medium">{(data.validationRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Avg Score:</span>
                      <span className="font-medium">{data.averageScore.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Issues:</span>
                      <span className="font-medium text-red-600">{data.issues.high}</span>
                      <span className="font-medium text-yellow-600">{data.issues.medium}</span>
                      <span className="font-medium text-gray-600">{data.issues.low}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Validation Logs</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent Type</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Agents</option>
                <option value="technical">Technical</option>
                <option value="dad_joke">Dad Joke</option>
                <option value="trivia">Trivia</option>
                <option value="general">General</option>
                <option value="gif">GIF</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showFailedOnly}
                  onChange={(e) => setShowFailedOnly(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Failed validations only</span>
              </label>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchValidationData}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 mr-2"
              >
                Refresh
              </button>
              <button
                onClick={clearLogs}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Clear Logs
              </button>
            </div>
          </div>

          {/* Validation Logs Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issues
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: getAgentColor(log.agentType) }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {log.agentType}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="text-sm font-medium"
                        style={{ color: getScoreColor(log.validationResult.score) }}
                      >
                        {log.validationResult.score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.validationResult.isValid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.validationResult.isValid ? 'Valid' : 'Invalid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-1">
                        {log.validationResult.issues.map((issue, index) => (
                          <span
                            key={index}
                            className="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                            style={{ 
                              backgroundColor: `${getSeverityColor(issue.severity)}20`,
                              color: getSeverityColor(issue.severity)
                            }}
                            title={issue.message}
                          >
                            {issue.severity}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.isProactive 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {log.isProactive ? 'Proactive' : 'Regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No validation logs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationDashboard;
