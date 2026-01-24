# Claudito Roadmap

## Phase 1: Security & Permissions

### Milestone 1.1: Global Permission Configuration

Replace `--dangerously-skip-permissions` with proper permission management.

- [x] Design permission model for Claude agent operations (file read/write, bash commands, etc.)
- [x] Create permissions configuration schema in global settings
- [x] Add UI for managing global permission rules
- [x] Implement permission file generation for Claude Code CLI (`--allowedTools` and `--disallowedTools` flags)
- [x] Update AgentManager to use permission arguments instead of `--dangerously-skip-permissions`
- [x] Add per-project permission overrides option
- [x] Document permission configuration in README

## Phase 2: Autonomous Agent Implementation

### Milestone 2.1: Core Autonomous Loop

Implement the autonomous agent that processes roadmap items automatically.

- [ ] Define autonomous loop state machine (idle, running, paused, waiting-for-input)
- [ ] Implement item selection logic (nextItem from status.json or first incomplete)
- [ ] Create conversation management for autonomous sessions
- [ ] Implement instruction generation from agentPromptTemplate
- [ ] Parse agent JSON responses ({ status: "COMPLETE"|"FAILED", reason })
- [ ] Handle COMPLETE status: mark item done, continue to next
- [ ] Handle FAILED status: pause loop, emit itemFailed event
- [ ] Add loop progress tracking and WebSocket updates

### Milestone 2.2: Autonomous Agent UI

- [ ] Add autonomous mode toggle in project view
- [ ] Display current item being processed
- [ ] Show loop progress (items completed / total)
- [ ] Add pause/resume controls
- [ ] Display failure reasons when loop pauses
- [ ] Add retry failed item button
- [ ] Show estimated context usage per item

### Milestone 2.3: Autonomous Agent Reliability

- [ ] Implement graceful handling of agent crashes
- [ ] Add timeout handling for stuck agents
- [ ] Create recovery mechanism for interrupted loops
- [ ] Add logging for autonomous loop events
- [ ] Implement rate limiting between items
