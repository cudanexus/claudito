import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '../../utils';
import { validateBody } from '../../middleware/validation';
import { ClaudeOptimizationService } from '../../services';

// Request schema
const optimizeFileSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  content: z.string().min(1, 'Content is required'),
  optimizationGoals: z.array(z.string()).optional()
});

type OptimizeFileBody = z.infer<typeof optimizeFileSchema>;

interface OptimizationRouterDependencies {
  optimizationService?: ClaudeOptimizationService;
}

export function createOptimizationRouter(deps: OptimizationRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { optimizationService } = deps;

  if (!optimizationService) {
    // Return empty router if optimization service is not available
    return router;
  }

  // Optimize a file
  router.post('/optimize-file',
    validateBody(optimizeFileSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = req.params['id'] as string;
      const body = req.body as OptimizeFileBody;

      // Check if optimization is already running
      if (optimizationService.isOptimizing(projectId)) {
        throw new ValidationError('Optimization is already in progress for this project');
      }

      // Start optimization in background
      const optimizationPromise = optimizationService.optimizeFile({
        projectId,
        filePath: body.filePath,
        content: body.content,
        optimizationGoals: body.optimizationGoals
      });

      // Return immediately with success
      res.json({
        success: true,
        message: 'Optimization started'
      });

      // Handle optimization completion in background
      optimizationPromise.then(result => {
        // Result will be emitted via WebSocket
        if (result.success) {
          console.log(`Optimization completed for project ${projectId}`);
        } else {
          console.error(`Optimization failed for project ${projectId}: ${result.error}`);
        }
      }).catch(error => {
        console.error(`Optimization error for project ${projectId}:`, error);
      });
    })
  );

  // Get optimization status
  router.get('/optimization-status', asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params['id'] as string;

    res.json({
      isOptimizing: optimizationService.isOptimizing(projectId)
    });
  }));

  return router;
}