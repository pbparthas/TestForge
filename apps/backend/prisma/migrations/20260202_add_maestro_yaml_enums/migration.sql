-- Add 'maestro' to Framework enum
ALTER TYPE "testforge"."Framework" ADD VALUE IF NOT EXISTS 'maestro';

-- Add 'yaml' to Language enum
ALTER TYPE "testforge"."Language" ADD VALUE IF NOT EXISTS 'yaml';
