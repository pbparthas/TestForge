/**
 * Framework Analysis Service
 * Sprint 13: Analyzes project structure for ScriptSmith Pro
 *
 * Scans project directories to find:
 * - Existing Page Objects
 * - Utility functions
 * - Fixtures
 * - Project structure
 * - Coding style preferences
 */

import { promises as fs } from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface FrameworkAnalysis {
  foundPageObjects: PageObjectInfo[];
  foundUtilities: UtilityInfo[];
  foundFixtures: FixtureInfo[];
  projectStructure: ProjectStructure;
  codingStyle: CodingStyle;
  framework: DetectedFramework;
  testCount: number;
}

export interface PageObjectInfo {
  name: string;
  filePath: string;
  methods: string[];
  selectors: string[];
}

export interface UtilityInfo {
  name: string;
  filePath: string;
  exports: string[];
}

export interface FixtureInfo {
  name: string;
  filePath: string;
  type: 'data' | 'setup' | 'authentication';
}

export interface ProjectStructure {
  rootDir: string;
  testDir: string | null;
  pageObjectDir: string | null;
  utilityDir: string | null;
  fixtureDir: string | null;
  configFile: string | null;
}

export interface CodingStyle {
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  quotesStyle: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
}

export interface DetectedFramework {
  name: 'playwright' | 'cypress' | 'unknown';
  version: string | null;
  language: 'typescript' | 'javascript';
}

// Common test directory names
const TEST_DIR_PATTERNS = ['tests', 'test', 'e2e', '__tests__', 'spec', 'specs'];
const PAGE_OBJECT_PATTERNS = ['pages', 'page-objects', 'pageobjects', 'pom'];
const UTILITY_PATTERNS = ['utils', 'utilities', 'helpers', 'lib'];
const FIXTURE_PATTERNS = ['fixtures', 'fixture', 'testdata', 'test-data'];

// =============================================================================
// SERVICE
// =============================================================================

export class FrameworkAnalysisService {
  /**
   * Analyze a project directory
   */
  async analyzeProject(projectPath: string): Promise<FrameworkAnalysis> {
    // Verify path exists
    try {
      await fs.access(projectPath);
    } catch {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Detect framework and structure in parallel
    const [framework, structure] = await Promise.all([
      this.detectFramework(projectPath),
      this.detectProjectStructure(projectPath),
    ]);

    // Analyze components
    const [pageObjects, utilities, fixtures, codingStyle, testCount] = await Promise.all([
      this.findPageObjects(structure.pageObjectDir, structure.testDir),
      this.findUtilities(structure.utilityDir),
      this.findFixtures(structure.fixtureDir),
      this.detectCodingStyle(projectPath),
      this.countTests(structure.testDir),
    ]);

    return {
      foundPageObjects: pageObjects,
      foundUtilities: utilities,
      foundFixtures: fixtures,
      projectStructure: structure,
      codingStyle,
      framework,
      testCount,
    };
  }

  /**
   * Detect test framework from package.json
   */
  private async detectFramework(projectPath: string): Promise<DetectedFramework> {
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for Playwright
      if (deps['@playwright/test'] || deps['playwright']) {
        return {
          name: 'playwright',
          version: deps['@playwright/test'] || deps['playwright'] || null,
          language: deps['typescript'] ? 'typescript' : 'javascript',
        };
      }

      // Check for Cypress
      if (deps['cypress']) {
        return {
          name: 'cypress',
          version: deps['cypress'] || null,
          language: deps['typescript'] ? 'typescript' : 'javascript',
        };
      }

      return {
        name: 'unknown',
        version: null,
        language: deps['typescript'] ? 'typescript' : 'javascript',
      };
    } catch {
      return {
        name: 'unknown',
        version: null,
        language: 'typescript',
      };
    }
  }

