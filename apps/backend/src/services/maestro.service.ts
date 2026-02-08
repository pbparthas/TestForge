/**
 * Maestro Service
 * Handles registry sync from GitLab, caching, and YAML validation
 * for MaestroSmith agent
 */

import { parse as parseYaml } from 'yaml';
import { ValidationError } from '../errors/index.js';
import { validateExternalUrl } from '../utils/url-security.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface GitLabConfig {
  host: string;           // https://gitlab.com or self-hosted
  projectId: string;      // GitLab project ID
  branch: string;         // main
  jobName: string;        // extract-maestro-registry
  artifactPath: string;   // maestro_registry.json
  accessToken: string;    // GitLab token with read_api scope
}

export interface MaestroConfig {
  enabled: boolean;
  gitlab: GitLabConfig;
  defaultAppId: string;
}

export interface RegistryWidget {
  eventName: string;
  file: string;
  type?: string;
  label?: string;
}

export interface Registry {
  appId: string;
  version: string;
  generated: string;
  widgetCount: number;
  widgets: RegistryWidget[];
}

export interface SyncResult {
  success: boolean;
  widgetCount: number;
  version: string;
  fetchedAt: Date;
  error?: string;
}

export interface RegistryStatus {
  cached: boolean;
  version?: string;
  widgetCount?: number;
  fetchedAt?: Date;
  appId?: string;
}

export interface WidgetLookupResult {
  found: boolean;
  eventName?: string;
  file?: string;
  type?: string;
}

export interface YamlValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  appId?: string;
  commands?: string[];
}

export interface SelectorAnalysis {
  totalSelectors: number;
  idBased: number;
  textBased: number;
  warnings: string[];
}

// Valid Maestro commands
const MAESTRO_COMMANDS = new Set([
  'launchApp',
  'tapOn',
  'inputText',
  'assertVisible',
  'assertNotVisible',
  'scroll',
  'scrollUntilVisible',
  'swipe',
  'back',
  'hideKeyboard',
  'extendedWaitUntil',
  'repeat',
  'runFlow',
  'takeScreenshot',
  'setLocation',
  'openLink',
  'pressKey',
  'eraseText',
  'copyTextFrom',
  'pasteText',
  'evalScript',
  'startRecording',
  'stopRecording',
  'clearState',
  'clearKeychain',
  'runScript',
  'waitForAnimationToEnd',
  'assertTrue',
  'assertFalse',
  'assertHasText',
  'assertNoText',
  'assertCondition',
  'onFlowComplete',
  'onFlowStart',
]);

// =============================================================================
// Service
// =============================================================================

export class MaestroService {
  // In-memory cache: projectId -> { data, fetchedAt }
  private registryCache: Map<string, { data: Registry; fetchedAt: Date }> = new Map();

  // Config cache: projectId -> MaestroConfig (would be stored in DB in production)
  private configCache: Map<string, MaestroConfig> = new Map();

  /**
   * Set GitLab configuration for a project
   */
  setConfig(projectId: string, config: MaestroConfig): void {
    this.configCache.set(projectId, config);
    logger.info({ projectId, appId: config.defaultAppId }, 'Maestro config set');
  }

  /**
   * Get GitLab configuration for a project
   */
  getConfig(projectId: string): MaestroConfig | null {
    return this.configCache.get(projectId) ?? null;
  }

