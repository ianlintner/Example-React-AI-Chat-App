import express from 'express';
import { jokeLearningSystem } from '../agents/jokeLearningSystem';
import { UserReaction } from '../agents/learningTypes';

const router = express.Router();

// Record a user reaction to a joke
router.post('/record', async (req, res) => {
  try {
    const { messageId, userId, reactionType, jokeType, jokeCategory } = req.body;

    if (!messageId || !userId || !reactionType) {
      return res.status(400).json({
        error: 'Missing required fields: messageId, userId, reactionType'
      });
    }

    const validReactionTypes = ['laugh', 'groan', 'love', 'meh', 'dislike'];
    if (!validReactionTypes.includes(reactionType)) {
      return res.status(400).json({
        error: 'Invalid reaction type. Must be one of: ' + validReactionTypes.join(', ')
      });
    }

    const reaction: UserReaction = {
      messageId,
      userId,
      reactionType,
      timestamp: new Date(),
      jokeType,
      jokeCategory
    };

    jokeLearningSystem.recordReaction(reaction);

    return res.json({
      success: true,
      message: 'Reaction recorded successfully'
    });
  } catch (error) {
    console.error('Error recording reaction:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get user's joke profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = jokeLearningSystem.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        error: 'User profile not found'
      });
    }

    return res.json(profile);
  } catch (error) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get learning metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = jokeLearningSystem.getLearningMetrics();
    
    // Convert Map to object for JSON serialization
    const serializedMetrics = {
      ...metrics,
      categoryPerformance: Object.fromEntries(metrics.categoryPerformance)
    };

    res.json(serializedMetrics);
  } catch (error) {
    console.error('Error getting learning metrics:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get joke categories
router.get('/categories', async (req, res) => {
  try {
    const categories = jokeLearningSystem.getJokeCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting joke categories:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get personalized joke recommendation for user
router.get('/recommendation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const recommendation = jokeLearningSystem.getPersonalizedJokeRecommendation(userId);
    res.json(recommendation);
  } catch (error) {
    console.error('Error getting joke recommendation:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
