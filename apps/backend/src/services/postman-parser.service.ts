/**
 * Postman Parser Service
 * Sprint 20: Parse Postman v2.1 collection JSON files
 *
 * Extracts requests, auth, variables, and pre-request scripts from Postman collections.
 */

// =============================================================================
// TYPES - Postman Collection v2.1 Schema
// =============================================================================

export interface PostmanCollection {
  info: {
    _postman_id?: string;
    name: string;
    description?: string;
    schema: string; // Should be "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

export interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[]; // Nested folders
  request?: PostmanRequest;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
}

export interface PostmanRequest {
  method: string;
  url: PostmanUrl | string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
  description?: string;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQuery[];
  variable?: PostmanVariable[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanQuery {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>;
  graphql?: { query: string; variables?: string };
  options?: {
    raw?: { language: string };
  };
}

export interface PostmanAuth {
  type: 'noauth' | 'basic' | 'bearer' | 'apikey' | 'oauth2' | 'digest' | 'hawk' | 'awsv4';
  basic?: Array<{ key: string; value: string }>;
  bearer?: Array<{ key: string; value: string }>;
  apikey?: Array<{ key: string; value: string }>;
  oauth2?: Array<{ key: string; value: string }>;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: {
    type: string;
    exec: string[];
  };
}

export interface PostmanResponse {
  name: string;
  status: string;
  code: number;
  body?: string;
  header?: PostmanHeader[];
}

// =============================================================================
// PARSED OUTPUT TYPES
// =============================================================================

export interface ParsedRequest {
  id: string;
  name: string;
  description?: string;
  folder: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  queryParams: Array<{ key: string; value: string }>;
  body?: {
    type: string;
    content: string | Record<string, unknown>;
  };
  auth?: {
    type: string;
    credentials: Record<string, string>;
  };
  preRequestScript?: string;
  testScript?: string;
  expectedResponses: Array<{
    name: string;
    status: number;
    body?: string;
  }>;
  variables: string[]; // Variables used in this request (e.g., {{baseUrl}})
}

export interface ParsedCollection {
  id?: string;
  name: string;
  description?: string;
  variables: Array<{ key: string; value: string }>;
  auth?: {
    type: string;
    credentials: Record<string, string>;
  };
  requests: ParsedRequest[];
  folders: string[];
  totalRequests: number;
  errors: Array<{ path: string; message: string }>;
}

// =============================================================================
// SERVICE
// =============================================================================

// Maximum allowed size for Postman collection JSON (10MB)
const MAX_COLLECTION_SIZE = 10 * 1024 * 1024;

export class PostmanParserService {
  private requestCounter = 0;

  /**
   * Parse a Postman collection JSON string
   */
  parse(jsonString: string): ParsedCollection {
    // Security: Check input size to prevent DoS via memory exhaustion
    if (jsonString.length > MAX_COLLECTION_SIZE) {
      throw new Error(`Collection too large: Maximum allowed size is ${MAX_COLLECTION_SIZE / 1024 / 1024}MB`);
    }

    this.requestCounter = 0;
    const errors: Array<{ path: string; message: string }> = [];

    let collection: PostmanCollection;
    try {
      collection = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON: Failed to parse Postman collection');
    }

    // Validate basic structure before proceeding
    if (!collection || typeof collection !== 'object') {
      throw new Error('Invalid Postman collection: Must be a JSON object');
    }

    if (!collection.info || typeof collection.info !== 'object') {
      throw new Error('Invalid Postman collection: Missing or invalid "info" field');
    }

    if (!collection.info.name) {
      throw new Error('Invalid Postman collection: Missing collection name');
    }

    if (!Array.isArray(collection.item)) {
      throw new Error('Invalid Postman collection: Missing or invalid "item" array');
    }

    // Validate schema version
    if (!this.isValidSchema(collection)) {
      throw new Error(
        'Invalid Postman collection: Must be v2.1 schema (https://schema.getpostman.com/json/collection/v2.1.0/collection.json)'
      );
    }

    // Parse collection-level auth
    const collectionAuth = collection.auth
      ? this.parseAuth(collection.auth)
      : undefined;

    // Parse collection-level variables
    const variables = (collection.variable ?? [])
      .filter(v => !v.disabled)
      .map(v => ({ key: v.key, value: v.value }));

    // Parse items (requests and folders)
    const { requests, folders } = this.parseItems(
      collection.item,
      '',
      collectionAuth,
      errors
    );

    return {
      id: collection.info._postman_id,
      name: collection.info.name,
      description: collection.info.description,
      variables,
      auth: collectionAuth,
      requests,
      folders: [...new Set(folders)],
      totalRequests: requests.length,
      errors,
    };
  }

  /**
   * Validate that the collection uses v2.1 schema
   */
  private isValidSchema(collection: PostmanCollection): boolean {
    const schema = collection.info?.schema ?? '';
    return (
      schema.includes('v2.1') ||
      schema.includes('2.1.0') ||
      // Also accept v2.0 collections (mostly compatible)
      schema.includes('v2.0') ||
      schema.includes('2.0.0')
    );
  }

  /**
   * Recursively parse items (requests and folders)
   */
  private parseItems(
    items: PostmanItem[],
    currentFolder: string,
    inheritedAuth?: { type: string; credentials: Record<string, string> },
    errors: Array<{ path: string; message: string }> = []
  ): { requests: ParsedRequest[]; folders: string[] } {
    const requests: ParsedRequest[] = [];
    const folders: string[] = [];

    for (const item of items) {
      const itemPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;

      // If item has nested items, it's a folder
      if (item.item && Array.isArray(item.item)) {
        folders.push(itemPath);
        const nested = this.parseItems(item.item, itemPath, inheritedAuth, errors);
        requests.push(...nested.requests);
        folders.push(...nested.folders);
      }
      // If item has a request, parse it
      else if (item.request) {
        try {
          const parsed = this.parseRequest(item, currentFolder, inheritedAuth);
          requests.push(parsed);
        } catch (e) {
          errors.push({
            path: itemPath,
            message: (e as Error).message,
          });
        }
      }
    }

    return { requests, folders };
  }

  /**
   * Parse a single request item
   */
  private parseRequest(
    item: PostmanItem,
    folder: string,
    inheritedAuth?: { type: string; credentials: Record<string, string> }
  ): ParsedRequest {
    const request = item.request!;
    this.requestCounter++;

    // Parse URL
    const { url, queryParams } = this.parseUrl(request.url);

    // Parse headers
    const headers = (request.header ?? [])
      .filter(h => !h.disabled)
      .map(h => ({ key: h.key, value: h.value }));

    // Parse body
    const body = request.body ? this.parseBody(request.body) : undefined;

    // Parse auth (request-level overrides inherited)
    const auth = request.auth
      ? this.parseAuth(request.auth)
      : inheritedAuth;

    // Parse scripts
    const events = item.event ?? [];
    const preRequestScript = events
      .filter(e => e.listen === 'prerequest')
      .flatMap(e => e.script.exec)
      .join('\n') || undefined;
    const testScript = events
      .filter(e => e.listen === 'test')
      .flatMap(e => e.script.exec)
      .join('\n') || undefined;

    // Parse expected responses
    const expectedResponses = (item.response ?? []).map(r => ({
      name: r.name,
      status: r.code,
      body: r.body,
    }));

    // Extract variables used in this request
    const variables = this.extractVariables(
      url,
      headers,
      body,
      queryParams
    );

    return {
      id: `req_${this.requestCounter}`,
      name: item.name,
      description: item.description ?? request.description,
      folder,
      method: request.method,
      url,
      headers,
      queryParams,
      body,
      auth,
      preRequestScript,
      testScript,
      expectedResponses,
      variables,
    };
  }

  /**
   * Parse URL (can be string or object)
   */
  private parseUrl(
    url: PostmanUrl | string
  ): { url: string; queryParams: Array<{ key: string; value: string }> } {
    if (typeof url === 'string') {
      return { url, queryParams: [] };
    }

    const queryParams = (url.query ?? [])
      .filter(q => !q.disabled)
      .map(q => ({ key: q.key, value: q.value }));

    return {
      url: url.raw,
      queryParams,
    };
  }

  /**
   * Parse request body
   */
  private parseBody(
    body: PostmanBody
  ): { type: string; content: string | Record<string, unknown> } {
    switch (body.mode) {
      case 'raw':
        return {
          type: body.options?.raw?.language ?? 'text',
          content: body.raw ?? '',
        };

      case 'urlencoded':
        const urlencoded: Record<string, string> = {};
        (body.urlencoded ?? [])
          .filter(u => !u.disabled)
          .forEach(u => {
            urlencoded[u.key] = u.value;
          });
        return { type: 'urlencoded', content: urlencoded };

      case 'formdata':
        const formdata: Record<string, string> = {};
        (body.formdata ?? [])
          .filter(f => !f.disabled)
          .forEach(f => {
            formdata[f.key] = f.value;
          });
        return { type: 'formdata', content: formdata };

      case 'graphql':
        return {
          type: 'graphql',
          content: {
            query: body.graphql?.query ?? '',
            variables: body.graphql?.variables ?? '',
          },
        };

      default:
        return { type: body.mode, content: '' };
    }
  }

  /**
   * Parse authentication configuration
   */
  private parseAuth(
    auth: PostmanAuth
  ): { type: string; credentials: Record<string, string> } | undefined {
    if (auth.type === 'noauth') {
      return undefined;
    }

    const credentials: Record<string, string> = {};

    const authArray =
      auth[auth.type as keyof Omit<PostmanAuth, 'type'>] as
        | Array<{ key: string; value: string }>
        | undefined;

    if (authArray) {
      authArray.forEach(item => {
        credentials[item.key] = item.value;
      });
    }

    return {
      type: auth.type,
      credentials,
    };
  }

  /**
   * Extract variable names used in request (e.g., {{baseUrl}})
   */
  private extractVariables(
    url: string,
    headers: Array<{ key: string; value: string }>,
    body?: { type: string; content: string | Record<string, unknown> },
    queryParams?: Array<{ key: string; value: string }>
  ): string[] {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();

    // Extract from URL
    let match: RegExpExecArray | null;
    while ((match = variablePattern.exec(url)) !== null) {
      variables.add(match[1]);
    }

    // Extract from headers
    headers.forEach(h => {
      variablePattern.lastIndex = 0;
      while ((match = variablePattern.exec(h.value)) !== null) {
        variables.add(match[1]);
      }
    });

    // Extract from query params
    (queryParams ?? []).forEach(q => {
      variablePattern.lastIndex = 0;
      while ((match = variablePattern.exec(q.value)) !== null) {
        variables.add(match[1]);
      }
    });

    // Extract from body
    if (body) {
      const bodyStr =
        typeof body.content === 'string'
          ? body.content
          : JSON.stringify(body.content);
      variablePattern.lastIndex = 0;
      while ((match = variablePattern.exec(bodyStr)) !== null) {
        variables.add(match[1]);
      }
    }

    return [...variables];
  }
}

export const postmanParserService = new PostmanParserService();
