/**
 * Database seeding script
 * Creates initial data for development/testing
 */

import { PrismaClient, UserRole, Framework, Language, Priority, Status, TestType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@testforge.dev' },
    update: {},
    create: {
      email: 'admin@testforge.dev',
      username: 'admin',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: UserRole.admin,
    },
  });
  console.log(`Created admin user: ${admin.username} (${admin.email})`);

  // Create lead user
  const leadPassword = await bcrypt.hash('lead123', 10);
  const lead = await prisma.user.upsert({
    where: { email: 'lead@testforge.dev' },
    update: {},
    create: {
      email: 'lead@testforge.dev',
      username: 'lead',
      passwordHash: leadPassword,
      name: 'Lead User',
      role: UserRole.lead,
    },
  });
  console.log(`Created lead user: ${lead.username} (${lead.email})`);

  // Create QAE user
  const qaePassword = await bcrypt.hash('qae123', 10);
  const qae = await prisma.user.upsert({
    where: { email: 'qae@testforge.dev' },
    update: {},
    create: {
      email: 'qae@testforge.dev',
      username: 'qae',
      passwordHash: qaePassword,
      name: 'QA Engineer',
      role: UserRole.qae,
    },
  });
  console.log(`Created QAE user: ${qae.username} (${qae.email})`);

  // Create dev user
  const devPassword = await bcrypt.hash('dev123', 10);
  const dev = await prisma.user.upsert({
    where: { email: 'dev@testforge.dev' },
    update: {},
    create: {
      email: 'dev@testforge.dev',
      username: 'developer',
      passwordHash: devPassword,
      name: 'Developer',
      role: UserRole.dev,
    },
  });
  console.log(`Created dev user: ${dev.username} (${dev.email})`);

  // Create sample project
  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Sample E-Commerce App',
      description: 'Sample project for testing TestForge features',
      repositoryUrl: 'https://github.com/example/ecommerce-app',
      framework: Framework.playwright,
      language: Language.typescript,
      createdById: admin.id,
    },
  });
  console.log(`Created project: ${project.name}`);

  // Create sample requirement
  const requirement = await prisma.requirement.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      projectId: project.id,
      externalId: 'JIRA-123',
      title: 'User Login Feature',
      description: 'Users should be able to login with email and password',
      priority: Priority.high,
      status: Status.active,
    },
  });
  console.log(`Created requirement: ${requirement.title}`);

  // Create sample test case
  const testCase = await prisma.testCase.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      projectId: project.id,
      requirementId: requirement.id,
      title: 'Verify user can login with valid credentials',
      description: 'Test the login flow with valid email and password',
      preconditions: 'User account exists in the system',
      steps: [
        { order: 1, action: 'Navigate to login page', expected: 'Login form is displayed' },
        { order: 2, action: 'Enter valid email', expected: 'Email is accepted' },
        { order: 3, action: 'Enter valid password', expected: 'Password is accepted' },
        { order: 4, action: 'Click login button', expected: 'User is redirected to dashboard' },
      ],
      expectedResult: 'User is successfully logged in and sees dashboard',
      priority: Priority.high,
      status: Status.active,
      type: TestType.e2e,
      isAutomated: false,
      createdById: qae.id,
    },
  });
  console.log(`Created test case: ${testCase.title}`);

  // Create sample environment
  const environment = await prisma.environment.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      projectId: project.id,
      name: 'Development',
      baseUrl: 'http://localhost:3000',
      variables: {
        API_URL: 'http://localhost:3000/api',
        DEBUG: 'true',
      },
      isActive: true,
    },
  });
  console.log(`Created environment: ${environment.name}`);

  // Create staging environment
  await prisma.environment.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      projectId: project.id,
      name: 'Staging',
      baseUrl: 'https://staging.example.com',
      variables: {
        API_URL: 'https://staging.example.com/api',
        DEBUG: 'false',
      },
      isActive: true,
    },
  });
  console.log('Created environment: Staging');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
