/**
 * Maestro Service Tests
 * TDD for MaestroSmith registry sync, caching, and YAML validation
 */

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Mock global fetch
global.fetch = mockFetch;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaestroService } from '../../../src/services/maestro.service.js';
import type { MaestroConfig, Registry } from '../../../src/services/maestro.service.js';

describe('MaestroService', () => {
  let service: MaestroService;

  const mockConfig: MaestroConfig = {
    enabled: true,
    gitlab: {
      host: 'https://gitlab.com',
      projectId: '12345',
      branch: 'main',
      jobName: 'extract-maestro-registry',
      artifactPath: 'maestro_registry.json',
      accessToken: 'test-token',
    },
    defaultAppId: 'com.bankbazaar.app',
  };

  const mockRegistry: Registry = {
    appId: 'com.bankbazaar.app',
    version: 'abc123',
    generated: '2026-02-02T12:00:00Z',
    widgetCount: 3,
    widgets: [
      { eventName: 'Login', file: 'auth/login_screen.dart', type: 'TextField' },
      { eventName: 'LoginAttempt', file: 'auth/login_screen.dart', type: 'Button' },
      { eventName: 'home_check_score_cta', file: 'home/home_body.dart', type: 'Button' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MaestroService();
  });

  describe('Config Management', () => {
    it('should set and get config for a project', () => {
      service.setConfig('proj-123', mockConfig);
      const config = service.getConfig('proj-123');
      expect(config).toEqual(mockConfig);
    });

    it('should return null for unconfigured project', () => {
      const config = service.getConfig('unknown-project');
      expect(config).toBeNull();
    });
  });

  describe('syncRegistry', () => {
    it('should fetch registry from GitLab and cache it', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      const result = await service.syncRegistry('proj-123');

      expect(result.success).toBe(true);
      expect(result.widgetCount).toBe(3);
      expect(result.version).toBe('abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gitlab.com/api/v4/projects/12345/jobs/artifacts/main'),
        expect.objectContaining({
          headers: { 'PRIVATE-TOKEN': 'test-token' },
        })
      );
    });

    it('should return error when config not found', async () => {
      const result = await service.syncRegistry('unknown-project');
      expect(result.success).toBe(false);
      expect(result.error).toContain('configuration not found');
    });

    it('should return error when Maestro is disabled', async () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      service.setConfig('proj-123', disabledConfig);

      const result = await service.syncRegistry('proj-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('should handle GitLab API errors', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Artifact not found',
      });

      const result = await service.syncRegistry('proj-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle invalid registry format', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'format' }),
      });

      const result = await service.syncRegistry('proj-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid registry format');
    });

    it('should handle fetch errors', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.syncRegistry('proj-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('getRegistry', () => {
    it('should return cached registry', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await service.syncRegistry('proj-123');
      const registry = service.getRegistry('proj-123');

      expect(registry).toEqual(mockRegistry);
    });

    it('should return null when no cached registry', () => {
      const registry = service.getRegistry('unknown-project');
      expect(registry).toBeNull();
    });
  });

  describe('getRegistryStatus', () => {
    it('should return status for cached registry', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await service.syncRegistry('proj-123');
      const status = service.getRegistryStatus('proj-123');

      expect(status.cached).toBe(true);
      expect(status.version).toBe('abc123');
      expect(status.widgetCount).toBe(3);
      expect(status.appId).toBe('com.bankbazaar.app');
      expect(status.fetchedAt).toBeInstanceOf(Date);
    });

    it('should return uncached status when no registry', () => {
      const status = service.getRegistryStatus('unknown-project');
      expect(status.cached).toBe(false);
      expect(status.version).toBeUndefined();
    });
  });

  describe('lookupWidget', () => {
    beforeEach(async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });
      await service.syncRegistry('proj-123');
    });

    it('should find widget by eventName', () => {
      const result = service.lookupWidget('proj-123', 'LoginAttempt');
      expect(result.found).toBe(true);
      expect(result.eventName).toBe('LoginAttempt');
      expect(result.file).toBe('auth/login_screen.dart');
      expect(result.type).toBe('Button');
    });

    it('should return not found for unknown eventName', () => {
      const result = service.lookupWidget('proj-123', 'UnknownWidget');
      expect(result.found).toBe(false);
    });

    it('should return not found when no registry', () => {
      const result = service.lookupWidget('unknown-project', 'LoginAttempt');
      expect(result.found).toBe(false);
    });
  });

  describe('searchWidgets', () => {
    beforeEach(async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });
      await service.syncRegistry('proj-123');
    });

    it('should search widgets by eventName', () => {
      const results = service.searchWidgets('proj-123', 'Login');
      expect(results).toHaveLength(2);
      expect(results[0].eventName).toBe('Login');
      expect(results[1].eventName).toBe('LoginAttempt');
    });

    it('should search widgets by file path', () => {
      const results = service.searchWidgets('proj-123', 'home_body');
      expect(results).toHaveLength(1);
      expect(results[0].eventName).toBe('home_check_score_cta');
    });

    it('should return empty array when no matches', () => {
      const results = service.searchWidgets('proj-123', 'xyz');
      expect(results).toHaveLength(0);
    });
  });

  describe('validateYaml', () => {
    it('should validate correct Maestro YAML', () => {
      const yaml = `appId: com.bankbazaar.app
---
- launchApp:
    clearState: true
- tapOn:
    id: login_btn
- inputText: "test@example.com"
- assertVisible: "Welcome"`;

      const result = service.validateYaml(yaml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.appId).toBe('com.bankbazaar.app');
      expect(result.commands).toContain('launchApp');
      expect(result.commands).toContain('tapOn');
      expect(result.commands).toContain('inputText');
      expect(result.commands).toContain('assertVisible');
    });

    it('should report missing appId', () => {
      const yaml = `---
- launchApp
- tapOn: "Login"`;

      const result = service.validateYaml(yaml);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing appId in YAML header');
    });

    it('should report empty YAML', () => {
      const result = service.validateYaml('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty YAML content');
    });

    it('should warn about unknown commands', () => {
      const yaml = `appId: com.example.app
---
- launchApp
- unknownCommand: "test"`;

      const result = service.validateYaml(yaml);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown command: unknownCommand');
    });

    it('should handle YAML parse errors', () => {
      const yaml = `appId: com.example.app
---
- invalid: yaml: structure: here`;

      const result = service.validateYaml(yaml);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('YAML parse error');
    });
  });

  describe('analyzeSelectors', () => {
    beforeEach(async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });
      await service.syncRegistry('proj-123');
    });

    it('should count id-based and text-based selectors', () => {
      const yaml = `appId: com.example.app
---
- tapOn:
    id: LoginAttempt
- tapOn: "Submit Button"
- assertVisible:
    id: home_check_score_cta
- assertVisible: "Welcome"`;

      const result = service.analyzeSelectors('proj-123', yaml);
      expect(result.totalSelectors).toBe(4);
      expect(result.idBased).toBe(2);
      expect(result.textBased).toBe(2);
    });

    it('should warn about text-based selectors', () => {
      const yaml = `appId: com.example.app
---
- tapOn: "Login"`;

      const result = service.analyzeSelectors('proj-123', yaml);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Text-based selector');
    });

    it('should warn about unknown IDs', () => {
      const yaml = `appId: com.example.app
---
- tapOn:
    id: unknown_widget_id`;

      const result = service.analyzeSelectors('proj-123', yaml);
      expect(result.warnings.some(w => w.includes('not found in registry'))).toBe(true);
    });
  });

  describe('getMaestroCommands', () => {
    it('should return list of Maestro commands', () => {
      const commands = service.getMaestroCommands();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.find(c => c.name === 'tapOn')).toBeDefined();
      expect(commands.find(c => c.name === 'launchApp')).toBeDefined();
      expect(commands[0]).toHaveProperty('name');
      expect(commands[0]).toHaveProperty('description');
      expect(commands[0]).toHaveProperty('example');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });
      await service.syncRegistry('proj-123');
    });

    it('should clear cache for specific project', () => {
      expect(service.getRegistry('proj-123')).not.toBeNull();
      service.clearCache('proj-123');
      expect(service.getRegistry('proj-123')).toBeNull();
    });

    it('should clear all caches', async () => {
      // Add another project
      service.setConfig('proj-456', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });
      await service.syncRegistry('proj-456');

      expect(service.getRegistry('proj-123')).not.toBeNull();
      expect(service.getRegistry('proj-456')).not.toBeNull();

      service.clearAllCaches();

      expect(service.getRegistry('proj-123')).toBeNull();
      expect(service.getRegistry('proj-456')).toBeNull();
    });
  });

  describe('getWidgets', () => {
    it('should return all widgets from registry', async () => {
      service.setConfig('proj-123', mockConfig);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });
      await service.syncRegistry('proj-123');

      const widgets = service.getWidgets('proj-123');
      expect(widgets).toHaveLength(3);
    });

    it('should return empty array when no registry', () => {
      const widgets = service.getWidgets('unknown-project');
      expect(widgets).toEqual([]);
    });
  });
});
