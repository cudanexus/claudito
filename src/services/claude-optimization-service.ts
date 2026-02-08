import { Logger } from '../utils/logger';
import { AgentManager, AgentManagerEvents } from '../agents/agent-manager';
import { AgentMessage, AgentStatus } from '../agents/claude-agent';
import { EventEmitter } from 'events';
import path from 'path';

export interface OptimizationRequest {
  projectId: string;
  filePath: string;
  content: string;
  optimizationGoals?: string[];
}

export interface OptimizationResult {
  success: boolean;
  originalContent: string;
  optimizedContent?: string;
  diff?: string;
  summary?: string;
  error?: string;
}

export interface OptimizationProgress {
  status: 'starting' | 'running' | 'processing' | 'completed' | 'failed';
  message: string;
  percentage?: number;
}

interface CollectedOutput {
  optimizedContent: string;
  summary: string;
}

const OPTIMIZATION_TIMEOUT_MS = 120000;

export class ClaudeOptimizationService extends EventEmitter {
  private activeOptimizations: Map<string, string> = new Map(); // projectId -> oneOffId

  constructor(
    private readonly logger: Logger,
    private readonly agentManager: AgentManager
  ) {
    super();
  }

  async optimizeFile(request: OptimizationRequest): Promise<OptimizationResult> {
    const { projectId, filePath, content, optimizationGoals = [] } = request;

    if (this.activeOptimizations.has(projectId)) {
      throw new Error('Optimization already in progress for this project');
    }

    try {
      this.emitProgress(projectId, {
        status: 'starting',
        message: 'Starting optimization agent...',
        percentage: 0
      });

      const prompt = this.buildOptimizationPrompt(filePath, content, optimizationGoals);

      const oneOffId = await this.agentManager.startOneOffAgent({
        projectId,
        message: prompt,
        permissionMode: 'plan',
      });

      this.activeOptimizations.set(projectId, oneOffId);

      const result = await this.collectOneOffResult(projectId, oneOffId, content);

      this.emit('optimization:complete', { projectId, result, filePath });
      return result;
    } catch (error) {
      this.logger.error('Optimization failed', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.emitProgress(projectId, {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Optimization failed'
      });

      const errorResult: OptimizationResult = {
        success: false,
        originalContent: content,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('optimization:complete', { projectId, result: errorResult, filePath });
      return errorResult;
    } finally {
      const oneOffId = this.activeOptimizations.get(projectId);
      this.activeOptimizations.delete(projectId);

      if (oneOffId) {
        try {
          await this.agentManager.stopOneOffAgent(oneOffId);
        } catch (stopError) {
          this.logger.warn('Failed to stop optimization agent', {
            projectId,
            error: stopError instanceof Error ? stopError.message : 'Unknown error'
          });
        }
      }
    }
  }

  private collectOneOffResult(
    projectId: string,
    oneOffId: string,
    originalContent: string
  ): Promise<OptimizationResult> {
    return new Promise((resolve) => {
      let fullContent = '';

      const timeout = setTimeout(() => {
        cleanup();
        this.emitProgress(projectId, { status: 'failed', message: 'Optimization timed out' });
        resolve({ success: false, originalContent, error: 'Optimization timed out' });
      }, OPTIMIZATION_TIMEOUT_MS);

      const cleanup = (): void => {
        clearTimeout(timeout);
        this.agentManager.off('oneOffMessage', messageHandler);
        this.agentManager.off('oneOffStatus', statusHandler);
      };

      const messageHandler: AgentManagerEvents['oneOffMessage'] = (msgOneOffId, message) => {
        if (msgOneOffId !== oneOffId) return;

        this.emitProgress(projectId, {
          status: 'processing',
          message: 'Processing optimization response...',
          percentage: 50
        });

        fullContent += (message.content || '');
        const parsed = this.parseOptimizationOutput(fullContent);

        if (parsed) {
          cleanup();
          this.emitProgress(projectId, {
            status: 'completed',
            message: 'Optimization completed successfully',
            percentage: 100
          });
          resolve({
            success: true,
            originalContent,
            optimizedContent: parsed.optimizedContent,
            summary: parsed.summary,
            diff: this.generateDiff(originalContent, parsed.optimizedContent)
          });
        }
      };

      const statusHandler: AgentManagerEvents['oneOffStatus'] = (msgOneOffId, status) => {
        if (msgOneOffId !== oneOffId) return;

        if (status === 'error') {
          cleanup();
          this.emitProgress(projectId, { status: 'failed', message: 'Agent encountered an error' });
          resolve({
            success: false,
            originalContent,
            error: 'Agent encountered an error during optimization'
          });
        }
      };

      this.agentManager.on('oneOffMessage', messageHandler);
      this.agentManager.on('oneOffStatus', statusHandler);
    });
  }

  private parseOptimizationOutput(content: string): CollectedOutput | null {
    if (!content.includes('OPTIMIZED_CONTENT:') || !content.includes('SUMMARY:')) {
      return null;
    }

    const parts = content.split('OPTIMIZED_CONTENT:');

    if (parts.length < 2) return null;

    const afterMarker = parts[1]!;
    const codeBlockMatch = afterMarker.match(/```(?:markdown)?\n([\s\S]*?)```/);

    if (!codeBlockMatch || !codeBlockMatch[1]) return null;

    const optimizedContent = codeBlockMatch[1].trim();

    const summaryParts = content.split('SUMMARY:');

    if (summaryParts.length < 2 || !summaryParts[1]) return null;

    const summary = summaryParts[1].trim();
    return { optimizedContent, summary };
  }

  private buildOptimizationPrompt(filePath: string, content: string, goals: string[]): string {
    const fileName = path.basename(filePath);

    const defaultGoals = [
      'Remove any duplicated rules or instructions',
      'Consolidate similar rules into more concise versions',
      'Remove rules that contradict Claude\'s core values or capabilities',
      'Organize rules by category for better readability',
      'Remove vague or unclear instructions',
      'Preserve all unique and valuable content',
      'Maintain the original intent while improving clarity'
    ];

    const allGoals = [...defaultGoals, ...goals];

    return `Please optimize this ${fileName} file with the following goals:

${allGoals.map((goal, i) => `${i + 1}. ${goal}`).join('\n')}

Current content:
\`\`\`markdown
${content}
\`\`\`

Please provide the optimized content in the following format:

OPTIMIZED_CONTENT:
\`\`\`markdown
[the optimized markdown content]
\`\`\`

SUMMARY:
- [Brief bullet points of changes made]

Important: Maintain the original formatting style and structure as much as possible while achieving the optimization goals.`;
  }

  private generateDiff(original: string, optimized: string): string {
    const originalLines = original.split('\n');
    const optimizedLines = optimized.split('\n');

    let diff = '';
    const maxLines = Math.max(originalLines.length, optimizedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const optLine = optimizedLines[i] || '';

      if (origLine !== optLine) {
        if (origLine && !optLine) {
          diff += `- ${origLine}\n`;
        } else if (!origLine && optLine) {
          diff += `+ ${optLine}\n`;
        } else {
          diff += `- ${origLine}\n`;
          diff += `+ ${optLine}\n`;
        }
      }
    }

    return diff;
  }

  private emitProgress(projectId: string, progress: OptimizationProgress): void {
    this.emit('optimizationProgress', { projectId, ...progress });
  }

  isOptimizing(projectId: string): boolean {
    return this.activeOptimizations.has(projectId);
  }

  getActiveOptimizations(): string[] {
    return Array.from(this.activeOptimizations.keys());
  }
}
