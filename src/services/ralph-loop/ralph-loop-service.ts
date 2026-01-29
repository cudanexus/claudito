import { EventEmitter } from 'events';
import {
  RalphLoopService,
  RalphLoopState,
  RalphLoopConfig,
  RalphLoopEvents,
  RalphLoopRepository,
  RalphLoopStatus,
  RalphLoopFinalStatus,
  ReviewerFeedback,
  ContextInitializer,
} from './types';
import { DefaultContextInitializer } from './context-initializer';
import { WorkerAgent, WorkerAgentConfig } from './worker-agent';
import { ReviewerAgent, ReviewerAgentConfig } from './reviewer-agent';
import { getLogger, Logger } from '../../utils';
import { generateTaskId } from '../../repositories/ralph-loop';

/**
 * Interface for resolving project paths
 */
export interface ProjectPathResolver {
  getProjectPath(projectId: string): string | null;
}

/**
 * Factory interface for creating worker agents
 */
export interface WorkerAgentFactory {
  create(config: WorkerAgentConfig): WorkerAgent;
}

/**
 * Factory interface for creating reviewer agents
 */
export interface ReviewerAgentFactory {
  create(config: ReviewerAgentConfig): ReviewerAgent;
}

/**
 * Default worker agent factory
 */
const defaultWorkerAgentFactory: WorkerAgentFactory = {
  create: (config: WorkerAgentConfig) => new WorkerAgent(config),
};

/**
 * Default reviewer agent factory
 */
const defaultReviewerAgentFactory: ReviewerAgentFactory = {
  create: (config: ReviewerAgentConfig) => new ReviewerAgent(config),
};

/**
 * Internal state for tracking active loops
 */
interface ActiveLoopState {
  taskId: string;
  projectId: string;
  shouldContinue: boolean;
  currentPhase: 'worker' | 'reviewer' | null;
  startTime: number;
  workerAgent?: WorkerAgent;
  reviewerAgent?: ReviewerAgent;
}

export interface RalphLoopServiceDependencies {
  repository: RalphLoopRepository;
  projectPathResolver: ProjectPathResolver;
  contextInitializer?: ContextInitializer;
  workerAgentFactory?: WorkerAgentFactory;
  reviewerAgentFactory?: ReviewerAgentFactory;
}

/**
 * Default implementation of RalphLoopService
 *
 * Orchestrates the worker → reviewer → decision cycle.
 */
export class DefaultRalphLoopService implements RalphLoopService {
  private readonly repository: RalphLoopRepository;
  private readonly projectPathResolver: ProjectPathResolver;
  private readonly contextInitializer: ContextInitializer;
  private readonly workerAgentFactory: WorkerAgentFactory;
  private readonly reviewerAgentFactory: ReviewerAgentFactory;
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private readonly activeLoops: Map<string, ActiveLoopState> = new Map();

  constructor(deps: RalphLoopServiceDependencies) {
    this.repository = deps.repository;
    this.projectPathResolver = deps.projectPathResolver;
    this.contextInitializer = deps.contextInitializer || new DefaultContextInitializer();
    this.workerAgentFactory = deps.workerAgentFactory || defaultWorkerAgentFactory;
    this.reviewerAgentFactory = deps.reviewerAgentFactory || defaultReviewerAgentFactory;
    this.logger = getLogger('ralph-loop-service');
    this.emitter = new EventEmitter();
  }

  /**
   * Start a new Ralph Loop
   */
  async start(projectId: string, config: RalphLoopConfig): Promise<RalphLoopState> {
    const taskId = generateTaskId();

    this.logger.info('Starting Ralph Loop', {
      projectId,
      taskId,
      maxTurns: config.maxTurns,
    });

    const initialState: Omit<RalphLoopState, 'createdAt' | 'updatedAt'> = {
      taskId,
      projectId,
      config,
      currentIteration: 0,
      status: 'idle',
      summaries: [],
      feedback: [],
    };

    const state = await this.repository.create(initialState);

    // Track active loop
    const activeState: ActiveLoopState = {
      taskId,
      projectId,
      shouldContinue: true,
      currentPhase: null,
      startTime: Date.now(),
    };
    this.activeLoops.set(this.getLoopKey(projectId, taskId), activeState);

    // Start the first iteration
    void this.runNextIteration(projectId, taskId).catch((error) => {
      void this.handleLoopError(projectId, taskId, error);
    });

    return state;
  }

  /**
   * Stop a running Ralph Loop
   */
  async stop(projectId: string, taskId: string): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    const activeState = this.activeLoops.get(key);

