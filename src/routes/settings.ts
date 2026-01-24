import { Router, Request, Response } from 'express';
import { SettingsRepository, ClaudePermissions } from '../repositories';
import { asyncHandler, ValidationError } from '../utils';

interface UpdateSettingsBody {
  maxConcurrentAgents?: number;
  claudePermissions?: Partial<ClaudePermissions>;
  agentPromptTemplate?: string;
  sendWithCtrlEnter?: boolean;
  historyLimit?: number;
}

export interface SettingsRouterDependencies {
  settingsRepository: SettingsRepository;
  onSettingsChange?: (settings: { maxConcurrentAgents: number }) => void;
}

export function createSettingsRouter(deps: SettingsRouterDependencies): Router {
  const router = Router();
  const { settingsRepository, onSettingsChange } = deps;

  router.get('/', asyncHandler(async (_req: Request, res: Response) => {
    const settings = await settingsRepository.get();
    res.json(settings);
  }));

  router.put('/', asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UpdateSettingsBody;
    const { maxConcurrentAgents, claudePermissions, agentPromptTemplate, sendWithCtrlEnter, historyLimit } = body;

    if (maxConcurrentAgents !== undefined && (typeof maxConcurrentAgents !== 'number' || maxConcurrentAgents < 1)) {
      throw new ValidationError('maxConcurrentAgents must be a positive number');
    }

    if (claudePermissions) {
      validatePermissionRules(claudePermissions.allowRules, 'allowRules');
      validatePermissionRules(claudePermissions.denyRules, 'denyRules');
      validatePermissionRules(claudePermissions.askRules, 'askRules');
    }

    const updated = await settingsRepository.update({
      maxConcurrentAgents,
      claudePermissions,
      agentPromptTemplate,
      sendWithCtrlEnter,
      historyLimit,
    });

    if (onSettingsChange && maxConcurrentAgents !== undefined) {
      onSettingsChange({ maxConcurrentAgents });
    }

    res.json(updated);
  }));

  return router;
}

function validatePermissionRules(rules: string[] | undefined, fieldName: string): void {
  if (!rules) return;

  if (!Array.isArray(rules)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  for (const rule of rules) {
    if (typeof rule !== 'string') {
      throw new ValidationError(`${fieldName} must contain only strings`);
    }

    if (!isValidPermissionRule(rule)) {
      throw new ValidationError(`Invalid permission rule in ${fieldName}: "${rule}"`);
    }
  }
}

function isValidPermissionRule(rule: string): boolean {
  if (!rule || rule.length === 0) return false;

  // Valid formats: "Tool" or "Tool(specifier)"
  const simpleToolPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
  const toolWithSpecifierPattern = /^[A-Za-z][A-Za-z0-9_]*\(.+\)$/;

  return simpleToolPattern.test(rule) || toolWithSpecifierPattern.test(rule);
}
