import { Router } from 'express';
import { createCoreRouter } from './core';
import { createRoadmapRouter } from './roadmap';
import { createAgentRouter } from './agent';
import { createConversationRouter } from './conversation';
import { createShellRouter } from './shell';
import { createRalphLoopRouter } from './ralph-loop';
import { createGitRouter } from './git';
import { createOptimizationRouter } from './optimization';

// Re-export types for backward compatibility
export * from './types';
export * from './helpers';

export function createProjectsRouter(deps: ProjectRouterDependencies): Router {
  const router = Router();

  // Mount sub-routers
  // Core routes are mounted at root level
  router.use('/', createCoreRouter(deps));

  // Mount specific feature routers under their paths
  router.use('/:id/roadmap', createRoadmapRouter(deps));
  router.use('/:id/agent', createAgentRouter(deps));
  router.use('/:id/conversation', createConversationRouter(deps));
  router.use('/:id/conversations', createConversationRouter(deps));
  router.use('/:id/shell', createShellRouter(deps));
  router.use('/:id/ralph-loop', createRalphLoopRouter(deps));
  router.use('/:id/git', createGitRouter(deps));
  router.use('/:id', createOptimizationRouter(deps));

  return router;
}

// Import type from local file to avoid circular dependency
import { ProjectRouterDependencies } from './types';