    if (activeState) {
      activeState.shouldContinue = false;

      // Stop worker agent if running
      if (activeState.workerAgent) {
        await activeState.workerAgent.stop();
      }

      // Stop reviewer agent if running
      if (activeState.reviewerAgent) {
        await activeState.reviewerAgent.stop();
      }

      this.activeLoops.delete(key);
    }

    await this.repository.update(projectId, taskId, {
      status: 'completed',
      finalStatus: 'critical_failure',
      error: 'Loop stopped by user',
    });

    this.logger.info('Ralph Loop stopped', { projectId, taskId });
  }

  /**
   * Pause a running Ralph Loop
   */
  async pause(projectId: string, taskId: string): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    const activeState = this.activeLoops.get(key);

    if (activeState) {
      activeState.shouldContinue = false;
    }

    await this.updateStatus(projectId, taskId, 'paused');
    this.logger.info('Ralph Loop paused', { projectId, taskId });
  }

  /**
   * Resume a paused Ralph Loop
   */
  async resume(projectId: string, taskId: string): Promise<void> {
    const state = await this.repository.findById(projectId, taskId);

    if (!state) {
      throw new Error(`Ralph Loop not found: ${taskId}`);
    }

    if (state.status !== 'paused') {
      throw new Error(`Cannot resume loop in status: ${state.status}`);
    }

    const key = this.getLoopKey(projectId, taskId);
    const activeState: ActiveLoopState = {
      taskId,
      projectId,
      shouldContinue: true,
      currentPhase: null,
      startTime: Date.now(),
    };
    this.activeLoops.set(key, activeState);

    await this.updateStatus(projectId, taskId, 'idle');

    void this.runNextIteration(projectId, taskId).catch((error) => {
      void this.handleLoopError(projectId, taskId, error);
    });

    this.logger.info('Ralph Loop resumed', { projectId, taskId });
  }

  /**
   * Get the current state of a Ralph Loop
   */
  async getState(projectId: string, taskId: string): Promise<RalphLoopState | null> {
    return this.repository.findById(projectId, taskId);
  }

  /**
   * List all Ralph Loops for a project
   */
  async listByProject(projectId: string): Promise<RalphLoopState[]> {
    return this.repository.findByProject(projectId);
  }

  on<K extends keyof RalphLoopEvents>(event: K, listener: RalphLoopEvents[K]): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof RalphLoopEvents>(event: K, listener: RalphLoopEvents[K]): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  private getLoopKey(projectId: string, taskId: string): string {
    return `${projectId}:${taskId}`;
  }

  private async updateStatus(
    projectId: string,
    taskId: string,
    status: RalphLoopStatus
  ): Promise<void> {
    await this.repository.update(projectId, taskId, { status });
    this.emitter.emit('status_change', projectId, taskId, status);
  }

  /**
   * Run the next iteration of the loop
   */
  private async runNextIteration(projectId: string, taskId: string): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    const activeState = this.activeLoops.get(key);

    if (!activeState || !activeState.shouldContinue) {
      return;
    }

    const state = await this.repository.findById(projectId, taskId);

    if (!state) {
      return;
    }

    // Check if max turns reached
    if (state.currentIteration >= state.config.maxTurns) {
      await this.completeLoop(projectId, taskId, 'max_turns_reached');
      return;
    }

    // Start next iteration
    const nextIteration = state.currentIteration + 1;
    await this.repository.update(projectId, taskId, {
      currentIteration: nextIteration,
    });

    this.emitter.emit('iteration_start', projectId, taskId, nextIteration);

    // Run worker phase
    await this.runWorkerPhase(projectId, taskId, nextIteration);
  }

  /**
   * Run the worker phase of an iteration
   */
  private async runWorkerPhase(
    projectId: string,
    taskId: string,
    iteration: number
  ): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    const activeState = this.activeLoops.get(key);

    if (!activeState || !activeState.shouldContinue) {
      return;
    }

    activeState.currentPhase = 'worker';
    await this.updateStatus(projectId, taskId, 'worker_running');

    const state = await this.repository.findById(projectId, taskId);

    if (!state) {
      return;
    }

    const projectPath = this.projectPathResolver.getProjectPath(projectId);

    if (!projectPath) {
      throw new Error(`Project path not found for: ${projectId}`);
    }

    this.logger.info('Running worker phase', {
      projectId,
      taskId,
      iteration,
    });

    // Create and run the worker agent
    const workerAgent = this.workerAgentFactory.create({
      projectPath,
      model: state.config.workerModel,
      contextInitializer: this.contextInitializer,
    });

    activeState.workerAgent = workerAgent;

    // Set up output forwarding
    workerAgent.on('output', (content) => {
      this.logger.debug('Worker output', {
        projectId,
        taskId,
        iteration,
        contentLength: content.length,
      });
    });

    try {
      const summary = await workerAgent.run(state);

      await this.repository.addSummary(projectId, taskId, summary);
      this.emitter.emit('worker_complete', projectId, taskId, summary);

      // Continue to reviewer phase if still active
      if (activeState.shouldContinue) {
        await this.runReviewerPhase(projectId, taskId, iteration, summary.workerOutput);
      }
    } catch (error) {
      // Check if we were stopped
      if (!activeState.shouldContinue) {
        return;
      }

      throw error;
    } finally {
      activeState.workerAgent = undefined;
    }
  }

  /**
   * Run the reviewer phase of an iteration
   */
  private async runReviewerPhase(
    projectId: string,
    taskId: string,
    iteration: number,
    workerOutput: string
  ): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    const activeState = this.activeLoops.get(key);

    if (!activeState || !activeState.shouldContinue) {
      return;
    }

    activeState.currentPhase = 'reviewer';
    await this.updateStatus(projectId, taskId, 'reviewer_running');

    const state = await this.repository.findById(projectId, taskId);

    if (!state) {
      return;
    }

    const projectPath = this.projectPathResolver.getProjectPath(projectId);

    if (!projectPath) {
      throw new Error(`Project path not found for: ${projectId}`);
    }

    this.logger.info('Running reviewer phase', {
      projectId,
      taskId,
      iteration,
    });

    // Create and run the reviewer agent
    const reviewerAgent = this.reviewerAgentFactory.create({
      projectPath,
      model: state.config.reviewerModel,
      contextInitializer: this.contextInitializer,
    });

    activeState.reviewerAgent = reviewerAgent;

    // Set up output forwarding
    reviewerAgent.on('output', (content) => {
      this.logger.debug('Reviewer output', {
        projectId,
        taskId,
        iteration,
        contentLength: content.length,
      });
    });

    try {
      const feedback = await reviewerAgent.run(state, workerOutput);

      await this.repository.addFeedback(projectId, taskId, feedback);
      this.emitter.emit('reviewer_complete', projectId, taskId, feedback);

      // Handle the reviewer's decision if still active
      if (activeState.shouldContinue) {
        await this.handleReviewerDecision(projectId, taskId, feedback);
      }
    } catch (error) {
      // Check if we were stopped
      if (!activeState.shouldContinue) {
        return;
      }

      throw error;
    } finally {
      activeState.reviewerAgent = undefined;
    }
  }

  /**
   * Handle the reviewer's decision
   */
  private async handleReviewerDecision(
    projectId: string,
    taskId: string,
    feedback: ReviewerFeedback
  ): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    const activeState = this.activeLoops.get(key);

    if (!activeState || !activeState.shouldContinue) {
      return;
    }

    switch (feedback.decision) {
      case 'approve':
        await this.completeLoop(projectId, taskId, 'approved');
        break;

      case 'reject':
        await this.completeLoop(projectId, taskId, 'critical_failure');
        break;

      case 'needs_changes':
        // Continue to next iteration
        await this.runNextIteration(projectId, taskId);
        break;
    }
  }

  /**
   * Complete the loop with a final status
   */
  private async completeLoop(
    projectId: string,
    taskId: string,
    finalStatus: RalphLoopFinalStatus
  ): Promise<void> {
    const key = this.getLoopKey(projectId, taskId);
    this.activeLoops.delete(key);

    await this.repository.update(projectId, taskId, {
      status: 'completed',
      finalStatus,
    });

    this.emitter.emit('loop_complete', projectId, taskId, finalStatus);

    this.logger.info('Ralph Loop completed', {
      projectId,
      taskId,
      finalStatus,
    });
  }

  /**
   * Handle errors during loop execution
   */
  private async handleLoopError(
    projectId: string,
    taskId: string,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const key = this.getLoopKey(projectId, taskId);
    this.activeLoops.delete(key);

    await this.repository.update(projectId, taskId, {
      status: 'failed',
      finalStatus: 'critical_failure',
      error: errorMessage,
    });

    this.emitter.emit('loop_error', projectId, taskId, errorMessage);

    this.logger.error('Ralph Loop error', {
      projectId,
      taskId,
      error: errorMessage,
    });
  }
}
