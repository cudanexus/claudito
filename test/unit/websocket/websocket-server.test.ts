import {
  DefaultWebSocketServer,
  WebSocketServerDependencies,
  WebSocketMessage,
} from '../../../src/websocket/websocket-server';
import { AgentManager, AgentMessage } from '../../../src/agents';
import { RoadmapGenerator, AuthService, ShellService } from '../../../src/services';
import { RalphLoopService } from '../../../src/services/ralph-loop/types';
import { Server } from 'http';
import { EventEmitter } from 'events';

// Mock WebSocket and WebSocketServer
jest.mock('ws', () => {
  const mockWsInstance = {
    readyState: 1, // WebSocket.OPEN
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  };

  const mockWss = {
    on: jest.fn(),
    close: jest.fn(),
    clients: new Set([mockWsInstance]),
  };

  return {
    WebSocketServer: jest.fn(() => mockWss),
    WebSocket: {
      OPEN: 1,
      CLOSED: 3,
    },
  };
});

describe('DefaultWebSocketServer', () => {
  let wsServer: DefaultWebSocketServer;
  let mockAgentManager: jest.Mocked<AgentManager>;
  let mockRoadmapGenerator: RoadmapGenerator & EventEmitter;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockShellService: ShellService & EventEmitter;
  let mockRalphLoopService: RalphLoopService & EventEmitter;
  let agentListeners: Map<string, Set<(...args: unknown[]) => void>>;

  const createMockAgentManager = (): jest.Mocked<AgentManager> => {
    agentListeners = new Map();

    return {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        if (!agentListeners.has(event)) {
          agentListeners.set(event, new Set());
        }
        agentListeners.get(event)!.add(listener);
      }),
      off: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        agentListeners.get(event)?.delete(listener);
      }),
      emit: (event: string, ...args: unknown[]) => {
        agentListeners.get(event)?.forEach((listener) => listener(...args));
      },
      getFullStatus: jest.fn().mockReturnValue({
        status: 'stopped',
        mode: null,
        queued: false,
        queuedMessageCount: 0,
        isWaitingForInput: false,
        waitingVersion: 0,
        sessionId: null,
        permissionMode: null,
      }),
      getResourceStatus: jest.fn().mockReturnValue({
        runningCount: 0,
        maxConcurrent: 3,
        queuedCount: 0,
        queuedProjects: [],
      }),
      getContextUsage: jest.fn().mockReturnValue(null),
      startAgent: jest.fn(),
      startInteractiveAgent: jest.fn(),
      sendInput: jest.fn(),
      stopAgent: jest.fn(),
      stopAllAgents: jest.fn(),
      getAgentStatus: jest.fn().mockReturnValue('stopped'),
      getAgentMode: jest.fn().mockReturnValue(null),
      isRunning: jest.fn().mockReturnValue(false),
      isQueued: jest.fn().mockReturnValue(false),
      isWaitingForInput: jest.fn().mockReturnValue(false),
      getWaitingVersion: jest.fn().mockReturnValue(0),
      removeFromQueue: jest.fn(),
      setMaxConcurrentAgents: jest.fn(),
      startAutonomousLoop: jest.fn(),
      stopAutonomousLoop: jest.fn(),
      getLoopState: jest.fn().mockReturnValue(null),
      getLastCommand: jest.fn().mockReturnValue(null),
      getProcessInfo: jest.fn().mockReturnValue(null),
      getQueuedMessageCount: jest.fn().mockReturnValue(0),
      getQueuedMessages: jest.fn().mockReturnValue([]),
      removeQueuedMessage: jest.fn().mockReturnValue(false),
      getSessionId: jest.fn().mockReturnValue(null),
      getTrackedProcesses: jest.fn().mockReturnValue([]),
      cleanupOrphanProcesses: jest.fn().mockResolvedValue({ killed: [], failed: [] }),
      restartAllRunningAgents: jest.fn(),
      getRunningProjectIds: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<AgentManager>;
  };

  const createMockRoadmapGenerator = (): RoadmapGenerator & EventEmitter => {
    const emitter = new EventEmitter();
    return {
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      emit: emitter.emit.bind(emitter),
      listenerCount: emitter.listenerCount.bind(emitter),
      generateRoadmap: jest.fn(),
      modifyRoadmap: jest.fn(),
      respondToQuestion: jest.fn(),
      isGenerating: jest.fn().mockReturnValue(false),
      stop: jest.fn(),
    } as unknown as RoadmapGenerator & EventEmitter;
  };

  const createMockAuthService = (): jest.Mocked<AuthService> => {
    return {
      validateSession: jest.fn().mockReturnValue(true),
      createSession: jest.fn(),
      destroySession: jest.fn(),
      getSessionUser: jest.fn(),
      getSessionExpiry: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;
  };

  const createMockShellService = (): ShellService & EventEmitter => {
    const emitter = new EventEmitter();
    return {
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      emit: emitter.emit.bind(emitter),
      listenerCount: emitter.listenerCount.bind(emitter),
      create: jest.fn(),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn(),
      list: jest.fn().mockReturnValue([]),
      getSessions: jest.fn().mockReturnValue([]),
    } as unknown as ShellService & EventEmitter;
  };

  const createMockRalphLoopService = (): RalphLoopService & EventEmitter => {
    const emitter = new EventEmitter();
    return {
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      emit: emitter.emit.bind(emitter),
      listenerCount: emitter.listenerCount.bind(emitter),
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getState: jest.fn(),
      listByProject: jest.fn(),
    } as unknown as RalphLoopService & EventEmitter;
  };

  beforeEach(() => {
    mockAgentManager = createMockAgentManager();
    mockRoadmapGenerator = createMockRoadmapGenerator();
    mockAuthService = createMockAuthService();
    mockShellService = createMockShellService();
    mockRalphLoopService = createMockRalphLoopService();
  });

  afterEach(() => {
    if (wsServer) {
      wsServer.close();
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create websocket server with agent manager', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);
      expect(wsServer).toBeDefined();
    });

    it('should set up agent listeners', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(mockAgentManager.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockAgentManager.on).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockAgentManager.on).toHaveBeenCalledWith('waitingForInput', expect.any(Function));
      expect(mockAgentManager.on).toHaveBeenCalledWith('queueChange', expect.any(Function));
      expect(mockAgentManager.on).toHaveBeenCalledWith('sessionRecovery', expect.any(Function));
    });

    it('should set up roadmap listeners when roadmap generator is provided', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        roadmapGenerator: mockRoadmapGenerator,
      };

      wsServer = new DefaultWebSocketServer(deps);

      // Verify roadmap generator 'message' listener was added
      expect(mockRoadmapGenerator.listenerCount('message')).toBe(1);
    });

    it('should set up shell listeners when shell service is provided', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        shellService: mockShellService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      // Verify shell service listeners were added
      expect(mockShellService.listenerCount('data')).toBe(1);
      expect(mockShellService.listenerCount('exit')).toBe(1);
      expect(mockShellService.listenerCount('error')).toBe(1);
    });
  });

  describe('broadcast', () => {
    it('should not throw when wss is null', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        wsServer.broadcast({
          type: 'connected',
          data: 'test',
        });
      }).not.toThrow();
    });

    it('should broadcast message to all connected clients', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      // Initialize with mock server
      const mockHttpServer = {} as Server;
      wsServer.initialize(mockHttpServer);

      const message: WebSocketMessage = {
        type: 'connected',
        data: 'test message',
      };

      wsServer.broadcast(message);

      // Get the mocked WebSocketServer
      const { WebSocketServer: MockWebSocketServer } = jest.requireMock('ws');
      const mockWssInstance = MockWebSocketServer.mock.results[0].value;

      // Check that send was called on clients
      const mockClient = Array.from(mockWssInstance.clients)[0] as { send: jest.Mock };
      expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('broadcastToProject', () => {
    it('should not throw when no subscribers', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        wsServer.broadcastToProject('test-project', {
          type: 'agent_message',
          projectId: 'test-project',
          data: { type: 'stdout', content: 'test', timestamp: new Date().toISOString() },
        });
      }).not.toThrow();
    });
  });

  describe('close', () => {
    it('should handle close when wss is null', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        wsServer.close();
        wsServer.close(); // Call twice to ensure it handles null
      }).not.toThrow();
    });

    it('should close all client connections and clear subscriptions', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const mockHttpServer = {} as Server;
      wsServer.initialize(mockHttpServer);

      wsServer.close();

      const { WebSocketServer: MockWebSocketServer } = jest.requireMock('ws');
      const mockWssInstance = MockWebSocketServer.mock.results[0].value;

      expect(mockWssInstance.close).toHaveBeenCalled();
    });
  });

  describe('agent event forwarding', () => {
    beforeEach(() => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);
    });

    it('should emit message events from agent manager with context usage', () => {
      const message: AgentMessage = {
        type: 'stdout',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      mockAgentManager.getContextUsage.mockReturnValue({
        totalTokens: 1000,
        inputTokens: 800,
        outputTokens: 200,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        maxContextTokens: 10000,
        percentUsed: 10,
      });

      const messageListener = agentListeners.get('message')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (messageListener) {
        // Should not throw even without subscribers
        expect(() => {
          messageListener('test-project', message);
        }).not.toThrow();
      } else {
        fail('Message listener should be defined');
      }
    });

    it('should emit status events from agent manager', () => {
      const statusListener = agentListeners.get('status')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (statusListener) {
        expect(() => {
          statusListener('test-project', 'running');
        }).not.toThrow();
      } else {
        fail('Status listener should be defined');
      }
    });

    it('should emit waitingForInput events from agent manager', () => {
      const waitingListener = agentListeners.get('waitingForInput')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (waitingListener) {
        expect(() => {
          waitingListener('test-project', true, 1);
        }).not.toThrow();
      } else {
        fail('Waiting listener should be defined');
      }
    });

    it('should emit queueChange events from agent manager', () => {
      const queueListener = agentListeners.get('queueChange')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (queueListener) {
        expect(() => {
          queueListener([]);
        }).not.toThrow();
      } else {
        fail('Queue listener should be defined');
      }
    });

    it('should emit sessionRecovery events from agent manager', () => {
      const recoveryListener = agentListeners.get('sessionRecovery')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (recoveryListener) {
        expect(() => {
          recoveryListener('test-project', 'old-id', 'new-id', 'test reason');
        }).not.toThrow();
      } else {
        fail('Recovery listener should be defined');
      }
    });
  });

  describe('roadmap event forwarding', () => {
    it('should forward roadmap messages to project subscribers', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        roadmapGenerator: mockRoadmapGenerator,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const message = {
        type: 'stdout' as const,
        content: 'Test roadmap content',
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        mockRoadmapGenerator.emit('message', 'test-project', message);
      }).not.toThrow();
    });
  });

  describe('shell event forwarding', () => {
    beforeEach(() => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        shellService: mockShellService,
      };

      wsServer = new DefaultWebSocketServer(deps);
    });

    it('should forward shell data events to project subscribers', () => {
      // Shell session ID format: shell-{projectId}-{timestamp}-{counter}
      const sessionId = 'shell-test-project-123456-0';

      expect(() => {
        mockShellService.emit('data', sessionId, 'output data');
      }).not.toThrow();
    });

    it('should forward shell exit events to project subscribers', () => {
      const sessionId = 'shell-test-project-123456-0';

      expect(() => {
        mockShellService.emit('exit', sessionId, 0);
      }).not.toThrow();
    });

    it('should forward shell error events to project subscribers', () => {
      const sessionId = 'shell-test-project-123456-0';

      expect(() => {
        mockShellService.emit('error', sessionId, 'error message');
      }).not.toThrow();
    });

    it('should extract project ID from session ID with multiple dashes', () => {
      // Session ID with project ID containing dashes
      const sessionId = 'shell-project-with-dashes-123456-0';

      expect(() => {
        mockShellService.emit('data', sessionId, 'output data');
      }).not.toThrow();
    });

    it('should handle session ID with insufficient parts', () => {
      // Session ID with fewer than 3 parts
      const sessionId = 'shell-project';

      expect(() => {
        mockShellService.emit('data', sessionId, 'output data');
      }).not.toThrow();
    });
  });

  describe('with optional dependencies', () => {
    it('should handle missing roadmap generator', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        // No roadmapGenerator
      };

      const server = new DefaultWebSocketServer(deps);
      expect(server).toBeDefined();
      server.close();
    });

    it('should handle missing auth service', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        // No authService
      };

      const server = new DefaultWebSocketServer(deps);
      expect(server).toBeDefined();
      server.close();
    });

    it('should handle missing shell service', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        // No shellService
      };

      const server = new DefaultWebSocketServer(deps);
      expect(server).toBeDefined();
      server.close();
    });

    it('should work with all dependencies provided', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        roadmapGenerator: mockRoadmapGenerator,
        authService: mockAuthService,
        shellService: mockShellService,
      };

      const server = new DefaultWebSocketServer(deps);
      expect(server).toBeDefined();
      server.close();
    });
  });

  describe('initialize', () => {
    it('should create WebSocket server with http server', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const mockHttpServer = {} as Server;
      wsServer.initialize(mockHttpServer);

      const { WebSocketServer: MockWebSocketServer } = jest.requireMock('ws');
      expect(MockWebSocketServer).toHaveBeenCalledWith({
        server: mockHttpServer,
        verifyClient: expect.any(Function),
      });
    });
  });

  describe('context usage in messages', () => {
    it('should include context usage when available', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const mockContextUsage = {
        totalTokens: 5000,
        inputTokens: 4000,
        outputTokens: 1000,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
        maxContextTokens: 10000,
        percentUsed: 50,
      };

      mockAgentManager.getContextUsage.mockReturnValue(mockContextUsage);

      const messageListener = agentListeners.get('message')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      const message: AgentMessage = {
        type: 'stdout',
        content: 'test output',
        timestamp: new Date().toISOString(),
      };

      if (messageListener) {
        // Should not throw
        expect(() => messageListener('test-project', message)).not.toThrow();

        // Verify getContextUsage was called
        expect(mockAgentManager.getContextUsage).toHaveBeenCalledWith('test-project');
      } else {
        fail('Message listener should be defined');
      }
    });

    it('should handle undefined context usage', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      mockAgentManager.getContextUsage.mockReturnValue(null);

      const messageListener = agentListeners.get('message')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      const message: AgentMessage = {
        type: 'stdout',
        content: 'test',
        timestamp: new Date().toISOString(),
      };

      if (messageListener) {
        expect(() => messageListener('test-project', message)).not.toThrow();
      } else {
        fail('Message listener should be defined');
      }
    });
  });

  describe('full status broadcast', () => {
    it('should broadcast full agent status on status change', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const mockFullStatus = {
        status: 'running' as const,
        mode: 'interactive' as const,
        queued: false,
        queuedMessageCount: 2,
        isWaitingForInput: false,
        waitingVersion: 1,
        sessionId: 'session-123',
        permissionMode: 'acceptEdits' as const,
      };

      mockAgentManager.getFullStatus.mockReturnValue(mockFullStatus);

      const statusListener = agentListeners.get('status')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (statusListener) {
        expect(() => statusListener('test-project', 'running')).not.toThrow();
        expect(mockAgentManager.getFullStatus).toHaveBeenCalledWith('test-project');
      } else {
        fail('Status listener should be defined');
      }
    });
  });

  describe('resource status broadcast', () => {
    it('should broadcast resource status on queue change', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const mockResourceStatus = {
        runningCount: 2,
        maxConcurrent: 3,
        queuedCount: 1,
        queuedProjects: [{
          projectId: 'queued-project',
          instructions: 'Test instructions',
          queuedAt: new Date().toISOString(),
        }],
      };

      mockAgentManager.getResourceStatus.mockReturnValue(mockResourceStatus);

      const queueListener = agentListeners.get('queueChange')?.values().next().value as ((...args: unknown[]) => void) | undefined;

      if (queueListener) {
        expect(() => queueListener([{ projectId: 'test' }])).not.toThrow();
        expect(mockAgentManager.getResourceStatus).toHaveBeenCalled();
      } else {
        fail('Queue listener should be defined');
      }
    });
  });

  describe('Ralph Loop listeners', () => {
    it('should set up Ralph Loop listeners when service is provided', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      // Verify Ralph Loop service listeners were added
      expect(mockRalphLoopService.listenerCount('status_change')).toBe(1);
      expect(mockRalphLoopService.listenerCount('iteration_start')).toBe(1);
      expect(mockRalphLoopService.listenerCount('worker_complete')).toBe(1);
      expect(mockRalphLoopService.listenerCount('reviewer_complete')).toBe(1);
      expect(mockRalphLoopService.listenerCount('loop_complete')).toBe(1);
      expect(mockRalphLoopService.listenerCount('loop_error')).toBe(1);
    });

    it('should not throw when Ralph Loop service is not provided', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
      };

      expect(() => {
        wsServer = new DefaultWebSocketServer(deps);
      }).not.toThrow();
    });

    it('should handle status_change event', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        mockRalphLoopService.emit('status_change', 'project-1', 'task-123', 'worker_running');
      }).not.toThrow();
    });

    it('should handle iteration_start event', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        mockRalphLoopService.emit('iteration_start', 'project-1', 'task-123', 1);
      }).not.toThrow();
    });

    it('should handle worker_complete event', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const summary = {
        iterationNumber: 1,
        timestamp: new Date().toISOString(),
        workerOutput: 'Implemented feature',
        filesModified: ['src/feature.ts'],
        tokensUsed: 1000,
        durationMs: 5000,
      };

      expect(() => {
        mockRalphLoopService.emit('worker_complete', 'project-1', 'task-123', summary);
      }).not.toThrow();
    });

    it('should handle reviewer_complete event', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      const feedback = {
        iterationNumber: 1,
        timestamp: new Date().toISOString(),
        decision: 'needs_changes' as const,
        feedback: 'Good progress',
        specificIssues: ['Missing tests'],
        suggestedImprovements: ['Add unit tests'],
      };

      expect(() => {
        mockRalphLoopService.emit('reviewer_complete', 'project-1', 'task-123', feedback);
      }).not.toThrow();
    });

    it('should handle loop_complete event', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        mockRalphLoopService.emit('loop_complete', 'project-1', 'task-123', 'approved');
      }).not.toThrow();
    });

    it('should handle loop_error event', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        ralphLoopService: mockRalphLoopService,
      };

      wsServer = new DefaultWebSocketServer(deps);

      expect(() => {
        mockRalphLoopService.emit('loop_error', 'project-1', 'task-123', 'Worker process failed');
      }).not.toThrow();
    });

    it('should work with all dependencies including Ralph Loop', () => {
      const deps: WebSocketServerDependencies = {
        agentManager: mockAgentManager,
        roadmapGenerator: mockRoadmapGenerator,
        authService: mockAuthService,
        shellService: mockShellService,
        ralphLoopService: mockRalphLoopService,
      };

      const server = new DefaultWebSocketServer(deps);
      expect(server).toBeDefined();
      server.close();
    });
  });
});