  /**
   * Fetch registry from GitLab artifact (manual sync)
   */
  async syncRegistry(projectId: string): Promise<SyncResult> {
    const config = this.configCache.get(projectId);

    if (!config) {
      return {
        success: false,
        widgetCount: 0,
        version: '',
        fetchedAt: new Date(),
        error: 'Maestro configuration not found for project',
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        widgetCount: 0,
        version: '',
        fetchedAt: new Date(),
        error: 'Maestro is not enabled for this project',
      };
    }

    const { gitlab } = config;

    try {
      // GitLab API endpoint for downloading job artifacts
      // https://docs.gitlab.com/ee/api/job_artifacts.html#download-a-single-artifact-file-by-job-name
      const url = `${gitlab.host}/api/v4/projects/${encodeURIComponent(gitlab.projectId)}/jobs/artifacts/${gitlab.branch}/raw/${gitlab.artifactPath}?job=${encodeURIComponent(gitlab.jobName)}`;

      logger.info({ projectId, url: url.replace(gitlab.accessToken, '***') }, 'Fetching registry from GitLab');

      validateExternalUrl(url);
      const response = await fetch(url, {
        headers: {
          'PRIVATE-TOKEN': gitlab.accessToken,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ projectId, status: response.status, error: errorText }, 'Failed to fetch registry');
        return {
          success: false,
          widgetCount: 0,
          version: '',
          fetchedAt: new Date(),
          error: `GitLab API error: ${response.status} - ${errorText}`,
        };
      }

      const registry: Registry = await response.json();

      // Validate registry structure
      if (!registry.appId || !registry.widgets || !Array.isArray(registry.widgets)) {
        return {
          success: false,
          widgetCount: 0,
          version: '',
          fetchedAt: new Date(),
          error: 'Invalid registry format: missing appId or widgets array',
        };
      }

      // Cache the registry
      const fetchedAt = new Date();
      this.registryCache.set(projectId, {
        data: registry,
        fetchedAt,
      });

      logger.info(
        { projectId, widgetCount: registry.widgets.length, version: registry.version },
        'Registry synced successfully'
      );

      return {
        success: true,
        widgetCount: registry.widgets.length,
        version: registry.version,
        fetchedAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ projectId, error: errorMessage }, 'Failed to sync registry');
      return {
        success: false,
        widgetCount: 0,
        version: '',
        fetchedAt: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Get cached registry for a project
   */
  getRegistry(projectId: string): Registry | null {
    const cached = this.registryCache.get(projectId);
    return cached?.data ?? null;
  }

  /**
   * Get registry status (for UI display)
   */
  getRegistryStatus(projectId: string): RegistryStatus {
    const cached = this.registryCache.get(projectId);
    if (!cached) {
      return { cached: false };
    }
    return {
      cached: true,
      version: cached.data.version,
      widgetCount: cached.data.widgets.length,
      fetchedAt: cached.fetchedAt,
      appId: cached.data.appId,
    };
  }

  /**
   * List all widgets in registry
   */
  getWidgets(projectId: string): RegistryWidget[] {
    const registry = this.getRegistry(projectId);
    return registry?.widgets ?? [];
  }

  /**
   * Lookup widget by eventName
   */
  lookupWidget(projectId: string, eventName: string): WidgetLookupResult {
    const registry = this.getRegistry(projectId);
    if (!registry) {
      return { found: false };
    }

    const widget = registry.widgets.find(w => w.eventName === eventName);
    if (!widget) {
      return { found: false };
    }

    return {
      found: true,
      eventName: widget.eventName,
      file: widget.file,
      type: widget.type,
    };
  }

  /**
   * Search widgets by partial eventName match
   */
  searchWidgets(projectId: string, query: string): RegistryWidget[] {
    const registry = this.getRegistry(projectId);
    if (!registry) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    return registry.widgets.filter(
      w => w.eventName.toLowerCase().includes(lowerQuery) ||
           (w.file && w.file.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Validate Maestro YAML syntax
   */
  validateYaml(yaml: string): YamlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let appId: string | undefined;
    const commands: string[] = [];

    try {
      // Split by document separator
      const parts = yaml.split(/^---$/m).map(p => p.trim()).filter(Boolean);

      if (parts.length === 0) {
        errors.push('Empty YAML content');
        return { valid: false, errors, warnings };
      }

      // First part should contain appId
      const header = parseYaml(parts[0]);

      if (typeof header === 'object' && header !== null && 'appId' in header) {
        appId = header.appId as string;
      } else if (typeof header === 'string' && header.startsWith('appId:')) {
        // Handle simple "appId: com.example.app" format
        appId = header.replace('appId:', '').trim();
      }

      if (!appId) {
        errors.push('Missing appId in YAML header');
      }

      // Parse commands section (second part after ---)
      if (parts.length > 1) {
        const commandsPart = parts.slice(1).join('\n---\n');
        const parsedCommands = parseYaml(commandsPart);

        if (Array.isArray(parsedCommands)) {
          for (const cmd of parsedCommands) {
            if (typeof cmd === 'string') {
              // Simple command like "- back"
              if (MAESTRO_COMMANDS.has(cmd)) {
                commands.push(cmd);
              } else {
                warnings.push(`Unknown command: ${cmd}`);
              }
            } else if (typeof cmd === 'object' && cmd !== null) {
              // Command with parameters like "- tapOn: { id: 'btn' }"
              const cmdName = Object.keys(cmd)[0];
              if (MAESTRO_COMMANDS.has(cmdName)) {
                commands.push(cmdName);
              } else {
                warnings.push(`Unknown command: ${cmdName}`);
              }
            }
          }
        }
      } else {
        warnings.push('No commands found after appId header');
      }

    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      errors.push(`YAML parse error: ${errorMessage}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      appId,
      commands: [...new Set(commands)], // Unique commands
    };
  }

  /**
   * Analyze selectors in YAML - check if using id vs text
   */
  analyzeSelectors(projectId: string, yaml: string): SelectorAnalysis {
    const warnings: string[] = [];
    let totalSelectors = 0;
    let idBased = 0;
    let textBased = 0;

    const registry = this.getRegistry(projectId);

    try {
      const parts = yaml.split(/^---$/m).map(p => p.trim()).filter(Boolean);

      if (parts.length > 1) {
        const commandsPart = parts.slice(1).join('\n---\n');
        const parsedCommands = parseYaml(commandsPart);

        if (Array.isArray(parsedCommands)) {
          for (const cmd of parsedCommands) {
            if (typeof cmd === 'object' && cmd !== null) {
              const cmdName = Object.keys(cmd)[0];
              const cmdValue = cmd[cmdName];

              // Check selector-based commands
              if (['tapOn', 'assertVisible', 'assertNotVisible', 'scrollUntilVisible'].includes(cmdName)) {
                totalSelectors++;

                if (typeof cmdValue === 'string') {
                  // Text-based selector
                  textBased++;
                  warnings.push(`Text-based selector used: "${cmdValue}" - consider using id for reliability`);
                } else if (typeof cmdValue === 'object' && cmdValue !== null) {
                  if ('id' in cmdValue) {
                    idBased++;
                    // Check if id exists in registry
                    if (registry) {
                      const exists = registry.widgets.some(w => w.eventName === cmdValue.id);
                      if (!exists) {
                        warnings.push(`ID "${cmdValue.id}" not found in registry`);
                      }
                    }
                  } else if ('text' in cmdValue) {
                    textBased++;
                    warnings.push(`Text-based selector: "${cmdValue.text}"`);
                  } else {
                    idBased++; // Assume other object formats are id-based
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      warnings.push('Failed to analyze selectors due to YAML parse error');
    }

    return {
      totalSelectors,
      idBased,
      textBased,
      warnings,
    };
  }

  /**
   * Get list of available Maestro commands (for reference)
   */
  getMaestroCommands(): Array<{ name: string; description: string; example: string }> {
    return [
      { name: 'launchApp', description: 'Start the app', example: '- launchApp: { clearState: true }' },
      { name: 'tapOn', description: 'Tap on element', example: '- tapOn: { id: "login_btn" }' },
      { name: 'inputText', description: 'Enter text', example: '- inputText: "hello"' },
      { name: 'assertVisible', description: 'Check element is visible', example: '- assertVisible: "Welcome"' },
      { name: 'assertNotVisible', description: 'Check element is not visible', example: '- assertNotVisible: "Loading"' },
      { name: 'scroll', description: 'Scroll in direction', example: '- scroll: { direction: DOWN }' },
      { name: 'scrollUntilVisible', description: 'Scroll until element found', example: '- scrollUntilVisible: { element: { id: "item" } }' },
      { name: 'swipe', description: 'Swipe gesture', example: '- swipe: { direction: LEFT }' },
      { name: 'back', description: 'Android back button', example: '- back' },
      { name: 'hideKeyboard', description: 'Dismiss keyboard', example: '- hideKeyboard' },
      { name: 'extendedWaitUntil', description: 'Wait with timeout', example: '- extendedWaitUntil: { visible: "X", timeout: 5000 }' },
      { name: 'repeat', description: 'Repeat commands', example: '- repeat: { times: 3, commands: [...] }' },
      { name: 'runFlow', description: 'Include sub-flow', example: '- runFlow: { file: login.yaml }' },
      { name: 'takeScreenshot', description: 'Capture screenshot', example: '- takeScreenshot: "step1"' },
      { name: 'setLocation', description: 'Mock GPS location', example: '- setLocation: { lat: 12.97, lng: 77.59 }' },
    ];
  }

  /**
   * Clear cached registry for a project
   */
  clearCache(projectId: string): void {
    this.registryCache.delete(projectId);
    logger.info({ projectId }, 'Registry cache cleared');
  }

  /**
   * Clear all cached registries
   */
  clearAllCaches(): void {
    this.registryCache.clear();
    logger.info('All registry caches cleared');
  }
}

// Export singleton instance
export const maestroService = new MaestroService();
