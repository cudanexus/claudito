# Claudito Roadmap

## Progress Summary

- **Phase 1: Ralph Loop Implementation** ✅ Completed
- **Phase 2: Model Selection** ✅ Completed
- **Phase 3: Critical Security & Architecture Fixes** ✅ Completed
- **Phase 4: Code Quality Improvements** ✅ Completed
- **Phase 5: Frontend Improvements** 🔄 Not Started
- **Phase 6: Documentation & Testing** 🔄 Not Started

---

## Phase 1: Ralph Loop Implementation (Completed)

Implement the Ralph Loop pattern based on Geoffrey Huntley's Ralph Wiggum technique - an iterative development pattern that solves context accumulation by starting each iteration with fresh context and using cross-model review.

### Milestone 1.1: Ralph Loop Core Architecture

- [x] Design RalphLoop service interface with worker/reviewer model separation
- [x] Create iteration state persistence layer (summary files, feedback files)
- [x] Implement fresh context initialization for each iteration
- [x] Add iteration tracking with configurable max turns
- [x] Create RalphLoopConfig interface (maxTurns, workerModel, reviewerModel, taskDescription)

### Milestone 1.2: Worker Agent Implementation

- [x] Create WorkerAgent class that reads previous iteration summaries
- [x] Implement task execution with summary generation after each iteration
- [x] Add structured output format for iteration results
- [x] Create file persistence for worker summaries (`.claudito/ralph/{taskId}/worker-summary.json`)
- [x] Implement worker completion detection (success/failure/needs-review)

### Milestone 1.3: Reviewer Agent Implementation

- [x] Create ReviewerAgent class that reads worker output and previous feedback
- [x] Implement code review logic with structured feedback format
- [x] Add review criteria configuration (correctness, completeness, code quality)
- [x] Create file persistence for reviewer feedback (`.claudito/ralph/{taskId}/reviewer-feedback.json`)
- [x] Implement review decision output (approve/reject with specific feedback)

### Milestone 1.4: Ralph Loop Orchestration

- [x] Implement RalphLoopManager to coordinate worker/reviewer cycles
- [x] Add loop termination conditions (max turns, approval, critical failure)
- [x] Create WebSocket events for loop progress (iteration_start, worker_complete, review_complete)
- [x] Implement graceful loop interruption and resume capability
- [x] Add loop history and metrics tracking

### Milestone 1.5: Ralph Loop API & WebSocket

- [x] Add REST API endpoints for Ralph Loop operations (start, stop, pause, resume, list, get, delete)
- [x] Add WebSocket message types for real-time updates (status, iteration, output, complete)
- [x] Integrate RalphLoopService with WebSocketServer
- [x] Add Ralph Loop API client methods in frontend
- [x] Add backend route tests
- [x] Add WebSocket integration tests

### Milestone 1.6: Ralph Loop Frontend UI

- [x] Create ralph-loop-module.js frontend module
- [x] Add Ralph Loop tab to project view
- [x] Implement task configuration form (description, max turns, model selection)
- [x] Add Start/Pause/Resume/Stop controls
- [x] Display real-time iteration progress
- [x] Show worker and reviewer output streams
- [x] Create Ralph Loop history view with delete functionality
- [x] Add comprehensive frontend tests

## Phase 2: Model Selection (Completed)

Allow users to choose which Claude model to use for agents, with proper session management.

### Milestone 2.1: Model Configuration Backend

- [x] Add model selection to SettingsRepository (default model preference)
- [x] Add per-project model override in ProjectRepository
- [x] Create model validation (supported models list from Claude API)
- [x] Update ClaudeAgent to accept model parameter via `--model` flag
- [x] Implement agent restart when model changes mid-session

### Milestone 2.2: Model Selection UI

- [x] Add model dropdown in global settings
- [x] Add model override option in project settings (header selector)
- [x] Display current model in agent status area (tooltip shows effective model)
- [x] Add model indicator in project header
- [x] Show toast notification when model changes

## Phase 3: Critical Security & Architecture Fixes (Completed)

Address critical security vulnerabilities and architectural improvements identified through comprehensive code quality analysis.

### Milestone 3.1: Security Vulnerability Fixes (Completed)

- [x] Fix path traversal vulnerability in src/routes/projects.ts
- [x] Fix shell command injection in src/agents/claude-agent.ts and Ralph Loop agents
- [x] Create comprehensive input validation middleware
- [x] Create project validation middleware for common patterns

### Milestone 3.2: Split Large Files (Completed)

Break down files exceeding 1000 lines to improve maintainability and adhere to CLAUDE.md guidelines.

- [x] Split src/agents/agent-manager.ts (1307 lines) into 5 focused modules:
  - [x] agent-manager.ts - Core lifecycle only (1011 lines, close to target)
  - [x] agent-queue.ts - Queue management
  - [x] session-manager.ts - Session handling
  - [x] autonomous-loop-orchestrator.ts - Loop logic
  - [x] process-tracker.ts - PID tracking
