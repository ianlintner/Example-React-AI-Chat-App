import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

const ValidationDashboard: React.FC = () => {
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API helper function
  const apiCall = async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  // Fetch validation data
  const fetchValidationData = async () => {
    try {
      setError(null);

      const [statsResponse, logsResponse, summaryResponse] = await Promise.all([
        apiCall('/api/validation/stats'),
        apiCall('/api/validation/logs?limit=50'),
        apiCall('/api/validation/summary'),
      ]);

      setStats(statsResponse.data);
      setLogs(logsResponse.data.logs);
      setSummary(summaryResponse.data);
    } catch (err) {
      setError('Failed to fetch validation data');
      console.error('Error fetching validation data:', err);
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

      const response = await apiCall(endpoint);
      setLogs(response.data.logs);
    } catch (err) {
      console.error('Error fetching filtered logs:', err);
    }
  }, [selectedAgent, showFailedOnly]);

  // Clear validation logs
  const clearLogs = async () => {
    Alert.alert(
      'Clear Validation Logs',
      'Are you sure you want to clear all validation logs? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_BASE_URL}/api/validation/clear`, {
                method: 'POST',
              });
              await fetchValidationData();
            } catch (err) {
              console.error('Error clearing logs:', err);
              Alert.alert('Error', 'Failed to clear validation logs');
            }
          },
        },
      ],
    );
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchValidationData();
      setLoading(false);
    };

    loadData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load filtered logs when filters change
  useEffect(() => {
    if (!loading) {
      fetchFilteredLogs();
    }
  }, [selectedAgent, showFailedOnly, loading, fetchFilteredLogs]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchValidationData();
    setRefreshing(false);
  };

  // Helper functions
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.6) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getAgentColor = (agentType: string): string => {
    const colors: { [key: string]: string } = {
      technical: '#3b82f6',
      dad_joke: '#f59e0b',
      trivia: '#8b5cf6',
      general: '#6b7280',
      gif: '#ec4899',
    };
    return colors[agentType] || '#6b7280';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color='#3b82f6' />
        <Text style={styles.loadingText}>Loading validation data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchValidationData().finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Response Validation</Text>
        <Text style={styles.headerSubtitle}>Monitor and analyze AI response quality</Text>
      </View>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📊</Text>
            <Text style={styles.statLabel}>Total Validations</Text>
            <Text style={styles.statValue}>{stats.totalValidations}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
            <Text style={styles.statValue}>{(stats.validationRate * 100).toFixed(1)}%</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statLabel}>Average Score</Text>
            <Text style={styles.statValue}>{stats.averageScore.toFixed(3)}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⚠️</Text>
            <Text style={styles.statLabel}>Total Issues</Text>
            <Text style={styles.statValue}>
              {Object.values(stats.issueBreakdown).reduce((a, b) => a + b, 0)}
            </Text>
          </View>
        </View>
      )}

      {/* Agent Performance Summary */}
      {summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agent Performance Summary</Text>
          <View style={styles.agentGrid}>
            {Object.entries(summary).map(([agentType, data]) => (
              <View key={agentType} style={styles.agentCard}>
                <View style={styles.agentHeader}>
                  <View
                    style={[styles.agentColorDot, { backgroundColor: getAgentColor(agentType) }]}
                  />
                  <Text style={styles.agentName}>{agentType}</Text>
                </View>
                <View style={styles.agentStats}>
                  <Text style={styles.agentStatText}>Total: {data.total}</Text>
                  <Text style={styles.agentStatText}>
                    Success: {(data.validationRate * 100).toFixed(1)}%
                  </Text>
                  <Text style={styles.agentStatText}>Score: {data.averageScore.toFixed(3)}</Text>
                  <View style={styles.issueRow}>
                    <Text style={[styles.issueText, { color: '#ef4444' }]}>{data.issues.high}</Text>
                    <Text style={[styles.issueText, { color: '#f59e0b' }]}>
                      {data.issues.medium}
                    </Text>
                    <Text style={[styles.issueText, { color: '#6b7280' }]}>{data.issues.low}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Validation Logs</Text>

        <View style={styles.controls}>
          <View style={styles.pickerContainer}>
            <Text style={styles.controlLabel}>Agent Type:</Text>
            <Picker
              selectedValue={selectedAgent}
              style={styles.picker}
              onValueChange={(value: string) => setSelectedAgent(value)}
            >
              <Picker.Item label='All Agents' value='all' />
              <Picker.Item label='Technical' value='technical' />
              <Picker.Item label='Dad Joke' value='dad_joke' />
              <Picker.Item label='Trivia' value='trivia' />
              <Picker.Item label='General' value='general' />
              <Picker.Item label='GIF' value='gif' />
            </Picker>
          </View>

          <TouchableOpacity
            style={[styles.toggleButton, showFailedOnly && styles.toggleButtonActive]}
            onPress={() => setShowFailedOnly(!showFailedOnly)}
          >
            <Text
              style={[styles.toggleButtonText, showFailedOnly && styles.toggleButtonTextActive]}
            >
              Failed Only
            </Text>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.buttonText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
              <Text style={styles.buttonText}>Clear Logs</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Validation Logs */}
        <View style={styles.logsList}>
          {logs.map(log => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Text style={styles.logTimestamp}>{formatTimestamp(log.timestamp)}</Text>
                <View style={styles.logAgent}>
                  <View
                    style={[
                      styles.agentColorDot,
                      { backgroundColor: getAgentColor(log.agentType) },
                    ]}
                  />
                  <Text style={styles.logAgentText}>{log.agentType}</Text>
                </View>
              </View>

              <View style={styles.logMetrics}>
                <Text
                  style={[styles.logScore, { color: getScoreColor(log.validationResult.score) }]}
                >
                  Score: {log.validationResult.score.toFixed(3)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: log.validationResult.isValid ? '#dcfce7' : '#fee2e2',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: log.validationResult.isValid ? '#166534' : '#dc2626',
                      },
                    ]}
                  >
                    {log.validationResult.isValid ? 'Valid' : 'Invalid'}
                  </Text>
                </View>
              </View>

              {log.validationResult.issues.length > 0 && (
                <View style={styles.issues}>
                  {log.validationResult.issues.slice(0, 3).map((issue, index) => (
                    <View
                      key={index}
                      style={[
                        styles.issueBadge,
                        {
                          backgroundColor: `${getSeverityColor(issue.severity)}20`,
                        },
                      ]}
                    >
                      <Text style={[styles.issueText, { color: getSeverityColor(issue.severity) }]}>
                        {issue.severity}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: log.isProactive ? '#f3e8ff' : '#f3f4f6' },
                ]}
              >
                <Text style={[styles.typeText, { color: log.isProactive ? '#7c3aed' : '#6b7280' }]}>
                  {log.isProactive ? 'Proactive' : 'Regular'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {logs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No validation logs found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  agentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  agentCard: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  agentColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textTransform: 'capitalize',
  },
  agentStats: {
    gap: 4,
  },
  agentStatText: {
    fontSize: 12,
    color: '#6b7280',
  },
  issueRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  issueText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    padding: 16,
    gap: 16,
  },
  pickerContainer: {
    gap: 4,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  picker: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  toggleButton: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  toggleButtonTextActive: {
    color: 'white',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  logsList: {
    padding: 16,
    gap: 12,
  },
  logItem: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTimestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  logAgent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logAgentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    textTransform: 'capitalize',
  },
  logMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logScore: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  issues: {
    flexDirection: 'row',
    gap: 6,
  },
  issueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

export default ValidationDashboard;
