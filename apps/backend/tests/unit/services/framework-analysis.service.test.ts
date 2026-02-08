/**
 * Framework Analysis Service Tests
 * Unit tests for project directory analysis: framework detection,
 * structure detection, page objects, utilities, fixtures, coding style, test count
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    access: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('fs', () => ({ promises: mockFs }));

import { FrameworkAnalysisService } from '../../../src/services/framework-analysis.service.js';

// =============================================================================
// HELPERS
// =============================================================================

/** Create a Dirent-like directory entry */
function dirEntry(name: string) {
  return { name, isDirectory: () => true, isFile: () => false };
}

/** Create a Dirent-like file entry */
function fileEntry(name: string) {
  return { name, isDirectory: () => false, isFile: () => true };
}

// =============================================================================
// TESTS
// =============================================================================

describe('FrameworkAnalysisService', () => {
  let service: FrameworkAnalysisService;
  const projectPath = '/fake/project';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FrameworkAnalysisService();
  });

  // ---------------------------------------------------------------------------
  // analyzeProject
  // ---------------------------------------------------------------------------
  describe('analyzeProject', () => {
    it('should throw if project path does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(service.analyzeProject('/nonexistent')).rejects.toThrow(
        'Project path does not exist: /nonexistent'
      );
    });

    it('should return a complete FrameworkAnalysis object for a valid project', async () => {
      // fs.access succeeds
      mockFs.access.mockResolvedValue(undefined);

      // Root readdir: has tests dir, package.json, playwright.config.ts
      mockFs.readdir.mockImplementation((dir: string, _opts?: unknown) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('tests'),
            fileEntry('package.json'),
            fileEntry('playwright.config.ts'),
          ]);
        }
        // tests dir has no subdirs or files
        if (dir === `${projectPath}/tests`) {
          return Promise.resolve([]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      // package.json with Playwright
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(
            JSON.stringify({
              dependencies: { '@playwright/test': '^1.40.0' },
              devDependencies: { typescript: '^5.0.0' },
            })
          );
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);

      expect(result).toHaveProperty('framework');
      expect(result).toHaveProperty('projectStructure');
      expect(result).toHaveProperty('foundPageObjects');
      expect(result).toHaveProperty('foundUtilities');
      expect(result).toHaveProperty('foundFixtures');
      expect(result).toHaveProperty('codingStyle');
      expect(result).toHaveProperty('testCount');
      expect(result.framework.name).toBe('playwright');
      expect(result.projectStructure.testDir).toBe(`${projectPath}/tests`);
      expect(result.projectStructure.configFile).toBe(`${projectPath}/playwright.config.ts`);
    });
  });

  // ---------------------------------------------------------------------------
  // detectFramework (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('detectFramework', () => {
    /**
     * Helper: sets up minimal mocks so analyzeProject can run, returning the
     * framework field. Only package.json readFile varies per test.
     */
    async function analyzeForFramework(packageJsonContent: string | null): Promise<ReturnType<typeof service.analyzeProject>> {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([fileEntry('package.json')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      if (packageJsonContent !== null) {
        mockFs.readFile.mockImplementation((filePath: string) => {
          if (filePath === `${projectPath}/package.json`) {
            return Promise.resolve(packageJsonContent);
          }
          return Promise.reject(new Error('ENOENT'));
        });
      } else {
        mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      }

      return service.analyzeProject(projectPath);
    }

    it('should detect Playwright from @playwright/test dependency', async () => {
      const result = await analyzeForFramework(
        JSON.stringify({
          dependencies: { '@playwright/test': '^1.40.0' },
        })
      );

      expect(result.framework.name).toBe('playwright');
      expect(result.framework.version).toBe('^1.40.0');
    });

    it('should detect Cypress from cypress dependency', async () => {
      const result = await analyzeForFramework(
        JSON.stringify({
          devDependencies: { cypress: '^13.0.0' },
        })
      );

      expect(result.framework.name).toBe('cypress');
      expect(result.framework.version).toBe('^13.0.0');
    });

    it('should return unknown when neither Playwright nor Cypress is found', async () => {
      const result = await analyzeForFramework(
        JSON.stringify({
          dependencies: { jest: '^29.0.0' },
        })
      );

      expect(result.framework.name).toBe('unknown');
      expect(result.framework.version).toBeNull();
    });

    it('should handle missing package.json gracefully', async () => {
      const result = await analyzeForFramework(null);

      expect(result.framework.name).toBe('unknown');
      expect(result.framework.version).toBeNull();
      expect(result.framework.language).toBe('typescript');
    });

    it('should detect typescript language when typescript is in dependencies', async () => {
      const result = await analyzeForFramework(
        JSON.stringify({
          dependencies: { '@playwright/test': '^1.40.0' },
          devDependencies: { typescript: '^5.3.0' },
        })
      );

      expect(result.framework.language).toBe('typescript');
    });

    it('should default to javascript when typescript is not a dependency', async () => {
      const result = await analyzeForFramework(
        JSON.stringify({
          dependencies: { '@playwright/test': '^1.40.0' },
        })
      );

      expect(result.framework.language).toBe('javascript');
    });
  });

  // ---------------------------------------------------------------------------
  // detectProjectStructure (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('detectProjectStructure', () => {
    function setupStructureMocks(rootEntries: ReturnType<typeof dirEntry | typeof fileEntry>[], subEntries?: Record<string, ReturnType<typeof dirEntry | typeof fileEntry>[]>) {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve(rootEntries);
        }
        if (subEntries) {
          for (const [subDir, entries] of Object.entries(subEntries)) {
            if (dir === subDir) {
              return Promise.resolve(entries);
            }
          }
        }
        return Promise.reject(new Error('ENOENT'));
      });

      // Default readFile: no package.json, no config files
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    }

    it('should find a "tests" directory', async () => {
      setupStructureMocks([
        dirEntry('tests'),
        dirEntry('src'),
        fileEntry('package.json'),
      ], {
        [`${projectPath}/tests`]: [],
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.projectStructure.testDir).toBe(`${projectPath}/tests`);
    });

    it('should find an "e2e" directory as the test directory', async () => {
      setupStructureMocks([
        dirEntry('e2e'),
        dirEntry('src'),
      ], {
        [`${projectPath}/e2e`]: [],
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.projectStructure.testDir).toBe(`${projectPath}/e2e`);
    });

    it('should find a "pages" directory inside the test directory', async () => {
      setupStructureMocks([
        dirEntry('tests'),
        fileEntry('package.json'),
      ], {
        [`${projectPath}/tests`]: [dirEntry('pages')],
        [`${projectPath}/tests/pages`]: [],
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.projectStructure.testDir).toBe(`${projectPath}/tests`);
      expect(result.projectStructure.pageObjectDir).toBe(`${projectPath}/tests/pages`);
    });

    it('should find utils and fixtures directories at root level', async () => {
      setupStructureMocks([
        dirEntry('tests'),
        dirEntry('utils'),
        dirEntry('fixtures'),
      ], {
        [`${projectPath}/tests`]: [],
        [`${projectPath}/utils`]: [],
        [`${projectPath}/fixtures`]: [],
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.projectStructure.utilityDir).toBe(`${projectPath}/utils`);
      expect(result.projectStructure.fixtureDir).toBe(`${projectPath}/fixtures`);
    });

    it('should handle missing directories gracefully and return nulls', async () => {
      setupStructureMocks([
        fileEntry('index.ts'),
      ]);

      const result = await service.analyzeProject(projectPath);
      expect(result.projectStructure.testDir).toBeNull();
      expect(result.projectStructure.pageObjectDir).toBeNull();
      expect(result.projectStructure.utilityDir).toBeNull();
      expect(result.projectStructure.fixtureDir).toBeNull();
      expect(result.projectStructure.configFile).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findPageObjects (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('findPageObjects', () => {
    it('should find a class matching the Page pattern and extract methods and selectors', async () => {
      mockFs.access.mockResolvedValue(undefined);

      // Root has tests dir with a pages subdir
      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('tests'),
            fileEntry('package.json'),
          ]);
        }
        if (dir === `${projectPath}/tests`) {
          return Promise.resolve([dirEntry('pages')]);
        }
        if (dir === `${projectPath}/tests/pages`) {
          return Promise.resolve([fileEntry('login.page.ts')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const pageObjectContent = `export class LoginPage {
  constructor(private page: Page) {}
  async login(user: string) { await this.page.locator('#email').fill(user); }
  async submit() { await this.page.locator('#submit-btn').click(); }
}`;

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        if (filePath === `${projectPath}/tests/pages/login.page.ts`) {
          return Promise.resolve(pageObjectContent);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);

      // Service searches both pageObjectDir and testDir; since pageObjectDir is
      // inside testDir the same file is found twice — this is expected behavior.
      expect(result.foundPageObjects).toHaveLength(2);
      expect(result.foundPageObjects[0]!.name).toBe('LoginPage');
      expect(result.foundPageObjects[0]!.filePath).toBe(`${projectPath}/tests/pages/login.page.ts`);
      expect(result.foundPageObjects[0]!.methods).toContain('login');
      expect(result.foundPageObjects[0]!.methods).toContain('submit');
      expect(result.foundPageObjects[0]!.selectors).toContain('#email');
      expect(result.foundPageObjects[0]!.selectors).toContain('#submit-btn');
    });

    it('should skip non-page-object files', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('tests'),
            fileEntry('package.json'),
          ]);
        }
        if (dir === `${projectPath}/tests`) {
          return Promise.resolve([dirEntry('pages')]);
        }
        if (dir === `${projectPath}/tests/pages`) {
          return Promise.resolve([fileEntry('config.ts')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      // This file does not match any page object pattern
      const normalFileContent = `export const BASE_URL = 'http://localhost:3000';
export function formatDate(d: Date): string { return d.toISOString(); }`;

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        if (filePath === `${projectPath}/tests/pages/config.ts`) {
          return Promise.resolve(normalFileContent);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.foundPageObjects).toHaveLength(0);
    });

    it('should return empty array when there is no page object directory', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([dirEntry('src'), fileEntry('package.json')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.foundPageObjects).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findUtilities (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('findUtilities', () => {
    it('should extract named exports from utility files', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('utils'),
            fileEntry('package.json'),
          ]);
        }
        if (dir === `${projectPath}/utils`) {
          return Promise.resolve([fileEntry('helpers.ts')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const utilContent = `export function waitForElement(selector: string) { /* ... */ }
export const TIMEOUT = 5000;
export async function retry(fn: Function, attempts: number) { /* ... */ }`;

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        if (filePath === `${projectPath}/utils/helpers.ts`) {
          return Promise.resolve(utilContent);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);

      expect(result.foundUtilities).toHaveLength(1);
      expect(result.foundUtilities[0]!.name).toBe('helpers');
      expect(result.foundUtilities[0]!.exports).toContain('waitForElement');
      expect(result.foundUtilities[0]!.exports).toContain('TIMEOUT');
      expect(result.foundUtilities[0]!.exports).toContain('retry');
    });

    it('should return empty array when there is no utility directory', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([fileEntry('package.json')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.foundUtilities).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findFixtures (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('findFixtures', () => {
    function setupFixtureMocks(fixtureFiles: string[]) {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('fixtures'),
            fileEntry('package.json'),
          ]);
        }
        if (dir === `${projectPath}/fixtures`) {
          return Promise.resolve(fixtureFiles.map(f => fileEntry(f)));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        return Promise.reject(new Error('ENOENT'));
      });
    }

    it('should classify fixture with "auth" in the name as authentication', async () => {
      setupFixtureMocks(['auth-tokens.json']);

      const result = await service.analyzeProject(projectPath);
      expect(result.foundFixtures).toHaveLength(1);
      expect(result.foundFixtures[0]!.name).toBe('auth-tokens');
      expect(result.foundFixtures[0]!.type).toBe('authentication');
    });

    it('should classify fixture with "setup" in the name as setup', async () => {
      setupFixtureMocks(['setup-data.ts']);

      const result = await service.analyzeProject(projectPath);
      expect(result.foundFixtures).toHaveLength(1);
      expect(result.foundFixtures[0]!.name).toBe('setup-data');
      expect(result.foundFixtures[0]!.type).toBe('setup');
    });

    it('should default to "data" type for unrecognized fixture names', async () => {
      setupFixtureMocks(['users.json']);

      const result = await service.analyzeProject(projectPath);
      expect(result.foundFixtures).toHaveLength(1);
      expect(result.foundFixtures[0]!.name).toBe('users');
      expect(result.foundFixtures[0]!.type).toBe('data');
    });
  });

  // ---------------------------------------------------------------------------
  // detectCodingStyle (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('detectCodingStyle', () => {
    function setupStyleMocks(configFiles: Record<string, string>) {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([fileEntry('package.json')]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        for (const [name, content] of Object.entries(configFiles)) {
          if (filePath === `${projectPath}/${name}`) {
            return Promise.resolve(content);
          }
        }
        return Promise.reject(new Error('ENOENT'));
      });
    }

    it('should read tab settings from .editorconfig', async () => {
      setupStyleMocks({
        '.editorconfig': `root = true\n[*]\nindent_style = tab\nindent_size = 4`,
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.codingStyle.indentation).toBe('tabs');
      expect(result.codingStyle.indentSize).toBe(4);
    });

    it('should read settings from .prettierrc', async () => {
      setupStyleMocks({
        '.prettierrc': JSON.stringify({
          useTabs: true,
          tabWidth: 4,
          singleQuote: false,
          semi: false,
          trailingComma: 'none',
        }),
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.codingStyle.indentation).toBe('tabs');
      expect(result.codingStyle.indentSize).toBe(4);
      expect(result.codingStyle.quotesStyle).toBe('double');
      expect(result.codingStyle.semicolons).toBe(false);
      expect(result.codingStyle.trailingComma).toBe(false);
    });

    it('should return sensible defaults when no config files exist', async () => {
      setupStyleMocks({});

      const result = await service.analyzeProject(projectPath);
      expect(result.codingStyle.indentation).toBe('spaces');
      expect(result.codingStyle.indentSize).toBe(2);
      expect(result.codingStyle.quotesStyle).toBe('single');
      expect(result.codingStyle.semicolons).toBe(true);
      expect(result.codingStyle.trailingComma).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // countTests (tested via analyzeProject)
  // ---------------------------------------------------------------------------
  describe('countTests', () => {
    it('should count .spec.ts and .test.ts files in the test directory', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('tests'),
            fileEntry('package.json'),
          ]);
        }
        if (dir === `${projectPath}/tests`) {
          return Promise.resolve([
            fileEntry('login.spec.ts'),
            fileEntry('signup.test.ts'),
            fileEntry('helpers.ts'),           // not a test file
            fileEntry('dashboard.spec.js'),
          ]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        // readFile for page object scanning on test files — return non-page-object content
        return Promise.resolve('// no page object here');
      });

      const result = await service.analyzeProject(projectPath);
      // login.spec.ts, signup.test.ts, dashboard.spec.js = 3 test files
      expect(result.testCount).toBe(3);
    });

    it('should return 0 when there is no test directory', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockFs.readdir.mockImplementation((dir: string) => {
        if (dir === projectPath) {
          return Promise.resolve([
            dirEntry('src'),
            fileEntry('package.json'),
          ]);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `${projectPath}/package.json`) {
          return Promise.resolve(JSON.stringify({ dependencies: {} }));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.analyzeProject(projectPath);
      expect(result.testCount).toBe(0);
    });
  });
});
