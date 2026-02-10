/**
 * Report Service
 * CRUD, scheduling, and orchestration — delegates data generation and export to sub-modules
 */

import type {
  Report,
  ReportTemplate,
  ReportSchedule,
  ReportFormat,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { NotFoundError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import { ReportDataGenerator } from './data-generators.js';
import { ReportExporter } from './exporters.js';
import type {
  GenerateReportInput,
  CreateTemplateInput,
  CreateScheduleInput,
  FindReportsParams,
  ReportParameters,
  ReportData,
} from './types.js';

// Re-export all types so existing consumers don't break
export * from './types.js';

export class ReportService {
  private dataGenerator = new ReportDataGenerator();
  private exporter = new ReportExporter();

  // ============================================================================
  // REPORT CRUD
  // ============================================================================

  async generate(input: GenerateReportInput): Promise<Report> {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundError('Project', input.projectId);

    // Create report record
    const report = await prisma.report.create({
      data: {
        projectId: input.projectId,
        executionId: input.executionId,
        templateId: input.templateId,
        type: input.type,
        format: input.format ?? 'pdf',
        status: 'pending',
        title: input.title ?? `${input.type.replace('_', ' ')} Report`,
        description: input.description,
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });

    // Generate report asynchronously
    this.generateAsync(report.id).catch(err => {
      logger.error({ reportId: report.id, error: err }, 'Report generation failed');
    });

    return report;
  }

  private async generateAsync(reportId: string): Promise<void> {
    try {
      // Mark as generating
      await prisma.report.update({
        where: { id: reportId },
        data: { status: 'generating' },
      });

      const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { project: true, execution: true },
      });
      if (!report) throw new NotFoundError('Report', reportId);

      // Generate report data
      const data = await this.dataGenerator.generateReportData(report);

      // Export to file based on format
      let filePath: string;
      if (report.format === 'pdf') {
        filePath = await this.exporter.exportToPdf(report, data);
      } else if (report.format === 'excel') {
        filePath = await this.exporter.exportToExcel(report, data);
      } else {
        filePath = await this.exporter.exportToJson(report, data);
      }

      // Update report with results
      const stats = fs.statSync(filePath);
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'completed',
          filePath,
          fileSize: stats.size,
          data: data as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
        },
      });

      logger.info({ reportId, filePath }, 'Report generated successfully');
    } catch (error) {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async findById(id: string): Promise<Report> {
    const report = await prisma.report.findUnique({
      where: { id },
      include: { project: true, execution: true, template: true },
    });
    if (!report) throw new NotFoundError('Report', id);
    return report;
  }

  async findAll(params: FindReportsParams) {
    const { page, limit, projectId, type, status, startDate, endDate } = params;
    const where: Prisma.ReportWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { project: true },
      }),
      prisma.report.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async delete(id: string): Promise<void> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundError('Report', id);

    // Delete file if exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }

    await prisma.report.delete({ where: { id } });
    logger.info({ reportId: id }, 'Report deleted');
  }

  async download(id: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundError('Report', id);
    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new Error('Report file not found');
    }

    const mimeTypes: Record<ReportFormat, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      json: 'application/json',
    };

    const extensions: Record<ReportFormat, string> = {
      pdf: 'pdf',
      excel: 'xlsx',
      json: 'json',
    };

    return {
      filePath: report.filePath,
      fileName: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extensions[report.format]}`,
      mimeType: mimeTypes[report.format],
    };
  }

  // ============================================================================
  // TEMPLATE CRUD
  // ============================================================================

  async createTemplate(input: CreateTemplateInput): Promise<ReportTemplate> {
    if (input.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { projectId: input.projectId, type: input.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.reportTemplate.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        type: input.type,
        config: input.config as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault ?? false,
        createdById: input.createdById,
      },
    });
  }

  async updateTemplate(id: string, input: Partial<CreateTemplateInput>): Promise<ReportTemplate> {
    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('ReportTemplate', id);

    if (input.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { projectId: template.projectId, type: template.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.reportTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        config: input.config as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault,
      },
    });
  }

  async findTemplateById(id: string): Promise<ReportTemplate> {
    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('ReportTemplate', id);
    return template;
  }

  async findTemplates(projectId: string): Promise<ReportTemplate[]> {
    return prisma.reportTemplate.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('ReportTemplate', id);
    await prisma.reportTemplate.delete({ where: { id } });
  }

  // ============================================================================
  // SCHEDULING
  // ============================================================================

  async createSchedule(input: CreateScheduleInput): Promise<ReportSchedule> {
    const nextRunAt = this.calculateNextRun(input.cronExpression);

    return prisma.reportSchedule.create({
      data: {
        projectId: input.projectId,
        templateId: input.templateId,
        name: input.name,
        cronExpression: input.cronExpression,
        timezone: input.timezone ?? 'UTC',
        format: input.format ?? 'pdf',
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        recipients: input.recipients ?? [],
        createdById: input.createdById,
        nextRunAt,
      },
    });
  }

  async updateSchedule(id: string, input: Partial<CreateScheduleInput>): Promise<ReportSchedule> {
    const schedule = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundError('ReportSchedule', id);

    const nextRunAt = input.cronExpression
      ? this.calculateNextRun(input.cronExpression)
      : undefined;

    return prisma.reportSchedule.update({
      where: { id },
      data: {
        name: input.name,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        format: input.format,
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        recipients: input.recipients,
        nextRunAt,
      },
    });
  }

  async findScheduleById(id: string): Promise<ReportSchedule> {
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!schedule) throw new NotFoundError('ReportSchedule', id);
    return schedule;
  }

  async findSchedules(projectId: string): Promise<ReportSchedule[]> {
    return prisma.reportSchedule.findMany({
      where: { projectId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    const schedule = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundError('ReportSchedule', id);
    await prisma.reportSchedule.delete({ where: { id } });
  }

  async runScheduledReports(): Promise<void> {
    const now = new Date();
    const dueSchedules = await prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: { template: true },
    });

    for (const schedule of dueSchedules) {
      try {
        const report = await this.generate({
          projectId: schedule.projectId,
          type: schedule.template.type,
          format: schedule.format,
          templateId: schedule.templateId,
          parameters: schedule.parameters as ReportParameters,
        });

        // Update schedule
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt: this.calculateNextRun(schedule.cronExpression),
            reportId: report.id,
          },
        });

        logger.info({ scheduleId: schedule.id, reportId: report.id }, 'Scheduled report generated');
      } catch (error) {
        logger.error({ scheduleId: schedule.id, error }, 'Failed to run scheduled report');
      }
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser - for production use node-cron or croner
    // This is a simplified implementation
    const now = new Date();
    const parts = cronExpression.split(' ');

    // Default to 1 hour from now if parsing fails
    if (parts.length !== 5) {
      return new Date(now.getTime() + 60 * 60 * 1000);
    }

    // Very basic: just add 1 day for daily schedules
    // For production, use a proper cron library
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export const reportService = new ReportService();
