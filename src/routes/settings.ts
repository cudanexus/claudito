import { Router, Request, Response } from 'express';
import { SettingsRepository, ClaudePermissions, PromptTemplate } from '../repositories';
import { asyncHandler, ValidationError } from '../utils';

interface UpdateSettingsBody {
  maxConcurrentAgents?: number;
  claudePermissions?: Partial<ClaudePermissions>;
  agentPromptTemplate?: string;
  sendWithCtrlEnter?: boolean;
  historyLimit?: number;
  enableDesktopNotifications?: boolean;
  appendSystemPrompt?: string;
  promptTemplates?: PromptTemplate[];
}

export interface SettingsChangeEvent {
  maxConcurrentAgents?: number;
  appendSystemPromptChanged?: boolean;
}

export interface SettingsRouterDependencies {
  settingsRepository: SettingsRepository;
  onSettingsChange?: (event: SettingsChangeEvent) => void;
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
    const { maxConcurrentAgents, claudePermissions, agentPromptTemplate, sendWithCtrlEnter, historyLimit, enableDesktopNotifications, appendSystemPrompt, promptTemplates } = body;

    if (maxConcurrentAgents !== undefined && (typeof maxConcurrentAgents !== 'number' || maxConcurrentAgents < 1)) {
      throw new ValidationError('maxConcurrentAgents must be a positive number');
    }

    if (claudePermissions) {
      validatePermissionRules(claudePermissions.allowRules, 'allowRules');
      validatePermissionRules(claudePermissions.denyRules, 'denyRules');
      validatePermissionRules(claudePermissions.askRules, 'askRules');
    }

    if (promptTemplates !== undefined) {
      validatePromptTemplates(promptTemplates);
    }

    // Get current settings to detect changes
    const currentSettings = await settingsRepository.get();
    const appendSystemPromptChanged = appendSystemPrompt !== undefined &&
      appendSystemPrompt !== currentSettings.appendSystemPrompt;

    const updated = await settingsRepository.update({
      maxConcurrentAgents,
      claudePermissions,
      agentPromptTemplate,
      sendWithCtrlEnter,
      historyLimit,
      enableDesktopNotifications,
      appendSystemPrompt,
      promptTemplates,
    });

    // Notify about settings changes
    if (onSettingsChange) {
      const changeEvent: SettingsChangeEvent = {};

      if (maxConcurrentAgents !== undefined) {
        changeEvent.maxConcurrentAgents = maxConcurrentAgents;
      }

      if (appendSystemPromptChanged) {
        changeEvent.appendSystemPromptChanged = true;
      }

      if (Object.keys(changeEvent).length > 0) {
        onSettingsChange(changeEvent);
      }
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

function validatePromptTemplates(templates: unknown): void {
  if (!Array.isArray(templates)) {
    throw new ValidationError('promptTemplates must be an array');
  }

  const seenIds = new Set<string>();

  for (const template of templates) {
    if (typeof template !== 'object' || template === null) {
      throw new ValidationError('Each template must be an object');
    }

    const t = template as Record<string, unknown>;

    if (typeof t.id !== 'string' || t.id.trim().length === 0) {
      throw new ValidationError('Each template must have a non-empty id');
    }

    if (seenIds.has(t.id)) {
      throw new ValidationError(`Duplicate template id: ${t.id}`);
    }
    seenIds.add(t.id);

    if (typeof t.name !== 'string' || t.name.trim().length === 0) {
      throw new ValidationError('Each template must have a non-empty name');
    }

    if (typeof t.content !== 'string') {
      throw new ValidationError('Each template must have content');
    }

    if (t.description !== undefined && typeof t.description !== 'string') {
      throw new ValidationError('Template description must be a string');
    }
  }
}
