import { initializeTracing, tracer, createAgentSpan, createConversationSpan, addSpanEvent, setSpanStatus, endSpan } from './tracer';

// Initialize tracing first
initializeTracing();

export const generateTestTraces = () => {
  console.log('🔍 Generating test traces for debugging...');

  // Test trace 1: Simple operation
  const simpleSpan = tracer.startSpan('test_trace_simple');
  simpleSpan.setAttributes({
    'test.type': 'simple',
    'test.timestamp': Date.now()
  });
  addSpanEvent(simpleSpan, 'test_event_start');
  
  setTimeout(() => {
    addSpanEvent(simpleSpan, 'test_event_complete');
    setSpanStatus(simpleSpan, true);
    endSpan(simpleSpan);
    console.log('✅ Simple test trace completed');
  }, 100);

  // Test trace 2: Conversation flow
  setTimeout(() => {
    const conversationSpan = createConversationSpan('test-conversation-123', 'test_flow');
    conversationSpan.setAttributes({
      'test.conversation_id': 'test-conversation-123',
      'test.user_id': 'test-user-456'
    });

    addSpanEvent(conversationSpan, 'conversation_test_start');
    
    setTimeout(() => {
      addSpanEvent(conversationSpan, 'conversation_test_complete');
      setSpanStatus(conversationSpan, true);
      endSpan(conversationSpan);
      console.log('✅ Conversation test trace completed');
    }, 200);
  }, 500);

  // Test trace 3: Agent processing
  setTimeout(() => {
    const agentSpan = createAgentSpan('test_agent', 'test_processing', 'test-conversation-789');
    agentSpan.setAttributes({
      'test.agent_type': 'test_agent',
      'test.operation': 'test_processing',
      'test.message_length': 25
    });

    addSpanEvent(agentSpan, 'agent_test_start');
    
    // Simulate some processing
    setTimeout(() => {
      addSpanEvent(agentSpan, 'agent_classification', { classified_as: 'general' });
      
      setTimeout(() => {
        addSpanEvent(agentSpan, 'agent_response_generated', { response_length: 150 });
        setSpanStatus(agentSpan, true);
        endSpan(agentSpan);
        console.log('✅ Agent test trace completed');
      }, 100);
    }, 150);
  }, 1000);

  // Test trace 4: Error scenario
  setTimeout(() => {
    const errorSpan = tracer.startSpan('test_trace_error');
    errorSpan.setAttributes({
      'test.type': 'error_simulation',
      'test.will_fail': true
    });

    addSpanEvent(errorSpan, 'error_test_start');
    
    setTimeout(() => {
      addSpanEvent(errorSpan, 'error_occurred', { 
        error_type: 'simulation_error',
        error_message: 'This is a test error for tracing'
      });
      setSpanStatus(errorSpan, false, 'Simulated error for testing');
      endSpan(errorSpan);
      console.log('✅ Error test trace completed');
    }, 75);
  }, 1500);

  // Test trace 5: Complex nested operation
  setTimeout(() => {
    const parentSpan = tracer.startSpan('test_trace_nested_parent');
    parentSpan.setAttributes({
      'test.type': 'nested_operation',
      'test.has_children': true
    });

    addSpanEvent(parentSpan, 'nested_test_parent_start');

    // Child span 1
    setTimeout(() => {
      const childSpan1 = tracer.startSpan('test_trace_nested_child_1');
      childSpan1.setAttributes({
        'test.type': 'child_operation',
        'test.child_number': 1
      });

      addSpanEvent(childSpan1, 'child_1_processing');
      
      setTimeout(() => {
        setSpanStatus(childSpan1, true);
        endSpan(childSpan1);

        // Child span 2
        const childSpan2 = tracer.startSpan('test_trace_nested_child_2');
        childSpan2.setAttributes({
          'test.type': 'child_operation',
          'test.child_number': 2
        });

        addSpanEvent(childSpan2, 'child_2_processing');
        
        setTimeout(() => {
          setSpanStatus(childSpan2, true);
          endSpan(childSpan2);

          // Complete parent
          addSpanEvent(parentSpan, 'nested_test_parent_complete');
          setSpanStatus(parentSpan, true);
          endSpan(parentSpan);
          console.log('✅ Nested test traces completed');
        }, 100);
      }, 150);
    }, 100);
  }, 2000);

  console.log('🔍 All test traces initiated, they will complete over the next few seconds...');
};

// Auto-generate test traces when this module is imported
if (require.main === module) {
  console.log('🔍 Running test traces generator...');
  generateTestTraces();
  
  // Keep the process alive for a bit to let traces complete
  setTimeout(() => {
    console.log('🔍 Test trace generation complete. Exiting...');
    process.exit(0);
  }, 5000);
}
