/**
 * Postman Parser Service Unit Tests
 * Sprint 20: Tests for Postman collection parsing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PostmanParserService } from '../../../src/services/postman-parser.service.js';

describe('PostmanParserService', () => {
  let service: PostmanParserService;

  // Sample Postman collection v2.1
  const validCollection = {
    info: {
      _postman_id: 'collection-123',
      name: 'Test API',
      description: 'A test collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      {
        name: 'Get Users',
        request: {
          method: 'GET',
          url: {
            raw: '{{baseUrl}}/api/users',
            query: [{ key: 'page', value: '1' }],
          },
          header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        },
        response: [{ name: 'Success', code: 200, body: '{"users": []}' }],
      },
      {
        name: 'Create User',
        request: {
          method: 'POST',
          url: '{{baseUrl}}/api/users',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: '{"name": "John"}',
            options: { raw: { language: 'json' } },
          },
        },
      },
    ],
    variable: [
      { key: 'baseUrl', value: 'https://api.example.com' },
      { key: 'token', value: 'test-token' },
    ],
  };

  const collectionWithFolders = {
    info: {
      name: 'Nested Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      {
        name: 'Users',
        item: [
          {
            name: 'List Users',
            request: { method: 'GET', url: '/users' },
          },
          {
            name: 'Admin',
            item: [
              {
                name: 'Delete User',
                request: { method: 'DELETE', url: '/users/1' },
              },
            ],
          },
        ],
      },
    ],
  };

  const collectionWithAuth = {
    info: {
      name: 'Auth Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{authToken}}' }],
    },
    item: [
      {
        name: 'Protected Endpoint',
        request: { method: 'GET', url: '/protected' },
      },
      {
        name: 'Different Auth',
        request: {
          method: 'GET',
          url: '/basic-auth',
          auth: {
            type: 'basic',
            basic: [
              { key: 'username', value: 'user' },
              { key: 'password', value: 'pass' },
            ],
          },
        },
      },
    ],
  };

  beforeEach(() => {
    service = new PostmanParserService();
  });

  // ==========================================================================
  // BASIC PARSING
  // ==========================================================================

  describe('parse', () => {
    it('should parse a valid v2.1 collection', () => {
      const result = service.parse(JSON.stringify(validCollection));

      expect(result.name).toBe('Test API');
      expect(result.description).toBe('A test collection');
      expect(result.id).toBe('collection-123');
      expect(result.totalRequests).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract collection variables', () => {
      const result = service.parse(JSON.stringify(validCollection));

      expect(result.variables).toHaveLength(2);
      expect(result.variables).toContainEqual({ key: 'baseUrl', value: 'https://api.example.com' });
      expect(result.variables).toContainEqual({ key: 'token', value: 'test-token' });
    });

    it('should parse request details correctly', () => {
      const result = service.parse(JSON.stringify(validCollection));
      const getRequest = result.requests.find(r => r.name === 'Get Users');

      expect(getRequest).toBeDefined();
      expect(getRequest!.method).toBe('GET');
      expect(getRequest!.url).toBe('{{baseUrl}}/api/users');
      expect(getRequest!.headers).toContainEqual({ key: 'Authorization', value: 'Bearer {{token}}' });
      expect(getRequest!.queryParams).toContainEqual({ key: 'page', value: '1' });
    });

    it('should parse request body', () => {
      const result = service.parse(JSON.stringify(validCollection));
      const postRequest = result.requests.find(r => r.name === 'Create User');

      expect(postRequest).toBeDefined();
      expect(postRequest!.body).toBeDefined();
      expect(postRequest!.body!.type).toBe('json');
      expect(postRequest!.body!.content).toBe('{"name": "John"}');
    });

    it('should extract expected responses', () => {
      const result = service.parse(JSON.stringify(validCollection));
      const getRequest = result.requests.find(r => r.name === 'Get Users');

      expect(getRequest!.expectedResponses).toHaveLength(1);
      expect(getRequest!.expectedResponses[0]).toEqual({
        name: 'Success',
        status: 200,
        body: '{"users": []}',
      });
    });

    it('should extract variables used in request', () => {
      const result = service.parse(JSON.stringify(validCollection));
      const getRequest = result.requests.find(r => r.name === 'Get Users');

      expect(getRequest!.variables).toContain('baseUrl');
      expect(getRequest!.variables).toContain('token');
    });
  });

  // ==========================================================================
  // FOLDER HANDLING
  // ==========================================================================

  describe('folder handling', () => {
    it('should parse nested folders', () => {
      const result = service.parse(JSON.stringify(collectionWithFolders));

      expect(result.folders).toContain('Users');
      expect(result.folders).toContain('Users/Admin');
    });

    it('should set correct folder path on requests', () => {
      const result = service.parse(JSON.stringify(collectionWithFolders));

      const listRequest = result.requests.find(r => r.name === 'List Users');
      const deleteRequest = result.requests.find(r => r.name === 'Delete User');

      expect(listRequest!.folder).toBe('Users');
      expect(deleteRequest!.folder).toBe('Users/Admin');
    });
  });

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  describe('authentication parsing', () => {
    it('should parse collection-level auth', () => {
      const result = service.parse(JSON.stringify(collectionWithAuth));

      expect(result.auth).toBeDefined();
      expect(result.auth!.type).toBe('bearer');
      expect(result.auth!.credentials.token).toBe('{{authToken}}');
    });

    it('should inherit collection auth for requests without own auth', () => {
      const result = service.parse(JSON.stringify(collectionWithAuth));
      const protectedRequest = result.requests.find(r => r.name === 'Protected Endpoint');

      expect(protectedRequest!.auth).toBeDefined();
      expect(protectedRequest!.auth!.type).toBe('bearer');
    });

    it('should use request-level auth when specified', () => {
      const result = service.parse(JSON.stringify(collectionWithAuth));
      const basicAuthRequest = result.requests.find(r => r.name === 'Different Auth');

      expect(basicAuthRequest!.auth).toBeDefined();
      expect(basicAuthRequest!.auth!.type).toBe('basic');
      expect(basicAuthRequest!.auth!.credentials.username).toBe('user');
      expect(basicAuthRequest!.auth!.credentials.password).toBe('pass');
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('error handling', () => {
    it('should throw for invalid JSON', () => {
      expect(() => service.parse('not json')).toThrow('Invalid JSON');
    });

    it('should throw for non-object input', () => {
      expect(() => service.parse('"string"')).toThrow('Must be a JSON object');
    });

    it('should throw for missing info field', () => {
      expect(() => service.parse(JSON.stringify({ item: [] }))).toThrow('Missing or invalid "info"');
    });

    it('should throw for missing collection name', () => {
      const invalid = { info: { schema: 'v2.1' }, item: [] };
      expect(() => service.parse(JSON.stringify(invalid))).toThrow('Missing collection name');
    });

    it('should throw for missing item array', () => {
      const invalid = { info: { name: 'Test', schema: 'v2.1' } };
      expect(() => service.parse(JSON.stringify(invalid))).toThrow('Missing or invalid "item"');
    });

    it('should throw for invalid schema version', () => {
      const invalid = {
        info: { name: 'Test', schema: 'https://example.com/v1.0' },
        item: [],
      };
      expect(() => service.parse(JSON.stringify(invalid))).toThrow('Must be v2.1 schema');
    });

    it('should throw for oversized input', () => {
      const largeString = 'x'.repeat(11 * 1024 * 1024); // 11MB
      expect(() => service.parse(largeString)).toThrow('Collection too large');
    });
  });

  // ==========================================================================
  // BODY MODES
  // ==========================================================================

  describe('body parsing', () => {
    it('should parse urlencoded body', () => {
      const collection = {
        info: { name: 'Test', schema: 'v2.1' },
        item: [{
          name: 'Form Post',
          request: {
            method: 'POST',
            url: '/form',
            body: {
              mode: 'urlencoded',
              urlencoded: [
                { key: 'username', value: 'test' },
                { key: 'password', value: 'secret', disabled: true },
              ],
            },
          },
        }],
      };

      const result = service.parse(JSON.stringify(collection));
      const request = result.requests[0];

      expect(request.body!.type).toBe('urlencoded');
      expect(request.body!.content).toEqual({ username: 'test' });
    });

    it('should parse formdata body', () => {
      const collection = {
        info: { name: 'Test', schema: 'v2.1' },
        item: [{
          name: 'File Upload',
          request: {
            method: 'POST',
            url: '/upload',
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'file', value: 'test.txt', type: 'file' },
                { key: 'name', value: 'document' },
              ],
            },
          },
        }],
      };

      const result = service.parse(JSON.stringify(collection));
      const request = result.requests[0];

      expect(request.body!.type).toBe('formdata');
    });

    it('should parse graphql body', () => {
      const collection = {
        info: { name: 'Test', schema: 'v2.1' },
        item: [{
          name: 'GraphQL Query',
          request: {
            method: 'POST',
            url: '/graphql',
            body: {
              mode: 'graphql',
              graphql: {
                query: 'query { users { id name } }',
                variables: '{"limit": 10}',
              },
            },
          },
        }],
      };

      const result = service.parse(JSON.stringify(collection));
      const request = result.requests[0];

      expect(request.body!.type).toBe('graphql');
      expect(request.body!.content).toEqual({
        query: 'query { users { id name } }',
        variables: '{"limit": 10}',
      });
    });
  });

  // ==========================================================================
  // SCRIPTS
  // ==========================================================================

  describe('script parsing', () => {
    it('should extract pre-request scripts', () => {
      const collection = {
        info: { name: 'Test', schema: 'v2.1' },
        item: [{
          name: 'With Script',
          request: { method: 'GET', url: '/test' },
          event: [{
            listen: 'prerequest',
            script: { type: 'text/javascript', exec: ['console.log("pre");', 'pm.variables.set("x", 1);'] },
          }],
        }],
      };

      const result = service.parse(JSON.stringify(collection));
      const request = result.requests[0];

      expect(request.preRequestScript).toContain('console.log("pre")');
      expect(request.preRequestScript).toContain('pm.variables.set("x", 1)');
    });

    it('should extract test scripts', () => {
      const collection = {
        info: { name: 'Test', schema: 'v2.1' },
        item: [{
          name: 'With Test',
          request: { method: 'GET', url: '/test' },
          event: [{
            listen: 'test',
            script: { type: 'text/javascript', exec: ['pm.test("status", function() {', '  pm.response.to.have.status(200);', '});'] },
          }],
        }],
      };

      const result = service.parse(JSON.stringify(collection));
      const request = result.requests[0];

      expect(request.testScript).toContain('pm.test');
      expect(request.testScript).toContain('pm.response.to.have.status(200)');
    });
  });
});
