/**
 * Report Exporters
 * PDF, Excel, and JSON export methods
 */

import type { Report, ReportFormat } from '@prisma/client';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import type { ReportData } from './types.js';

const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH ?? './reports';

export class ReportExporter {
  async exportToPdf(report: Report, data: ReportData): Promise<string> {
    const dir = path.join(REPORT_STORAGE_PATH, report.projectId, this.getYearMonth());
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${report.id}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).text(report.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${data.metadata.generatedAt.toISOString()}`, { align: 'center' });
    doc.fontSize(12).text(`Project: ${data.metadata.projectName}`, { align: 'center' });
    doc.moveDown(2);

    // Execution Summary
    if (data.summary) {
      doc.fontSize(16).text('Execution Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Tests: ${data.summary.total}`);
      doc.text(`Passed: ${data.summary.passed} (${data.summary.passRate}%)`);
      doc.text(`Failed: ${data.summary.failed}`);
      doc.text(`Skipped: ${data.summary.skipped}`);
      doc.text(`Duration: ${Math.round(data.summary.duration / 1000)}s`);
      if (data.summary.environment) doc.text(`Environment: ${data.summary.environment}`);
      if (data.summary.suite) doc.text(`Suite: ${data.summary.suite}`);
      doc.moveDown(2);
    }

    // Coverage
    if (data.coverage) {
      doc.fontSize(16).text('Test Coverage', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Coverage: ${data.coverage.coveragePercent}%`);
      doc.text(`Requirements: ${data.coverage.coveredRequirements}/${data.coverage.totalRequirements}`);
      doc.moveDown();

      if (data.coverage.gaps.length > 0) {
        doc.text('Coverage Gaps:', { underline: true });
        for (const gap of data.coverage.gaps.slice(0, 10)) {
          doc.text(`  - [${gap.priority}] ${gap.title}`);
        }
        if (data.coverage.gaps.length > 10) {
          doc.text(`  ... and ${data.coverage.gaps.length - 10} more`);
        }
      }
      doc.moveDown(2);
    }

    // Flaky Tests
    if (data.flaky) {
      doc.fontSize(16).text('Flaky Test Analysis', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Flaky: ${data.flaky.totalFlaky}`);
      doc.text(`Quarantined: ${data.flaky.quarantined}`);
      doc.moveDown();

      if (data.flaky.topFlaky.length > 0) {
        doc.text('Top Flaky Tests:', { underline: true });
        for (const flaky of data.flaky.topFlaky.slice(0, 5)) {
          doc.text(`  - ${flaky.testName} (Score: ${flaky.flakinessScore}%)`);
        }
      }
      doc.moveDown(2);
    }

    // Trends
    if (data.trends) {
      doc.fontSize(16).text('Trend Analysis', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Period: ${data.trends.period}`);
      doc.text(`Average Pass Rate: ${data.trends.averagePassRate}%`);
      doc.text(`Trend: ${data.trends.trend}`);
      doc.moveDown(2);
    }

    // AI Costs
    if (data.aiCosts) {
      doc.fontSize(16).text('AI Usage & Costs', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Cost: $${data.aiCosts.totalCostUsd} (₹${data.aiCosts.totalCostInr})`);
      doc.moveDown();
      doc.text('By Agent:');
      for (const agent of data.aiCosts.byAgent) {
        doc.text(`  - ${agent.agent}: $${agent.costUsd} (${agent.calls} calls)`);
      }
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  async exportToExcel(report: Report, data: ReportData): Promise<string> {
    const dir = path.join(REPORT_STORAGE_PATH, report.projectId, this.getYearMonth());
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${report.id}.xlsx`);
    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 30 },
    ];
    summarySheet.addRow({ metric: 'Report Title', value: report.title });
    summarySheet.addRow({ metric: 'Project', value: data.metadata.projectName });
    summarySheet.addRow({ metric: 'Generated At', value: data.metadata.generatedAt.toISOString() });

    // Execution Results Sheet
    if (data.summary) {
      summarySheet.addRow({ metric: '', value: '' });
      summarySheet.addRow({ metric: 'Execution Summary', value: '' });
      summarySheet.addRow({ metric: 'Total Tests', value: data.summary.total });
      summarySheet.addRow({ metric: 'Passed', value: data.summary.passed });
      summarySheet.addRow({ metric: 'Failed', value: data.summary.failed });
      summarySheet.addRow({ metric: 'Skipped', value: data.summary.skipped });
      summarySheet.addRow({ metric: 'Pass Rate', value: `${data.summary.passRate}%` });

      const resultsSheet = workbook.addWorksheet('Test Results');
      resultsSheet.columns = [
        { header: 'Test Case', key: 'testCase', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Duration (ms)', key: 'duration', width: 15 },
        { header: 'Error', key: 'error', width: 50 },
      ];
      for (const result of data.summary.results) {
        resultsSheet.addRow({
          testCase: result.testCaseName,
          status: result.status,
          duration: result.duration,
          error: result.errorMessage ?? '',
        });
      }
    }

    // Coverage Sheet
    if (data.coverage) {
      const coverageSheet = workbook.addWorksheet('Coverage');
      coverageSheet.columns = [
        { header: 'Priority', key: 'priority', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Covered', key: 'covered', width: 15 },
        { header: 'Coverage %', key: 'percent', width: 15 },
      ];
      for (const row of data.coverage.byPriority) {
        coverageSheet.addRow({
          priority: row.priority,
          total: row.total,
          covered: row.covered,
          percent: row.total > 0 ? Math.round((row.covered / row.total) * 100) : 100,
        });
      }

      if (data.coverage.gaps.length > 0) {
        const gapsSheet = workbook.addWorksheet('Coverage Gaps');
        gapsSheet.columns = [
          { header: 'Requirement', key: 'title', width: 50 },
          { header: 'Priority', key: 'priority', width: 15 },
          { header: 'ID', key: 'id', width: 40 },
        ];
        for (const gap of data.coverage.gaps) {
          gapsSheet.addRow({
            title: gap.title,
            priority: gap.priority,
            id: gap.requirementId,
          });
        }
      }
    }

    // Flaky Tests Sheet
    if (data.flaky && data.flaky.topFlaky.length > 0) {
      const flakySheet = workbook.addWorksheet('Flaky Tests');
      flakySheet.columns = [
        { header: 'Test Name', key: 'testName', width: 40 },
        { header: 'Flakiness Score', key: 'score', width: 20 },
        { header: 'Pattern', key: 'pattern', width: 20 },
        { header: 'Last Failure', key: 'lastFailure', width: 25 },
      ];
      for (const flaky of data.flaky.topFlaky) {
        flakySheet.addRow({
          testName: flaky.testName,
          score: flaky.flakinessScore,
          pattern: flaky.pattern,
          lastFailure: flaky.lastFailure?.toISOString() ?? '',
        });
      }
    }

    // Trends Sheet
    if (data.trends && data.trends.dataPoints.length > 0) {
      const trendsSheet = workbook.addWorksheet('Trends');
      trendsSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Pass Rate', key: 'passRate', width: 15 },
        { header: 'Total Tests', key: 'totalTests', width: 15 },
        { header: 'Executions', key: 'executions', width: 15 },
      ];
      for (const point of data.trends.dataPoints) {
        trendsSheet.addRow(point);
      }
    }

    // AI Costs Sheet
    if (data.aiCosts) {
      const costsSheet = workbook.addWorksheet('AI Costs');
      costsSheet.columns = [
        { header: 'Agent', key: 'agent', width: 25 },
        { header: 'Cost (USD)', key: 'costUsd', width: 15 },
        { header: 'Calls', key: 'calls', width: 15 },
      ];
      for (const agent of data.aiCosts.byAgent) {
        costsSheet.addRow(agent);
      }
    }

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async exportToJson(report: Report, data: ReportData): Promise<string> {
    const dir = path.join(REPORT_STORAGE_PATH, report.projectId, this.getYearMonth());
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${report.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  private getYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
