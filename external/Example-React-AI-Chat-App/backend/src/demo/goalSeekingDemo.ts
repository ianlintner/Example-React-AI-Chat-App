import { AgentService } from '../agents/agentService';
import { GoalSeekingSystem } from '../agents/goalSeekingSystem';

// Demo script to show how the goal-seeking system works
async function demonstrateGoalSeekingSystem() {
  console.log('🎯 Goal-Seeking System Demo');
  console.log('='.repeat(50));

  const agentService = new AgentService();
  const userId = 'demo-user-123';

  // Initialize user
  console.log('\n1. Initializing user...');
  const userState = agentService.initializeUserGoals(userId);
  console.log(
    'User initialized with goals:',
    userState.goals.map(g => g.type),
  );

  // Simulate user saying they're waiting
  console.log('\n2. User says: "I\'m waiting for support"');
  const response1 = await agentService.processMessageWithGoalSeeking(
    userId,
    "I'm waiting for support",
    [],
  );
  console.log('Agent response:', `${response1.content.substring(0, 100)}...`);
  console.log('Proactive actions:', response1.proactiveActions?.length || 0);

  // Check user state
  const state1 = agentService.getUserGoalState(userId);
  console.log('User state:', state1?.currentState);
  console.log(
    'Active goals:',
    state1?.goals.filter(g => g.active).map(g => g.type),
  );

  // Simulate user asking for a joke
  console.log('\n3. User says: "Can you tell me a joke?"');
  const response2 = await agentService.processMessageWithGoalSeeking(
    userId,
    'Can you tell me a joke?',
    [],
  );
  console.log('Agent response:', `${response2.content.substring(0, 100)}...`);
  console.log('Agent used:', response2.agentUsed);

  // Check updated state
  const state2 = agentService.getUserGoalState(userId);
  console.log('Entertainment preference:', state2?.entertainmentPreference);
  console.log('Engagement level:', state2?.engagementLevel);

  // Simulate technical question
  console.log('\n4. User says: "I have a JavaScript error in my code"');
  const response3 = await agentService.processMessageWithGoalSeeking(
    userId,
    'I have a JavaScript error in my code',
    [],
  );
  console.log('Agent response:', `${response3.content.substring(0, 100)}...`);
  console.log('Agent used:', response3.agentUsed);

  // Check final state
  const state3 = agentService.getUserGoalState(userId);
  console.log(
    'Technical context:',
    state3?.technicalContext ? 'Set' : 'Not set',
  );
  console.log(
    'Active goals:',
    state3?.goals.filter((g: any) => g.active).map((g: any) => g.type),
  );
  console.log('Satisfaction level:', state3?.satisfactionLevel);

  console.log('\n🎯 Demo completed!');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateGoalSeekingSystem().catch(console.error);
}

export { demonstrateGoalSeekingSystem };
