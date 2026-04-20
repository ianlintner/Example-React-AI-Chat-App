import { MediaAttachment } from '../types';
import { LLMTool } from '../llm/provider';

export interface ToolResult {
  attachment: MediaAttachment;
  text?: string;
}

export interface ToolDefinition extends LLMTool {
  execute(input: unknown): Promise<ToolResult | ToolResult[]>;
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | null {
    return this.tools.get(name) ?? null;
  }

  getForAgent(toolNames: string[]): LLMTool[] {
    return toolNames
      .map(n => this.tools.get(n))
      .filter((t): t is ToolDefinition => t !== undefined)
      .map(({ execute: _x, ...llmTool }) => llmTool);
  }
}

export const toolRegistry = new ToolRegistry();

// Register tools at startup
import('./youtubeSearch').then(m => toolRegistry.register(m.youtubeSearchTool));
import('./gifSearch').then(m => toolRegistry.register(m.gifSearchTool));
import('./audio').then(m => {
  toolRegistry.register(m.playAudioTool);
  toolRegistry.register(m.musicSearchTool);
});
import('./imageGallery').then(m => {
  toolRegistry.register(m.showImageGalleryTool);
  toolRegistry.register(m.showImageTool);
});
import('./dnd').then(m => {
  toolRegistry.register(m.rollDiceTool);
  toolRegistry.register(m.generateCharacterTool);
  toolRegistry.register(m.generateEncounterTool);
});