- [x] Split src/agents/claude-agent.ts (1714 lines) - Extract stream handling (now 642 lines)
- [x] Split src/routes/projects.ts (1979 lines) into 7 sub-routers:
  - [x] projects/index.ts - Router aggregator
  - [x] projects/core.ts - Core operations
  - [x] projects/roadmap.ts - Roadmap operations
  - [x] projects/agent.ts - Agent operations
  - [x] projects/conversation.ts - Conversation operations
  - [x] projects/ralph-loop.ts - Ralph Loop operations
  - [x] projects/shell.ts - Shell operations
  - [x] projects/git.ts - Git operations (18 routes discovered during refactoring)

### Milestone 3.3: Apply Validation Middleware ✓

Integrate the new validation middleware throughout the application.

- [x] Apply request validators to all POST/PUT endpoints
- [x] Apply project validator middleware to reduce duplication
- [x] Apply numeric parameter validation where needed
- [x] Add rate limiting middleware for expensive operations
- [x] Create comprehensive test suite for validation, project, and rate-limiting middleware
- [x] Create integration tests for route validation

## Phase 4: Code Quality Improvements (Completed)

Refactor code to meet quality standards and improve maintainability.

### Milestone 4.1: Refactor Large Functions ✓

Break down functions exceeding 50 lines as per CLAUDE.md guidelines.

- [x] Refactor handleStreamEvent in stream-handler.ts (159 lines)
  - [x] Create handler map pattern
  - [x] Extract each event type to its own method
- [x] Refactor startWithOptions() method in claude-agent.ts (60 lines)
  - [x] Extract validation logic into validateStart()
  - [x] Extract initialization logic into initializeForStart()
  - [x] Extract command preparation into prepareCommand()
  - [x] Extract process spawning logic into spawnClaudeProcess()
  - [x] Extract post-start tasks into handlePostStart()
- [x] Refactor Ralph Loop service methods exceeding 50 lines
  - [x] runWorkerPhase (95 lines) - split into validation, creation, and handler methods
  - [x] runReviewerPhase (95 lines) - split into validation, creation, and handler methods
  - [x] cleanupOldLoops (52 lines) - split into limit retrieval, filtering, and deletion

### Milestone 4.2: Extract Reusable Functions ✓

Eliminate code duplication by creating utility functions.

- [x] Create json-utils.ts - Safe JSON parsing/stringifying with error handling
- [x] Create file-system-utils.ts - Atomic writes, directory operations
- [x] Create path-utils.ts - Home directory resolution, cache keys, path building
- [x] Create operation-tracking.ts - PendingOperationsTracker and WriteQueueManager classes
- [x] Create timestamp.ts - ISO timestamp generation and formatting
- [x] Refactor conversation.ts repository to use new utilities
- [x] Update imports and exports in utils/index.ts

### Milestone 4.3: Create Repository Interfaces ✓

Establish proper interfaces for all repositories following CLAUDE.md guidelines.

- [x] Create interfaces.ts with all repository interfaces
  - [x] IProjectRepository
  - [x] IConversationRepository
  - [x] ISettingsRepository
  - [x] IRalphLoopRepository
  - [x] Consolidate duplicate ProjectPathResolver interfaces
- [x] Create factories.ts with repository factory implementations
  - [x] FileRepositoryFactory for production
  - [x] InMemoryRepositoryFactory for testing
  - [x] createMockRepositoryFactory helper for Jest
- [x] Fix circular dependencies and duplicate exports
- [x] Update repository index.ts exports

## Phase 5: Frontend Improvements

Enhance frontend code quality, fix memory leaks, and add proper testing.

### Milestone 5.1: Fix Memory Leaks

Address memory leaks in frontend JavaScript code.

- [ ] Track and cleanup event handlers in file-browser.js
- [ ] Fix WebSocket reconnection memory accumulation
- [ ] Implement proper cleanup for dynamic DOM elements
- [ ] Add cleanup for deeply nested file trees

### Milestone 5.2: Add Frontend Type Safety ✓

Improve frontend code maintainability with type definitions.

- [x] Create TypeScript definitions for all modules
- [x] Add JSDoc comments to all public functions
- [x] Document module dependencies and interfaces
- [x] Create type definitions for API responses

### Milestone 5.3: Frontend Testing

Establish comprehensive frontend testing infrastructure.

- [ ] Set up Jest for frontend testing
- [ ] Create unit tests for all modules (target 60% coverage)

## Phase 6: Documentation & Testing

Complete documentation and establish comprehensive testing coverage.

### Milestone 6.1: Documentation

Create and update documentation to reflect current state.

- [ ] Create ARCHITECTURE.md with system diagrams
- [ ] Create SECURITY.md with security considerations
- [ ] Update README.md with current features
- [ ] Add JSDoc comments to complex functions
- [ ] Create API documentation
- [ ] Document testing procedures

### Milestone 6.2: Backend Testing

Enhance backend test coverage to 80%+.

- [ ] Add missing unit tests for untested services
- [ ] Create integration tests for WebSocket communication
- [ ] Add tests for error handling paths
- [ ] Create performance benchmarks for critical paths

### Milestone 6.3: Monitoring & Metrics

Implement monitoring for production stability.

- [ ] Add performance metrics collection
- [ ] Implement error rate monitoring
- [ ] Create health check endpoints
- [ ] Add resource usage tracking
- [ ] Implement alerting for critical failures
