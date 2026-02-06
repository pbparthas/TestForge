/**
 * Git Service
 * Git operations via simple-git with SSH key management
 */

import { simpleGit, type SimpleGit, type LogResult, type SimpleGitOptions } from 'simple-git';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { prisma } from '../utils/prisma.js';
import { encrypt, decrypt, getEncryptionKey } from '../utils/encryption.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { GitIntegration } from '@prisma/client';

export interface CreateIntegrationInput {
  projectId: string;
  repositoryUrl: string;
  sshKey: string;
  defaultBranch?: string;
  developBranch?: string;
  createdById: string;
}

export interface CommitInput {
  message: string;
  files: string[];
  author: string;
}

export interface DiffInput {
  filePath: string;
  source: string;
  target: string;
}

export interface LogOptions {
  branch?: string;
  maxCount?: number;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
}

export class GitService {
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.env.WORKSPACE_ROOT || '/testforge-workspace';
  }

  async createIntegration(input: CreateIntegrationInput): Promise<GitIntegration> {
    const key = getEncryptionKey();
    const sshKeyEncrypted = encrypt(input.sshKey, key);
    const workspacePath = path.join(this.workspaceRoot, input.projectId);

    return prisma.gitIntegration.create({
      data: {
        projectId: input.projectId,
        repositoryUrl: input.repositoryUrl,
        sshKeyEncrypted,
        defaultBranch: input.defaultBranch || 'main',
        developBranch: input.developBranch || 'develop',
        workspacePath,
        createdById: input.createdById,
      },
    });
  }

  async getIntegration(projectId: string): Promise<GitIntegration> {
    const integration = await prisma.gitIntegration.findUnique({
      where: { projectId },
    });
    if (!integration) {
      throw new NotFoundError('GitIntegration', projectId);
    }
    return integration;
  }

  async commit(projectId: string, input: CommitInput): Promise<{ commit: string }> {
    const integration = await this.getIntegration(projectId);
    const git = await this.getGitInstance(integration);

    await git.checkout(integration.developBranch);
    await git.add(input.files);
    const result = await git.commit(input.message, undefined, {
      '--author': `${input.author} <${input.author}>`,
    });

    return { commit: result.commit };
  }

  async push(projectId: string, branch: string): Promise<void> {
    const integration = await this.getIntegration(projectId);
    const git = await this.getGitInstance(integration);

    await git.push('origin', branch);
  }

  async pull(projectId: string, branch: string): Promise<unknown> {
    const integration = await this.getIntegration(projectId);
    const git = await this.getGitInstance(integration);

    await git.checkout(branch);
    return git.pull('origin', branch);
  }

  async merge(projectId: string): Promise<unknown> {
    const integration = await this.getIntegration(projectId);
    const git = await this.getGitInstance(integration);

    await git.checkout(integration.defaultBranch);
    return git.merge([integration.developBranch, '--no-ff']);
  }

  async getDiff(projectId: string, input: DiffInput): Promise<string> {
    const integration = await this.getIntegration(projectId);
    const git = await this.getGitInstance(integration);

    return git.diff([input.source, input.target, '--', input.filePath]);
  }

  async getLog(projectId: string, options: LogOptions = {}): Promise<LogResult> {
    const integration = await this.getIntegration(projectId);
    const git = await this.getGitInstance(integration);

    return git.log({
      maxCount: options.maxCount || 50,
      ...(options.branch ? { from: options.branch } : {}),
    });
  }

  async testConnection(repoUrl: string, sshKey: string): Promise<TestConnectionResult> {
    let tempDir: string | undefined;

    try {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testforge-ssh-'));
      const keyPath = path.join(tempDir, 'id_rsa');
      await fs.writeFile(keyPath, sshKey, { mode: 0o600 });

      const git = simpleGit();
      git.env('GIT_SSH_COMMAND', `ssh -i ${keyPath} -o StrictHostKeyChecking=no`);

      const cloneDir = path.join(tempDir, 'repo');
      await git.clone(repoUrl, cloneDir, ['--depth', '1']);

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  private async getGitInstance(integration: GitIntegration): Promise<SimpleGit> {
    const git = simpleGit(integration.workspacePath);
    return git;
  }
}

export const gitService = new GitService();
