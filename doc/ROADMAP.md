# Claudito Roadmap

## Phase 1: Ralph Loop Implementation

Implement the Ralph Loop pattern based on Geoffrey Huntley's Ralph Wiggum technique - an iterative development pattern that solves context accumulation by starting each iteration with fresh context and using cross-model review.

### Milestone 1.1: Ralph Loop Core Architecture

- [ ] Design RalphLoop service interface with worker/reviewer model separation
- [ ] Create iteration state persistence layer (summary files, feedback files)
- [ ] Implement fresh context initialization for each iteration
- [ ] Add iteration tracking with configurable max turns
- [ ] Create RalphLoopConfig interface (maxTurns, workerModel, reviewerModel, taskDescription)

### Milestone 1.2: Worker Agent Implementation

- [ ] Create WorkerAgent class that reads previous iteration summaries
- [ ] Implement task execution with summary generation after each iteration
- [ ] Add structured output format for iteration results
- [ ] Create file persistence for worker summaries (`.claudito/ralph/{taskId}/worker-summary.json`)
- [ ] Implement worker completion detection (success/failure/needs-review)

### Milestone 1.3: Reviewer Agent Implementation

- [ ] Create ReviewerAgent class that reads worker output and previous feedback
- [ ] Implement code review logic with structured feedback format
- [ ] Add review criteria configuration (correctness, completeness, code quality)
- [ ] Create file persistence for reviewer feedback (`.claudito/ralph/{taskId}/reviewer-feedback.json`)
- [ ] Implement review decision output (approve/reject with specific feedback)

### Milestone 1.4: Ralph Loop Orchestration

- [ ] Implement RalphLoopManager to coordinate worker/reviewer cycles
- [ ] Add loop termination conditions (max turns, approval, critical failure)
- [ ] Create WebSocket events for loop progress (iteration_start, worker_complete, review_complete)
- [ ] Implement graceful loop interruption and resume capability
- [ ] Add loop history and metrics tracking

## Phase 2: Model Selection

Allow users to choose which Claude model to use for agents, with proper session management.

### Milestone 2.1: Model Configuration Backend

- [ ] Add model selection to SettingsRepository (default model preference)
- [ ] Add per-project model override in ProjectRepository
- [ ] Create model validation (supported models list from Claude API)
- [ ] Update ClaudeAgent to accept model parameter via `--model` flag
- [ ] Implement agent restart when model changes mid-session

### Milestone 2.2: Model Selection UI

- [ ] Add model dropdown in global settings
- [ ] Add model override option in project settings
- [ ] Display current model in agent status area
- [ ] Add model indicator in conversation header
- [ ] Show model change confirmation dialog (warns about agent restart)

### Milestone 2.3: Ralph Loop Model Configuration

- [ ] Add separate model selection for worker and reviewer agents
- [ ] Create UI for Ralph Loop model configuration
- [ ] Add cost estimation display based on model selection
- [ ] Implement model-specific token limit awareness

## Phase 3: Enhanced Autonomous Loop

Improve the existing autonomous loop with better controls and reliability.

### Milestone 3.1: Autonomous Loop Controls

- [ ] Add Start/Pause/Resume controls in project view
- [ ] Display current milestone and task being processed
- [ ] Show loop progress indicator (completed/total items)
- [ ] Add estimated context usage per item
- [ ] Implement loop scheduling (delay between items)

### Milestone 3.2: Autonomous Loop Reliability

- [ ] Implement graceful handling of agent crashes during loop
- [ ] Add configurable timeout handling for stuck agents
- [ ] Create recovery mechanism for interrupted loops
- [ ] Add option to skip failed items and continue
- [ ] Implement automatic retry with exponential backoff

### Milestone 3.3: Loop Feedback and History

- [ ] Display failure reasons with actionable suggestions
- [ ] Add Retry Failed Item button with optional prompt modification
- [ ] Show milestone completion notifications
- [ ] Create loop execution history view
- [ ] Add loop analytics (success rate, average duration per item)

## Phase 4: Conversation Management

Enhanced conversation features for better workflow management.

### Milestone 4.1: Export/Import Conversations

- [ ] Export conversation to Markdown format
- [ ] Export conversation to JSON format (full metadata)
- [ ] Import conversation from JSON
- [ ] Export all project conversations as archive
- [ ] Add selective export (filter by date range, tags)

### Milestone 4.2: Conversation Organization

- [ ] Add conversation tagging system
- [ ] Implement conversation search with filters
- [ ] Add conversation favorites/pinning
- [ ] Create conversation templates from existing conversations
- [ ] Add bulk conversation management (delete, archive, export)

## Phase 5: Agent Configuration Presets

Quick-start configurations for common development tasks.

### Milestone 5.1: Preset System

- [ ] Design preset schema (name, model, permission mode, system prompt, rules)
- [ ] Create PresetRepository for persistence
- [ ] Add built-in presets (Code Review, Bug Fix, Refactoring, Testing)
- [ ] Implement preset selection when starting agent
- [ ] Add preset indicator in agent status

### Milestone 5.2: Custom Presets

- [ ] Create preset editor UI
- [ ] Implement "Save current settings as preset" functionality
- [ ] Add preset import/export (JSON format)
- [ ] Create per-project default preset setting
- [ ] Add preset quick-switch keyboard shortcut

## Phase 6: Multi-Project Dashboard

Centralized view for managing multiple projects.

### Milestone 6.1: Dashboard View

- [ ] Create dashboard showing all projects with status
- [ ] Display agent status indicator for each project
- [ ] Show recent activity summary per project
- [ ] Add quick actions (start/stop agent, open project)
- [ ] Implement project filtering and sorting

### Milestone 6.2: Cross-Project Features

- [ ] Search conversations across all projects
- [ ] Global agent management (stop all, status overview)
- [ ] Project grouping/folders for organization
- [ ] Cross-project analytics (total usage, activity trends)