  /**
   * Detect project structure by looking for common directories
   */
  private async detectProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      rootDir: projectPath,
      testDir: null,
      pageObjectDir: null,
      utilityDir: null,
      fixtureDir: null,
      configFile: null,
    };

    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name.toLowerCase());
      const files = entries.filter(e => e.isFile()).map(e => e.name);

      // Find test directory
      for (const pattern of TEST_DIR_PATTERNS) {
        if (dirs.includes(pattern)) {
          structure.testDir = path.join(projectPath, pattern);
          break;
        }
      }

      // Find page object directory
      for (const pattern of PAGE_OBJECT_PATTERNS) {
        if (dirs.includes(pattern)) {
          structure.pageObjectDir = path.join(projectPath, pattern);
          break;
        }
      }

      // Also check inside test directory
      if (structure.testDir && !structure.pageObjectDir) {
        try {
          const testEntries = await fs.readdir(structure.testDir, { withFileTypes: true });
          const testDirs = testEntries.filter(e => e.isDirectory()).map(e => e.name.toLowerCase());
          for (const pattern of PAGE_OBJECT_PATTERNS) {
            if (testDirs.includes(pattern)) {
              structure.pageObjectDir = path.join(structure.testDir, pattern);
              break;
            }
          }
        } catch {
          // Ignore
        }
      }

      // Find utility directory
      for (const pattern of UTILITY_PATTERNS) {
        if (dirs.includes(pattern)) {
          structure.utilityDir = path.join(projectPath, pattern);
          break;
        }
      }

      // Find fixture directory
      for (const pattern of FIXTURE_PATTERNS) {
        if (dirs.includes(pattern)) {
          structure.fixtureDir = path.join(projectPath, pattern);
          break;
        }
      }

      // Find config file
      const configPatterns = [
        'playwright.config.ts',
        'playwright.config.js',
        'cypress.config.ts',
        'cypress.config.js',
      ];
      for (const config of configPatterns) {
        if (files.includes(config)) {
          structure.configFile = path.join(projectPath, config);
          break;
        }
      }
    } catch {
      // Return default structure if read fails
    }

    return structure;
  }

  /**
   * Find page objects in the project
   */
  private async findPageObjects(
    pageObjectDir: string | null,
    testDir: string | null
  ): Promise<PageObjectInfo[]> {
    const pageObjects: PageObjectInfo[] = [];
    const dirsToSearch = [pageObjectDir, testDir].filter((d): d is string => d !== null);

    for (const dir of dirsToSearch) {
      try {
        const files = await this.findFilesRecursively(dir, ['.ts', '.js']);

        for (const file of files) {
          // Check if file looks like a page object
          const content = await fs.readFile(file, 'utf-8');
          if (this.looksLikePageObject(content)) {
            const info = this.extractPageObjectInfo(file, content);
            if (info) {
              pageObjects.push(info);
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    return pageObjects;
  }

  /**
   * Find utility files
   */
  private async findUtilities(utilityDir: string | null): Promise<UtilityInfo[]> {
    if (!utilityDir) return [];
    const utilities: UtilityInfo[] = [];

    try {
      const files = await this.findFilesRecursively(utilityDir, ['.ts', '.js']);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const exports = this.extractExports(content);

        if (exports.length > 0) {
          utilities.push({
            name: path.basename(file, path.extname(file)),
            filePath: file,
            exports,
          });
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return utilities;
  }

  /**
   * Find fixture files
   */
  private async findFixtures(fixtureDir: string | null): Promise<FixtureInfo[]> {
    if (!fixtureDir) return [];
    const fixtures: FixtureInfo[] = [];

    try {
      const files = await this.findFilesRecursively(fixtureDir, ['.ts', '.js', '.json']);

      for (const file of files) {
        const name = path.basename(file, path.extname(file));
        const type = this.classifyFixture(name, file);

        fixtures.push({
          name,
          filePath: file,
          type,
        });
      }
    } catch {
      // Directory doesn't exist
    }

    return fixtures;
  }

  /**
   * Detect coding style from existing files
   */
  private async detectCodingStyle(projectPath: string): Promise<CodingStyle> {
    const defaultStyle: CodingStyle = {
      indentation: 'spaces',
      indentSize: 2,
      quotesStyle: 'single',
      semicolons: true,
      trailingComma: true,
    };

    // Check for .editorconfig
    try {
      const editorConfig = await fs.readFile(
        path.join(projectPath, '.editorconfig'),
        'utf-8'
      );

      if (editorConfig.includes('indent_style = tab')) {
        defaultStyle.indentation = 'tabs';
      }
      const indentMatch = editorConfig.match(/indent_size\s*=\s*(\d+)/);
      if (indentMatch && indentMatch[1]) {
        defaultStyle.indentSize = parseInt(indentMatch[1], 10);
      }
    } catch {
      // No .editorconfig
    }

    // Check for .prettierrc
    try {
      const prettierConfig = await fs.readFile(
        path.join(projectPath, '.prettierrc'),
        'utf-8'
      );
      const config = JSON.parse(prettierConfig);

      if (config.useTabs) defaultStyle.indentation = 'tabs';
      if (config.tabWidth) defaultStyle.indentSize = config.tabWidth;
      if (config.singleQuote === false) defaultStyle.quotesStyle = 'double';
      if (config.semi === false) defaultStyle.semicolons = false;
      if (config.trailingComma === 'none') defaultStyle.trailingComma = false;
    } catch {
      // No .prettierrc
    }

    return defaultStyle;
  }

  /**
   * Count test files
   */
  private async countTests(testDir: string | null): Promise<number> {
    if (!testDir) return 0;

    try {
      const testFiles = await this.findFilesRecursively(testDir, [
        '.spec.ts',
        '.spec.js',
        '.test.ts',
        '.test.js',
      ]);
      return testFiles.length;
    } catch {
      return 0;
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private async findFilesRecursively(
    dir: string,
    extensions: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await this.findFilesRecursively(fullPath, extensions);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const hasValidExtension = extensions.some(ext => entry.name.endsWith(ext));
        if (hasValidExtension) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private looksLikePageObject(content: string): boolean {
    // Check for common page object patterns
    const patterns = [
      /class\s+\w+Page/,
      /export\s+class\s+\w+Page/,
      /Page\s*{/,
      /\.locator\(/,
      /\.getBy/,
      /this\.page\./,
      /cy\./,
    ];

    return patterns.some(pattern => pattern.test(content));
  }

  private extractPageObjectInfo(filePath: string, content: string): PageObjectInfo | null {
    // Extract class name
    const classMatch = content.match(/class\s+(\w+)/);
    if (!classMatch || !classMatch[1]) return null;

    const className = classMatch[1];

    // Extract methods
    const methodMatches = content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g);
    const methods: string[] = [...methodMatches]
      .map(m => m[1])
      .filter((m): m is string => typeof m === 'string' && !['constructor'].includes(m));

    // Extract selectors (locators)
    const selectorMatches = content.matchAll(/locator\(['"](.*?)['"]\)|getBy\w+\(['"](.*?)['"]\)/g);
    const selectors: string[] = [...selectorMatches]
      .map(m => m[1] || m[2])
      .filter((s): s is string => typeof s === 'string');

    return {
      name: className,
      filePath,
      methods: [...new Set(methods)],
      selectors: [...new Set(selectors)],
    };
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];

    // Named exports
    const namedMatches = content.matchAll(/export\s+(?:const|function|class|async\s+function)\s+(\w+)/g);
    for (const m of namedMatches) {
      if (m[1]) exports.push(m[1]);
    }

    // Export statements
    const exportMatches = content.matchAll(/export\s*{\s*([^}]+)\s*}/g);
    for (const match of exportMatches) {
      if (match[1]) {
        const names = match[1]
          .split(',')
          .map(n => n.trim().split(' ')[0])
          .filter((n): n is string => typeof n === 'string' && n.length > 0);
        exports.push(...names);
      }
    }

    return [...new Set(exports)];
  }

  private classifyFixture(name: string, filePath: string): 'data' | 'setup' | 'authentication' {
    const lowerName = name.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    if (lowerName.includes('auth') || lowerPath.includes('auth')) {
      return 'authentication';
    }
    if (lowerName.includes('setup') || lowerName.includes('before')) {
      return 'setup';
    }
    return 'data';
  }
}

export const frameworkAnalysisService = new FrameworkAnalysisService();
