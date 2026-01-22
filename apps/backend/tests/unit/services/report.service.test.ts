/**
 * Report Service Unit Tests
 * Sprint 17: Tests for report generation, templates, and scheduling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma, mockFs } = vi.hoisted(() => ({
  mockPrisma: {
    project: {
      findUnique: vi.fn(),
    },
    report: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    reportTemplate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    reportSchedule: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    execution: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    executionResult: {
      findMany: vi.fn(),
    },
    requirement: {
      findMany: vi.fn(),
    },
    flakyTest: {
      findMany: vi.fn(),
    },
    flakyPattern: {
      findMany: vi.fn(),
    },
    aiUsage: {
      findMany: vi.fn(),
    },
  },
  mockFs: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    createWriteStream: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('fs', () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  unlinkSync: mockFs.unlinkSync,
  statSync: mockFs.statSync,
  mkdirSync: mockFs.mkdirSync,
  writeFileSync: mockFs.writeFileSync,
  createWriteStream: mockFs.createWriteStream,
}));

import { ReportService } from '../../../src/services/report.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('ReportService', () => {
  let service: ReportService;

  const mockProject = { id: 'project-123', name: 'Test Project' };
  const mockUser = { id: 'user-123' };

  const mockReport = {
    id: 'report-123',
    projectId: mockProject.id,
    executionId: 'exec-123',
    templateId: null,
    type: 'execution_summary' as const,
    format: 'pdf' as const,
    status: 'pending' as const,
    title: 'Execution Report',
    description: 'Summary of test execution',
    filePath: null,
    fileSize: null,
    data: null,
    parameters: null,
    error: null,
    generatedAt: null,
    createdById: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: mockProject,
  };

  const mockTemplate = {
    id: 'template-123',
    projectId: mockProject.id,
    name: 'Default Template',
    description: 'Standard report template',
    type: 'execution_summary' as const,
    config: {
      sections: [
        { id: 'summary', type: 'summary', title: 'Summary', enabled: true },
      ],
    },
    isDefault: true,
    createdById: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchedule = {
    id: 'schedule-123',
    projectId: mockProject.id,
    templateId: 'template-123',
    name: 'Daily Report',
    cronExpression: '0 9 * * *',
    timezone: 'UTC',
    format: 'pdf' as const,
    parameters: null,
    recipients: ['user@example.com'],
    isActive: true,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 86400000),
    reportId: null,
    createdById: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    template: mockTemplate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService();
  });

  // ==========================================================================
  // GENERATE
  // ==========================================================================

  describe('generate', () => {
    it('should create report record and start async generation', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.report.create.mockResolvedValue(mockReport);

      const result = await service.generate({
        projectId: mockProject.id,
        type: 'execution_summary',
        format: 'pdf',
        title: 'Execution Report',
        executionId: 'exec-123',
        createdById: mockUser.id,
      });

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockProject.id },
      });
      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: mockProject.id,
          type: 'execution_summary',
          format: 'pdf',
          status: 'pending',
          title: 'Execution Report',
          executionId: 'exec-123',
          createdById: mockUser.id,
        }),
      });
      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundError for invalid project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.generate({
          projectId: 'invalid',
          type: 'execution_summary',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should use default format when not specified', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.report.create.mockResolvedValue(mockReport);

      await service.generate({
        projectId: mockProject.id,
        type: 'execution_summary',
      });

      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          format: 'pdf',
        }),
      });
    });

    it('should generate default title when not specified', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.report.create.mockResolvedValue(mockReport);

      await service.generate({
        projectId: mockProject.id,
        type: 'execution_summary',
      });

      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'execution summary Report',
        }),
      });
    });
  });

  // ==========================================================================
  // FIND BY ID
  // ==========================================================================

  describe('findById', () => {
    it('should return report with relations', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReport);

      const result = await service.findById('report-123');

      expect(mockPrisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-123' },
        include: { project: true, execution: true, template: true },
      });
      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundError for invalid report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND ALL
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated reports', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport]);
      mockPrisma.report.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by projectId', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport]);
      mockPrisma.report.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, projectId: mockProject.id });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: mockProject.id },
        })
      );
    });

    it('should filter by type', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport]);
      mockPrisma.report.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, type: 'execution_summary' });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'execution_summary' },
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport]);
      mockPrisma.report.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, status: 'completed' });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'completed' },
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport]);
      mockPrisma.report.count.mockResolvedValue(1);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await service.findAll({ page: 1, limit: 10, startDate, endDate });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe('delete', () => {
    it('should delete report and file', async () => {
      const reportWithFile = {
        ...mockReport,
        filePath: '/reports/project-123/2026-01/report-123.pdf',
      };
      mockPrisma.report.findUnique.mockResolvedValue(reportWithFile);
      mockFs.existsSync.mockReturnValue(true);
      mockPrisma.report.delete.mockResolvedValue(reportWithFile);

      await service.delete('report-123');

      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/reports/project-123/2026-01/report-123.pdf');
      expect(mockPrisma.report.delete).toHaveBeenCalledWith({
        where: { id: 'report-123' },
      });
    });

    it('should delete report even if file does not exist', async () => {
      const reportWithFile = {
        ...mockReport,
        filePath: '/reports/project-123/2026-01/report-123.pdf',
      };
      mockPrisma.report.findUnique.mockResolvedValue(reportWithFile);
      mockFs.existsSync.mockReturnValue(false);
      mockPrisma.report.delete.mockResolvedValue(reportWithFile);

      await service.delete('report-123');

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
      expect(mockPrisma.report.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundError for invalid report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // DOWNLOAD
  // ==========================================================================

  describe('download', () => {
    it('should return file info for PDF', async () => {
      const reportWithFile = {
        ...mockReport,
        filePath: '/reports/project-123/2026-01/report-123.pdf',
        format: 'pdf' as const,
      };
      mockPrisma.report.findUnique.mockResolvedValue(reportWithFile);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.download('report-123');

      expect(result.filePath).toBe('/reports/project-123/2026-01/report-123.pdf');
      expect(result.fileName).toBe('Execution_Report.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should return file info for Excel', async () => {
      const reportWithFile = {
        ...mockReport,
        filePath: '/reports/project-123/2026-01/report-123.xlsx',
        format: 'excel' as const,
      };
      mockPrisma.report.findUnique.mockResolvedValue(reportWithFile);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.download('report-123');

      expect(result.fileName).toBe('Execution_Report.xlsx');
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should return file info for JSON', async () => {
      const reportWithFile = {
        ...mockReport,
        filePath: '/reports/project-123/2026-01/report-123.json',
        format: 'json' as const,
      };
      mockPrisma.report.findUnique.mockResolvedValue(reportWithFile);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.download('report-123');

      expect(result.fileName).toBe('Execution_Report.json');
      expect(result.mimeType).toBe('application/json');
    });

    it('should throw NotFoundError for invalid report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      await expect(service.download('invalid')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when file not found', async () => {
      const reportWithFile = {
        ...mockReport,
        filePath: '/reports/missing.pdf',
      };
      mockPrisma.report.findUnique.mockResolvedValue(reportWithFile);
      mockFs.existsSync.mockReturnValue(false);

      await expect(service.download('report-123')).rejects.toThrow('Report file not found');
    });
  });

  // ==========================================================================
  // CREATE TEMPLATE
  // ==========================================================================

  describe('createTemplate', () => {
    it('should create a report template', async () => {
      mockPrisma.reportTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.createTemplate({
        projectId: mockProject.id,
        name: 'Default Template',
        description: 'Standard report template',
        type: 'execution_summary',
        config: {
          sections: [
            { id: 'summary', type: 'summary', title: 'Summary', enabled: true },
          ],
        },
        isDefault: true,
        createdById: mockUser.id,
      });

      expect(mockPrisma.reportTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: mockProject.id,
          name: 'Default Template',
          type: 'execution_summary',
          isDefault: true,
        }),
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should unset other defaults when creating default template', async () => {
      mockPrisma.reportTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reportTemplate.create.mockResolvedValue(mockTemplate);

      await service.createTemplate({
        projectId: mockProject.id,
        name: 'New Default',
        type: 'execution_summary',
        config: { sections: [] },
        isDefault: true,
      });

      expect(mockPrisma.reportTemplate.updateMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, type: 'execution_summary', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  // ==========================================================================
  // UPDATE TEMPLATE
  // ==========================================================================

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.reportTemplate.update.mockResolvedValue({
        ...mockTemplate,
        name: 'Updated Template',
      });

      const result = await service.updateTemplate('template-123', {
        name: 'Updated Template',
      });

      expect(mockPrisma.reportTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: expect.objectContaining({ name: 'Updated Template' }),
      });
      expect(result.name).toBe('Updated Template');
    });

    it('should throw NotFoundError for invalid template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTemplate('invalid', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should unset other defaults when setting as default', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue({ ...mockTemplate, isDefault: false });
      mockPrisma.reportTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reportTemplate.update.mockResolvedValue(mockTemplate);

      await service.updateTemplate('template-123', { isDefault: true });

      expect(mockPrisma.reportTemplate.updateMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, type: 'execution_summary', isDefault: true, id: { not: 'template-123' } },
        data: { isDefault: false },
      });
    });
  });

  // ==========================================================================
  // FIND TEMPLATES
  // ==========================================================================

  describe('findTemplates', () => {
    it('should return templates for a project', async () => {
      mockPrisma.reportTemplate.findMany.mockResolvedValue([mockTemplate]);

      const result = await service.findTemplates(mockProject.id);

      expect(mockPrisma.reportTemplate.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // CREATE SCHEDULE
  // ==========================================================================

  describe('createSchedule', () => {
    it('should create a schedule with next run calculated', async () => {
      mockPrisma.reportSchedule.create.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule({
        projectId: mockProject.id,
        templateId: 'template-123',
        name: 'Daily Report',
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
        format: 'pdf',
        recipients: ['user@example.com'],
        createdById: mockUser.id,
      });

      expect(mockPrisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: mockProject.id,
          templateId: 'template-123',
          name: 'Daily Report',
          cronExpression: '0 9 * * *',
          timezone: 'UTC',
          format: 'pdf',
          nextRunAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockSchedule);
    });

    it('should use default values when optional params not provided', async () => {
      mockPrisma.reportSchedule.create.mockResolvedValue(mockSchedule);

      await service.createSchedule({
        projectId: mockProject.id,
        templateId: 'template-123',
        name: 'Report',
        cronExpression: '0 9 * * *',
      });

      expect(mockPrisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timezone: 'UTC',
          format: 'pdf',
          recipients: [],
        }),
      });
    });
  });

  // ==========================================================================
  // UPDATE SCHEDULE
  // ==========================================================================

  describe('updateSchedule', () => {
    it('should update a schedule', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrisma.reportSchedule.update.mockResolvedValue({
        ...mockSchedule,
        name: 'Weekly Report',
      });

      const result = await service.updateSchedule('schedule-123', {
        name: 'Weekly Report',
      });

      expect(mockPrisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'schedule-123' },
        data: expect.objectContaining({ name: 'Weekly Report' }),
      });
      expect(result.name).toBe('Weekly Report');
    });

    it('should recalculate next run when cron expression changes', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrisma.reportSchedule.update.mockResolvedValue(mockSchedule);

      await service.updateSchedule('schedule-123', {
        cronExpression: '0 0 * * 0', // Weekly
      });

      expect(mockPrisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'schedule-123' },
        data: expect.objectContaining({
          cronExpression: '0 0 * * 0',
          nextRunAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundError for invalid schedule', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSchedule('invalid', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND SCHEDULES
  // ==========================================================================

  describe('findSchedules', () => {
    it('should return schedules for a project', async () => {
      mockPrisma.reportSchedule.findMany.mockResolvedValue([mockSchedule]);

      const result = await service.findSchedules(mockProject.id);

      expect(mockPrisma.reportSchedule.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id },
        include: { template: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // FIND SCHEDULE BY ID
  // ==========================================================================

  describe('findScheduleById', () => {
    it('should return schedule with template', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(mockSchedule);

      const result = await service.findScheduleById('schedule-123');

      expect(mockPrisma.reportSchedule.findUnique).toHaveBeenCalledWith({
        where: { id: 'schedule-123' },
        include: { template: true },
      });
      expect(result).toEqual(mockSchedule);
    });

    it('should throw NotFoundError for invalid schedule', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(null);

      await expect(service.findScheduleById('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // DELETE SCHEDULE
  // ==========================================================================

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrisma.reportSchedule.delete.mockResolvedValue(mockSchedule);

      await service.deleteSchedule('schedule-123');

      expect(mockPrisma.reportSchedule.delete).toHaveBeenCalledWith({
        where: { id: 'schedule-123' },
      });
    });

    it('should throw NotFoundError for invalid schedule', async () => {
      mockPrisma.reportSchedule.findUnique.mockResolvedValue(null);

      await expect(service.deleteSchedule('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // DELETE TEMPLATE
  // ==========================================================================

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.reportTemplate.delete.mockResolvedValue(mockTemplate);

      await service.deleteTemplate('template-123');

      expect(mockPrisma.reportTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });
    });

    it('should throw NotFoundError for invalid template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null);

      await expect(service.deleteTemplate('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND TEMPLATE BY ID
  // ==========================================================================

  describe('findTemplateById', () => {
    it('should return template by ID', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.findTemplateById('template-123');

      expect(mockPrisma.reportTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should throw NotFoundError for invalid template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findTemplateById('invalid')).rejects.toThrow(NotFoundError);
    });
  });
});
