/**
 * Postman Routes Integration Tests
 * Sprint 20: Tests for Postman collection import API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Mock service and JWT
const { mockImportService, mockJwt } = vi.hoisted(() => ({
  mockImportService: {
    preview: vi.fn(),
    import: vi.fn(),
    getImportHistory: vi.fn(),
    getImport: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/postman-import.service.js', () => ({
  postmanImportService: mockImportService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Postman Routes', () => {
  const adminToken = 'admin-token';
  const qaeToken = 'qae-token';

  const validCollection = JSON.stringify({
    info: {
      name: 'Test API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      { name: 'Get Users', request: { method: 'GET', url: '/users' } },
    ],
  });

  const mockPreview = {
    collection: {
      name: 'Test API',
      requestCount: 1,
      folders: [],
      variables: [],
    },
    requests: [
      { id: 'req_1', name: 'Get Users', method: 'GET', url: '/users', folder: '' },
    ],
    warnings: [],
    errors: [],
  };

  const mockImportResult = {
    importId: 'import-123',
    status: 'completed',
    totalRequests: 1,
    importedCount: 1,
    skippedCount: 0,
    importedItems: [{ type: 'test_case', id: 'tc-123', name: 'Get Users', requestId: 'req_1' }],
    errors: [],
  };

  const mockImportRecord = {
    id: 'import-123',
    userId: 'user-123',
    projectId: 'project-123',
    fileName: 'Test API.json',
    collectionName: 'Test API',
    requestCount: 1,
    importedCount: 1,
    skippedCount: 0,
    importType: 'test_cases',
    status: 'completed',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwt.verify.mockImplementation((token) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === qaeToken) return { userId: 'qae-123', role: 'qae' };
      throw new Error('Invalid token');
    });
  });

  // ==========================================================================
  // PREVIEW
  // ==========================================================================

  describe('POST /api/postman/preview', () => {
    it('should preview a collection', async () => {
      mockImportService.preview.mockResolvedValue(mockPreview);

      const res = await request(app)
        .post('/api/postman/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ collection: validCollection });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Collection parsed successfully');
      expect(res.body.data.collection.name).toBe('Test API');
      expect(res.body.data.requests).toHaveLength(1);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/postman/preview')
        .send({ collection: validCollection });

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing collection', async () => {
      const res = await request(app)
        .post('/api/postman/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid collection', async () => {
      mockImportService.preview.mockRejectedValue(new Error('Invalid JSON'));

      const res = await request(app)
        .post('/api/postman/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ collection: 'not json' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // IMPORT
  // ==========================================================================

  describe('POST /api/postman/import', () => {
    const importPayload = {
      collection: validCollection,
      projectId: '00000000-0000-0000-0000-000000000001',
      importType: 'test_cases',
    };

    it('should import a collection as admin', async () => {
      mockImportService.import.mockResolvedValue(mockImportResult);

      const res = await request(app)
        .post('/api/postman/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(importPayload);

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Successfully imported');
      expect(res.body.data.importId).toBe('import-123');
    });

    it('should import a collection as QAE', async () => {
      mockImportService.import.mockResolvedValue(mockImportResult);

      const res = await request(app)
        .post('/api/postman/import')
        .set('Authorization', `Bearer ${qaeToken}`)
        .send(importPayload);

      expect(res.status).toBe(201);
    });

    it('should accept optional parameters', async () => {
      mockImportService.import.mockResolvedValue(mockImportResult);

      const res = await request(app)
        .post('/api/postman/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...importPayload,
          importType: 'both',
          defaultPriority: 'high',
          defaultTestType: 'api',
          framework: 'playwright',
          variableMapping: { baseUrl: 'https://api.example.com' },
        });

      expect(res.status).toBe(201);
      expect(mockImportService.import).toHaveBeenCalledWith(
        validCollection,
        expect.objectContaining({
          importType: 'both',
          defaultPriority: 'high',
          defaultTestType: 'api',
          framework: 'playwright',
          variableMapping: { baseUrl: 'https://api.example.com' },
        })
      );
    });

    it('should return 400 for invalid import type', async () => {
      const res = await request(app)
        .post('/api/postman/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...importPayload, importType: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid project ID', async () => {
      const res = await request(app)
        .post('/api/postman/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...importPayload, projectId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // IMPORT HISTORY
  // ==========================================================================

  describe('GET /api/postman/imports', () => {
    it('should return import history', async () => {
      mockImportService.getImportHistory.mockResolvedValue([mockImportRecord]);

      const res = await request(app)
        .get('/api/postman/imports')
        .query({ projectId: '00000000-0000-0000-0000-000000000001' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('import-123');
    });

    it('should accept limit parameter', async () => {
      mockImportService.getImportHistory.mockResolvedValue([mockImportRecord]);

      const res = await request(app)
        .get('/api/postman/imports')
        .query({ projectId: '00000000-0000-0000-0000-000000000001', limit: 5 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockImportService.getImportHistory).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        5
      );
    });

    it('should return 400 for invalid project ID', async () => {
      const res = await request(app)
        .get('/api/postman/imports')
        .query({ projectId: 'invalid' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET SINGLE IMPORT
  // ==========================================================================

  describe('GET /api/postman/imports/:id', () => {
    it('should return a single import', async () => {
      mockImportService.getImport.mockResolvedValue(mockImportRecord);

      const res = await request(app)
        .get('/api/postman/imports/import-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('import-123');
    });

    it('should return 404 for non-existent import', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockImportService.getImport.mockRejectedValue(new NotFoundError('PostmanImport', 'nonexistent'));

      const res = await request(app)
        .get('/api/postman/imports/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
