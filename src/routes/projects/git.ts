import { Router, Request, Response } from 'express';
import { asyncHandler, NotFoundError } from '../../utils';
import {
  ProjectRouterDependencies,
  GitStageBody,
  GitCommitBody,
  GitBranchBody,
  GitCheckoutBody,
  GitPushBody,
  GitPullBody,
  GitTagBody,
  GitPushTagBody
} from './types';
import { ProjectStatus } from '../../repositories';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation';
import { validateProjectExists } from '../../middleware/project';
import {
  gitStageSchema,
  gitCommitSchema,
  gitBranchSchema,
  gitCheckoutSchema,
  gitPushSchema,
  gitPullSchema,
  gitTagSchema,
  gitPushTagSchema,
  tagNameSchema,
  projectAndTagNameSchema,
  fileDiffQuerySchema
} from './schemas';

export function createGitRouter(deps: ProjectRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const {
    projectRepository,
    gitService,
  } = deps;

  // Get git status
  router.get('/status', validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;

    const status = await gitService.getStatus((project as ProjectStatus).path);
    res.json(status);
  }));

  // Get git branches
  router.get('/branches', validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;

    const branches = await gitService.getBranches((project as ProjectStatus).path);
    res.json(branches);
  }));

  // Get git diff
  router.get('/diff', validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;
    const staged = req.query.staged === 'true';

    const diff = await gitService.getDiff((project as ProjectStatus).path, staged);
    res.json({ diff });
  }));

  // Stage specific files
  router.post('/stage', validateBody(gitStageSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;
    const body = req.body as GitStageBody;
    const { paths } = body;

    await gitService.stageFiles((project as ProjectStatus).path, paths!);
    res.json({ success: true });
  }));

  // Stage all files
  router.post('/stage-all', validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;

    await gitService.stageAll((project as ProjectStatus).path);
    res.json({ success: true });
  }));

  // Unstage specific files
  router.post('/unstage', validateBody(gitStageSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;
    const body = req.body as GitStageBody;
    const { paths } = body;

    await gitService.unstageFiles((project as ProjectStatus).path, paths!);
    res.json({ success: true });
  }));

  // Unstage all files
  router.post('/unstage-all', validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;

    await gitService.unstageAll((project as ProjectStatus).path);
    res.json({ success: true });
  }));

  // Create a commit
  router.post('/commit', validateBody(gitCommitSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const body = req.body as GitCommitBody;
    const { message } = body;


    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    const result = await gitService.commit((project).path, message!);
    res.json(result);
  }));

  // Create a new branch
  router.post('/branch', validateBody(gitBranchSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const body = req.body as GitBranchBody;
    const { name, checkout } = body;


    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    await gitService.createBranch((project).path, name!, checkout);
    res.json({ success: true });
  }));

  // Checkout a branch
  router.post('/checkout', validateBody(gitCheckoutSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const body = req.body as GitCheckoutBody;
    const { branch } = body;


    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    await gitService.checkout((project).path, branch!);
    res.json({ success: true });
  }));

  // Push to remote
  router.post('/push', validateBody(gitPushSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const body = req.body as GitPushBody;
    const { remote = 'origin', branch, setUpstream } = body;

    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    const result = await gitService.push((project).path, remote, branch, setUpstream);
    res.json(result);
  }));

  // Pull from remote
  router.post('/pull', validateBody(gitPullSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const body = req.body as GitPullBody;
    const { remote = 'origin', branch } = body;

    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    const result = await gitService.pull((project).path, remote, branch);
    res.json(result);
  }));

  // Get file diff
  router.get('/file-diff', validateQuery(fileDiffQuerySchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const filePath = req.query['path'] as string;
    const staged = req.query['staged'] === 'true';


    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    const diff = await gitService.getFileDiff((project).path, filePath, staged);
    res.json({ filePath, diff });
  }));

  // Discard changes to specific files
  router.post('/discard', validateBody(gitStageSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;
    const body = req.body as GitStageBody;
    const { paths } = body;

    await gitService.discardChanges((project as ProjectStatus).path, paths!);
    res.json({ success: true });
  }));

  // List tags
  router.get('/tags', validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const project = req.project!;

    const tags = await gitService.listTags((project as ProjectStatus).path);
    res.json({ tags });
  }));

  // Create a tag
  router.post('/tags', validateBody(gitTagSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const body = req.body as GitTagBody;
    const { name, message } = body;


    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    await gitService.createTag((project).path, name, message);
    res.json({ success: true });
  }));

  // Push a tag to remote
  router.post('/tags/:name/push', validateParams(projectAndTagNameSchema), validateBody(gitPushTagSchema), validateProjectExists(projectRepository), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const tagName = req.params['name'] as string;
    const body = req.body as GitPushTagBody;
    const { remote = 'origin' } = body;

    const project = await projectRepository.findById(id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    await gitService.pushTag((project).path, tagName, remote);
    res.json({ success: true });
  }));

  return router;
}