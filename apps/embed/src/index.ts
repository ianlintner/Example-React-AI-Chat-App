/**
 * <agent-chat> entry point. Importing this module registers the custom
 * element; the Vite lib build emits a single self-contained ES module.
 */
export { defineAgentChat, AgentChatElement } from './element';
export type { AgentChatAttributes } from './element';
export type { AuthOptions, AuthSession } from './pkce';
export { AuthManager } from './auth';
export { themeCss, resolveTheme } from './tokens';
export { streamChat, parseSseFrame, sseChunks } from './stream';
export type { ChatMessage, StreamCallbacks } from './stream';

import { defineAgentChat } from './element';
if (typeof customElements !== 'undefined') defineAgentChat();
