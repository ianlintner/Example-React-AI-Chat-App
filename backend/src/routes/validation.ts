import express from 'express';
import { responseValidator } from '../validation/responseValidator';

const router = express.Router();

// Get validation statistics
router.get('/stats', (req, res) => {
  try {
    const stats = responseValidator.getValidationStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching validation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation statistics'
    });
  }
});

// Get validation logs
router.get('/logs', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const logs = responseValidator.getValidationLogs();
    
    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedLogs = logs.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        total: logs.length,
        limit: parseInt(limit as string),
        offset: startIndex
      }
    });
  } catch (error) {
    console.error('Error fetching validation logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation logs'
    });
  }
});

// Get validation logs filtered by agent type
router.get('/logs/:agentType', (req, res) => {
  try {
    const { agentType } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const logs = responseValidator.getValidationLogs()
      .filter(log => log.agentType === agentType);
    
    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedLogs = logs.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        total: logs.length,
        limit: parseInt(limit as string),
        offset: startIndex,
        agentType
      }
    });
  } catch (error) {
    console.error('Error fetching validation logs by agent type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation logs'
    });
  }
});

// Get failed validations only
router.get('/failed', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const logs = responseValidator.getValidationLogs()
      .filter(log => !log.validationResult.isValid);
    
    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedLogs = logs.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        total: logs.length,
        limit: parseInt(limit as string),
        offset: startIndex
      }
    });
  } catch (error) {
    console.error('Error fetching failed validations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch failed validations'
    });
  }
});

// Get validation summary by agent type
router.get('/summary', (req, res) => {
  try {
    const logs = responseValidator.getValidationLogs();
    const summary: { [key: string]: any } = {};
    
    // Group logs by agent type
    logs.forEach(log => {
      if (!summary[log.agentType]) {
        summary[log.agentType] = {
          total: 0,
          valid: 0,
          invalid: 0,
          averageScore: 0,
          issues: {
            high: 0,
            medium: 0,
            low: 0
          }
        };
      }
      
      const agentSummary = summary[log.agentType];
      agentSummary.total++;
      
      if (log.validationResult.isValid) {
        agentSummary.valid++;
      } else {
        agentSummary.invalid++;
      }
      
      agentSummary.averageScore += log.validationResult.score;
      
      // Count issues by severity
      log.validationResult.issues.forEach(issue => {
        agentSummary.issues[issue.severity]++;
      });
    });
    
    // Calculate averages
    Object.values(summary).forEach((agentSummary: any) => {
      agentSummary.averageScore = agentSummary.total > 0 ? 
        agentSummary.averageScore / agentSummary.total : 0;
      agentSummary.validationRate = agentSummary.total > 0 ? 
        agentSummary.valid / agentSummary.total : 0;
    });
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error generating validation summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate validation summary'
    });
  }
});

// Clear validation logs (for testing/debugging)
router.post('/clear', (req, res) => {
  try {
    responseValidator.clearLogs();
    res.json({
      success: true,
      message: 'Validation logs cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing validation logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear validation logs'
    });
  }
});

export default router;
