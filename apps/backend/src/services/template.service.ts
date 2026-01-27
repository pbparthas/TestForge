/**
 * Test Template Service
 * Sprint 20: Manage reusable test case templates
 *
 * Provides a library of built-in and custom templates for common testing patterns.
 */

import type {
  TestTemplate,
  TestTemplateCategory,
  TestType,
  Priority,
  Prisma,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateContent {
  steps: Array<{
    order: number;
    action: string;
    expected: string;
  }>;
  preconditions?: string;
  expectedResult?: string;
  testData?: Record<string, unknown>;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: TestTemplateCategory;
  content: TemplateContent;
  variables?: string[];
  tags?: string[];
  testType?: TestType;
  priority?: Priority;
  isPublic?: boolean;
  projectId?: string;
  createdById?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: TestTemplateCategory;
  content?: TemplateContent;
  variables?: string[];
  tags?: string[];
  testType?: TestType;
  priority?: Priority;
  isPublic?: boolean;
}

export interface UseTemplateInput {
  templateId: string;
  projectId: string;
  createdById: string;
  variableValues?: Record<string, string>;
  overrides?: {
    title?: string;
    description?: string;
    priority?: Priority;
    testType?: TestType;
  };
}

export interface ListTemplatesOptions {
  category?: TestTemplateCategory;
  isBuiltIn?: boolean;
  projectId?: string;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

// =============================================================================
// BUILT-IN TEMPLATES
// =============================================================================

const BUILT_IN_TEMPLATES: Omit<CreateTemplateInput, 'createdById'>[] = [
  // AUTH CATEGORY
  {
    name: 'Login Flow - Valid Credentials',
    description: 'Test successful user login with valid username and password',
    category: 'auth',
    testType: 'functional',
    priority: 'high',
    variables: ['{{username}}', '{{password}}', '{{loginUrl}}'],
    tags: ['login', 'authentication', 'positive'],
    content: {
      preconditions: 'User account exists with valid credentials',
      steps: [
        { order: 1, action: 'Navigate to {{loginUrl}}', expected: 'Login page is displayed' },
        { order: 2, action: 'Enter {{username}} in username field', expected: 'Username is entered' },
        { order: 3, action: 'Enter {{password}} in password field', expected: 'Password is masked' },
        { order: 4, action: 'Click Login button', expected: 'Login request is submitted' },
        { order: 5, action: 'Verify redirect to dashboard', expected: 'User is on dashboard page' },
      ],
      expectedResult: 'User is successfully logged in and redirected to dashboard',
    },
  },
  {
    name: 'Login Flow - Invalid Credentials',
    description: 'Test login failure with invalid credentials',
    category: 'auth',
    testType: 'functional',
    priority: 'high',
    variables: ['{{username}}', '{{invalidPassword}}', '{{loginUrl}}'],
    tags: ['login', 'authentication', 'negative'],
    content: {
      preconditions: 'User account exists',
      steps: [
        { order: 1, action: 'Navigate to {{loginUrl}}', expected: 'Login page is displayed' },
        { order: 2, action: 'Enter {{username}} in username field', expected: 'Username is entered' },
        { order: 3, action: 'Enter {{invalidPassword}} in password field', expected: 'Password is entered' },
        { order: 4, action: 'Click Login button', expected: 'Login request is submitted' },
        { order: 5, action: 'Verify error message', expected: 'Error message "Invalid credentials" is displayed' },
      ],
      expectedResult: 'Login fails and appropriate error message is shown',
    },
  },
  {
    name: 'Logout Flow',
    description: 'Test user logout functionality',
    category: 'auth',
    testType: 'functional',
    priority: 'medium',
    variables: ['{{dashboardUrl}}', '{{loginUrl}}'],
    tags: ['logout', 'authentication', 'session'],
    content: {
      preconditions: 'User is logged in',
      steps: [
        { order: 1, action: 'Navigate to {{dashboardUrl}}', expected: 'Dashboard is displayed' },
        { order: 2, action: 'Click on user menu', expected: 'User menu opens' },
        { order: 3, action: 'Click Logout option', expected: 'Logout is initiated' },
        { order: 4, action: 'Verify redirect to login page', expected: 'User is on {{loginUrl}}' },
        { order: 5, action: 'Attempt to access {{dashboardUrl}} directly', expected: 'Redirected to login' },
      ],
      expectedResult: 'User is logged out and session is terminated',
    },
  },

  // CRUD CATEGORY
  {
    name: 'Create Entity',
    description: 'Test creating a new entity/resource',
    category: 'crud',
    testType: 'functional',
    priority: 'high',
    variables: ['{{entityName}}', '{{requiredField1}}', '{{requiredField2}}'],
    tags: ['create', 'crud', 'positive'],
    content: {
      preconditions: 'User has permission to create {{entityName}}',
      steps: [
        { order: 1, action: 'Navigate to {{entityName}} creation page', expected: 'Creation form is displayed' },
        { order: 2, action: 'Enter {{requiredField1}} in required field', expected: 'Field is populated' },
        { order: 3, action: 'Enter {{requiredField2}} in required field', expected: 'Field is populated' },
        { order: 4, action: 'Click Create/Submit button', expected: 'Form is submitted' },
        { order: 5, action: 'Verify success message', expected: 'Success message is displayed' },
        { order: 6, action: 'Verify entity appears in list', expected: '{{entityName}} is visible in list' },
      ],
      expectedResult: 'New {{entityName}} is created successfully',
    },
  },
  {
    name: 'Read/View Entity',
    description: 'Test viewing entity details',
    category: 'crud',
    testType: 'functional',
    priority: 'medium',
    variables: ['{{entityName}}', '{{entityId}}'],
    tags: ['read', 'view', 'crud'],
    content: {
      preconditions: '{{entityName}} with ID {{entityId}} exists',
      steps: [
        { order: 1, action: 'Navigate to {{entityName}} list', expected: 'List is displayed' },
        { order: 2, action: 'Click on {{entityName}} with ID {{entityId}}', expected: 'Details page opens' },
        { order: 3, action: 'Verify all fields are displayed', expected: 'All entity fields are visible' },
        { order: 4, action: 'Verify data matches expected values', expected: 'Data is accurate' },
      ],
      expectedResult: '{{entityName}} details are displayed correctly',
    },
  },
  {
    name: 'Update Entity',
    description: 'Test updating an existing entity',
    category: 'crud',
    testType: 'functional',
    priority: 'high',
    variables: ['{{entityName}}', '{{entityId}}', '{{newValue}}'],
    tags: ['update', 'edit', 'crud'],
    content: {
      preconditions: '{{entityName}} with ID {{entityId}} exists',
      steps: [
        { order: 1, action: 'Navigate to {{entityName}} edit page', expected: 'Edit form is displayed with current values' },
        { order: 2, action: 'Modify field with {{newValue}}', expected: 'Field is updated' },
        { order: 3, action: 'Click Save/Update button', expected: 'Form is submitted' },
        { order: 4, action: 'Verify success message', expected: 'Success message is displayed' },
        { order: 5, action: 'Verify changes are persisted', expected: 'Updated value is shown' },
      ],
      expectedResult: '{{entityName}} is updated successfully',
    },
  },
  {
    name: 'Delete Entity',
    description: 'Test deleting an entity',
    category: 'crud',
    testType: 'functional',
    priority: 'high',
    variables: ['{{entityName}}', '{{entityId}}'],
    tags: ['delete', 'remove', 'crud'],
    content: {
      preconditions: '{{entityName}} with ID {{entityId}} exists',
      steps: [
        { order: 1, action: 'Navigate to {{entityName}} list', expected: 'List is displayed' },
        { order: 2, action: 'Click delete button for {{entityId}}', expected: 'Confirmation dialog appears' },
        { order: 3, action: 'Confirm deletion', expected: 'Delete request is sent' },
        { order: 4, action: 'Verify success message', expected: 'Success message is displayed' },
        { order: 5, action: 'Verify entity is removed from list', expected: '{{entityName}} no longer appears' },
      ],
      expectedResult: '{{entityName}} is deleted successfully',
    },
  },

  // API CATEGORY
  {
    name: 'API GET Request',
    description: 'Test GET API endpoint',
    category: 'api',
    testType: 'api',
    priority: 'medium',
    variables: ['{{baseUrl}}', '{{endpoint}}', '{{authToken}}'],
    tags: ['api', 'get', 'rest'],
    content: {
      preconditions: 'API server is running, valid auth token available',
      steps: [
        { order: 1, action: 'Set Authorization header with {{authToken}}', expected: 'Header is set' },
        { order: 2, action: 'Send GET request to {{baseUrl}}{{endpoint}}', expected: 'Request is sent' },
        { order: 3, action: 'Verify response status is 200', expected: 'Status code is 200' },
        { order: 4, action: 'Verify response body structure', expected: 'Body matches expected schema' },
        { order: 5, action: 'Verify response headers', expected: 'Content-Type is application/json' },
      ],
      expectedResult: 'GET request returns expected data with 200 status',
    },
  },
  {
    name: 'API POST Request',
    description: 'Test POST API endpoint for resource creation',
    category: 'api',
    testType: 'api',
    priority: 'high',
    variables: ['{{baseUrl}}', '{{endpoint}}', '{{authToken}}', '{{requestBody}}'],
    tags: ['api', 'post', 'rest', 'create'],
    content: {
      preconditions: 'API server is running, valid auth token available',
      steps: [
        { order: 1, action: 'Set Authorization header with {{authToken}}', expected: 'Header is set' },
        { order: 2, action: 'Set Content-Type to application/json', expected: 'Header is set' },
        { order: 3, action: 'Send POST request to {{baseUrl}}{{endpoint}} with {{requestBody}}', expected: 'Request is sent' },
        { order: 4, action: 'Verify response status is 201', expected: 'Status code is 201' },
        { order: 5, action: 'Verify response contains created resource', expected: 'Body contains new resource with ID' },
      ],
      expectedResult: 'POST request creates resource and returns 201',
    },
  },
  {
    name: 'API Error Handling - 401 Unauthorized',
    description: 'Test API returns 401 for invalid/missing auth',
    category: 'api',
    testType: 'api',
    priority: 'medium',
    variables: ['{{baseUrl}}', '{{protectedEndpoint}}'],
    tags: ['api', 'error', '401', 'security'],
    content: {
      preconditions: 'API server is running',
      steps: [
        { order: 1, action: 'Send request to {{baseUrl}}{{protectedEndpoint}} WITHOUT auth token', expected: 'Request is sent' },
        { order: 2, action: 'Verify response status is 401', expected: 'Status code is 401' },
        { order: 3, action: 'Verify error message in response', expected: 'Error message indicates unauthorized' },
      ],
      expectedResult: 'API returns 401 Unauthorized for unauthenticated requests',
    },
  },

  // FORMS CATEGORY
  {
    name: 'Form Validation - Required Fields',
    description: 'Test form validation for required fields',
    category: 'forms',
    testType: 'functional',
    priority: 'high',
    variables: ['{{formUrl}}', '{{requiredFieldName}}'],
    tags: ['form', 'validation', 'required'],
    content: {
      preconditions: 'Form page is accessible',
      steps: [
        { order: 1, action: 'Navigate to {{formUrl}}', expected: 'Form is displayed' },
        { order: 2, action: 'Leave {{requiredFieldName}} empty', expected: 'Field is empty' },
        { order: 3, action: 'Click Submit button', expected: 'Form validation is triggered' },
        { order: 4, action: 'Verify error message for {{requiredFieldName}}', expected: 'Required field error is displayed' },
        { order: 5, action: 'Verify form is not submitted', expected: 'No network request is made' },
      ],
      expectedResult: 'Form shows validation error for required field',
    },
  },
  {
    name: 'Form Validation - Email Format',
    description: 'Test email field validation',
    category: 'forms',
    testType: 'functional',
    priority: 'medium',
    variables: ['{{formUrl}}', '{{emailFieldName}}', '{{invalidEmail}}'],
    tags: ['form', 'validation', 'email'],
    content: {
      preconditions: 'Form page is accessible',
      steps: [
        { order: 1, action: 'Navigate to {{formUrl}}', expected: 'Form is displayed' },
        { order: 2, action: 'Enter {{invalidEmail}} in {{emailFieldName}}', expected: 'Invalid email is entered' },
        { order: 3, action: 'Tab out of field or click Submit', expected: 'Validation is triggered' },
        { order: 4, action: 'Verify email format error', expected: 'Error message indicates invalid email' },
      ],
      expectedResult: 'Form shows validation error for invalid email format',
    },
  },

  // E2E CATEGORY
  {
    name: 'User Registration Flow',
    description: 'End-to-end test for new user registration',
    category: 'e2e',
    testType: 'e2e',
    priority: 'critical',
    variables: ['{{registrationUrl}}', '{{email}}', '{{password}}', '{{name}}'],
    tags: ['registration', 'signup', 'e2e'],
    content: {
      preconditions: 'Registration is enabled, email is not already registered',
      steps: [
        { order: 1, action: 'Navigate to {{registrationUrl}}', expected: 'Registration form is displayed' },
        { order: 2, action: 'Enter {{name}} in name field', expected: 'Name is entered' },
        { order: 3, action: 'Enter {{email}} in email field', expected: 'Email is entered' },
        { order: 4, action: 'Enter {{password}} in password field', expected: 'Password is entered' },
        { order: 5, action: 'Enter {{password}} in confirm password field', expected: 'Password is confirmed' },
        { order: 6, action: 'Accept terms and conditions', expected: 'Checkbox is checked' },
        { order: 7, action: 'Click Register button', expected: 'Registration request is sent' },
        { order: 8, action: 'Verify success message or redirect', expected: 'User is registered' },
        { order: 9, action: 'Verify welcome email is sent', expected: 'Email is received' },
      ],
      expectedResult: 'New user account is created and welcome email is sent',
    },
  },
  {
    name: 'Checkout Flow',
    description: 'End-to-end test for e-commerce checkout',
    category: 'e2e',
    testType: 'e2e',
    priority: 'critical',
    variables: ['{{productUrl}}', '{{cartUrl}}', '{{checkoutUrl}}'],
    tags: ['checkout', 'e-commerce', 'payment', 'e2e'],
    content: {
      preconditions: 'User is logged in, product is in stock, payment method is available',
      steps: [
        { order: 1, action: 'Navigate to {{productUrl}}', expected: 'Product page is displayed' },
        { order: 2, action: 'Click Add to Cart', expected: 'Product is added to cart' },
        { order: 3, action: 'Navigate to {{cartUrl}}', expected: 'Cart shows product' },
        { order: 4, action: 'Click Proceed to Checkout', expected: 'Checkout page opens' },
        { order: 5, action: 'Enter shipping address', expected: 'Address is entered' },
        { order: 6, action: 'Select shipping method', expected: 'Shipping is selected' },
        { order: 7, action: 'Enter payment details', expected: 'Payment is entered' },
        { order: 8, action: 'Review order summary', expected: 'Summary is accurate' },
        { order: 9, action: 'Click Place Order', expected: 'Order is submitted' },
        { order: 10, action: 'Verify order confirmation', expected: 'Confirmation page/email received' },
      ],
      expectedResult: 'Order is placed successfully and confirmation is received',
    },
  },

  // SECURITY CATEGORY
  {
    name: 'SQL Injection Prevention',
    description: 'Test input sanitization against SQL injection',
    category: 'security',
    testType: 'functional',
    priority: 'critical',
    variables: ['{{inputFieldUrl}}', '{{sqlPayload}}'],
    tags: ['security', 'sql-injection', 'owasp'],
    content: {
      preconditions: 'Input form is accessible',
      steps: [
        { order: 1, action: 'Navigate to {{inputFieldUrl}}', expected: 'Input form is displayed' },
        { order: 2, action: 'Enter SQL injection payload: {{sqlPayload}}', expected: 'Payload is entered' },
        { order: 3, action: 'Submit the form', expected: 'Form is submitted' },
        { order: 4, action: 'Verify no SQL error is displayed', expected: 'No database error shown' },
        { order: 5, action: 'Verify input is escaped/rejected', expected: 'Application handles input safely' },
      ],
      expectedResult: 'SQL injection attempt is blocked without exposing errors',
      testData: {
        sqlPayloads: [
          "' OR '1'='1",
          "'; DROP TABLE users; --",
          "1' AND '1'='1",
        ],
      },
    },
  },
  {
    name: 'XSS Prevention',
    description: 'Test output encoding against XSS attacks',
    category: 'security',
    testType: 'functional',
    priority: 'critical',
    variables: ['{{inputFieldUrl}}', '{{xssPayload}}'],
    tags: ['security', 'xss', 'owasp'],
    content: {
      preconditions: 'Input form that displays user input is accessible',
      steps: [
        { order: 1, action: 'Navigate to {{inputFieldUrl}}', expected: 'Input form is displayed' },
        { order: 2, action: 'Enter XSS payload: {{xssPayload}}', expected: 'Payload is entered' },
        { order: 3, action: 'Submit the form', expected: 'Form is submitted' },
        { order: 4, action: 'View page where input is displayed', expected: 'Page loads' },
        { order: 5, action: 'Verify script is not executed', expected: 'No alert/script execution' },
        { order: 6, action: 'Verify input is HTML encoded', expected: 'Tags are escaped' },
      ],
      expectedResult: 'XSS payload is escaped and not executed',
      testData: {
        xssPayloads: [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          '"><script>alert("XSS")</script>',
        ],
      },
    },
  },
];

// =============================================================================
// SERVICE
// =============================================================================

export class TemplateService {
  /**
   * Seed built-in templates (run on server start or migration)
   */
  async seedBuiltInTemplates(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const template of BUILT_IN_TEMPLATES) {
      const existing = await prisma.testTemplate.findFirst({
        where: {
          name: template.name,
          isBuiltIn: true,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.testTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          category: template.category,
          content: template.content as unknown as Prisma.InputJsonValue,
          variables: template.variables ?? [],
          tags: template.tags ?? [],
          testType: template.testType ?? 'functional',
          priority: template.priority ?? 'medium',
          isBuiltIn: true,
          isPublic: true,
        },
      });
      created++;
    }

    return { created, skipped };
  }

  /**
   * Create a custom template
   */
  async create(input: CreateTemplateInput): Promise<TestTemplate> {
    // Check for duplicate name in same scope
    const existing = await prisma.testTemplate.findFirst({
      where: {
        name: input.name,
        projectId: input.projectId ?? null,
      },
    });

    if (existing) {
      throw new ConflictError(`Template "${input.name}" already exists`);
    }

    return prisma.testTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        content: input.content as unknown as Prisma.InputJsonValue,
        variables: input.variables ?? [],
        tags: input.tags ?? [],
        testType: input.testType ?? 'functional',
        priority: input.priority ?? 'medium',
        isBuiltIn: false,
        isPublic: input.isPublic ?? true,
        projectId: input.projectId,
        createdById: input.createdById,
      },
    });
  }

  /**
   * Update a template (only custom templates can be updated)
   */
  async update(id: string, input: UpdateTemplateInput): Promise<TestTemplate> {
    const template = await this.findById(id);

    if (template.isBuiltIn) {
      throw new ConflictError('Built-in templates cannot be modified');
    }

    // Check for name conflict if name is being changed
    if (input.name && input.name !== template.name) {
      const existing = await prisma.testTemplate.findFirst({
        where: {
          name: input.name,
          projectId: template.projectId,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictError(`Template "${input.name}" already exists`);
      }
    }

    return prisma.testTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        content: input.content
          ? (input.content as unknown as Prisma.InputJsonValue)
          : undefined,
        variables: input.variables,
        tags: input.tags,
        testType: input.testType,
        priority: input.priority,
        isPublic: input.isPublic,
      },
    });
  }

  /**
   * Delete a template (only custom templates can be deleted)
   */
  async delete(id: string): Promise<void> {
    const template = await this.findById(id);

    if (template.isBuiltIn) {
      throw new ConflictError('Built-in templates cannot be deleted');
    }

    await prisma.testTemplate.delete({ where: { id } });
  }

  /**
   * Find template by ID
   */
  async findById(id: string): Promise<TestTemplate> {
    const template = await prisma.testTemplate.findUnique({ where: { id } });

    if (!template) {
      throw new NotFoundError('TestTemplate', id);
    }

    return template;
  }

  /**
   * List templates with filtering
   */
  async list(
    options: ListTemplatesOptions = {}
  ): Promise<{ data: TestTemplate[]; total: number }> {
    const {
      category,
      isBuiltIn,
      projectId,
      search,
      tags,
      page = 1,
      limit = 20,
    } = options;

    const where: Prisma.TestTemplateWhereInput = {
      AND: [
        // Category filter
        category ? { category } : {},
        // Built-in filter
        isBuiltIn !== undefined ? { isBuiltIn } : {},
        // Project filter (include global + project-specific)
        projectId
          ? {
              OR: [{ projectId: null, isPublic: true }, { projectId }],
            }
          : { OR: [{ projectId: null }, { isPublic: true }] },
        // Search filter
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        // Tags filter
        tags && tags.length > 0 ? { tags: { hasSome: tags } } : {},
      ],
    };

    const [data, total] = await Promise.all([
      prisma.testTemplate.findMany({
        where,
        orderBy: [{ isBuiltIn: 'desc' }, { usageCount: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.testTemplate.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get templates by category
   */
  async getByCategory(category: TestTemplateCategory): Promise<TestTemplate[]> {
    return prisma.testTemplate.findMany({
      where: {
        category,
        OR: [{ projectId: null }, { isPublic: true }],
      },
      orderBy: [{ isBuiltIn: 'desc' }, { usageCount: 'desc' }],
    });
  }

  /**
   * Use a template to create a test case
   */
  async useTemplate(input: UseTemplateInput) {
    const template = await this.findById(input.templateId);
    const content = template.content as unknown as TemplateContent;

    // Replace variables in content
    const processedContent = this.replaceVariables(content, input.variableValues);

    // Create test case from template
    const testCase = await prisma.testCase.create({
      data: {
        projectId: input.projectId,
        title:
          input.overrides?.title ??
          this.replaceVariablesInString(template.name, input.variableValues),
        description:
          input.overrides?.description ??
          (template.description
            ? this.replaceVariablesInString(template.description, input.variableValues)
            : undefined),
        preconditions: processedContent.preconditions,
        steps: processedContent.steps as unknown as Prisma.InputJsonValue,
        expectedResult: processedContent.expectedResult,
        testData: processedContent.testData
          ? (processedContent.testData as unknown as Prisma.InputJsonValue)
          : undefined,
        priority: input.overrides?.priority ?? template.priority,
        type: input.overrides?.testType ?? template.testType,
        isAutomated: false,
        createdById: input.createdById,
      },
    });

    // Increment usage count
    await prisma.testTemplate.update({
      where: { id: input.templateId },
      data: { usageCount: { increment: 1 } },
    });

    return testCase;
  }

  /**
   * Get all unique tags across templates
   */
  async getAllTags(): Promise<string[]> {
    const templates = await prisma.testTemplate.findMany({
      select: { tags: true },
      where: {
        OR: [{ projectId: null }, { isPublic: true }],
      },
    });

    const allTags = new Set<string>();
    templates.forEach(t => t.tags.forEach(tag => allTags.add(tag)));

    return [...allTags].sort();
  }

  /**
   * Get template categories with counts
   */
  async getCategoryStats(): Promise<Array<{ category: TestTemplateCategory; count: number }>> {
    const stats = await prisma.testTemplate.groupBy({
      by: ['category'],
      _count: { id: true },
      where: {
        OR: [{ projectId: null }, { isPublic: true }],
      },
    });

    return stats.map(s => ({
      category: s.category,
      count: s._count.id,
    }));
  }

  /**
   * Replace variables in template content
   */
  private replaceVariables(
    content: TemplateContent,
    values?: Record<string, string>
  ): TemplateContent {
    if (!values) return content;

    const replaceInString = (str: string) => this.replaceVariablesInString(str, values);

    return {
      preconditions: content.preconditions
        ? replaceInString(content.preconditions)
        : undefined,
      expectedResult: content.expectedResult
        ? replaceInString(content.expectedResult)
        : undefined,
      steps: content.steps.map(step => ({
        order: step.order,
        action: replaceInString(step.action),
        expected: replaceInString(step.expected),
      })),
      testData: content.testData,
    };
  }

  /**
   * Replace variables in a string
   */
  private replaceVariablesInString(
    str: string,
    values?: Record<string, string>
  ): string {
    if (!values) return str;

    return str.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      return values[varName] ?? match;
    });
  }
}

export const templateService = new TemplateService();
