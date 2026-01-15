/**
 * Device Service
 * Handles device CRUD operations
 */

import type { Device, DeviceType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

export interface CreateDeviceInput {
  projectId: string;
  name: string;
  type: DeviceType;
  config: Record<string, unknown>;
  isActive?: boolean | undefined;
}

export interface UpdateDeviceInput {
  name?: string | undefined;
  type?: DeviceType | undefined;
  config?: Record<string, unknown> | undefined;
  isActive?: boolean | undefined;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string | undefined;
  type?: DeviceType | undefined;
  isActive?: boolean | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class DeviceService {
  async create(input: CreateDeviceInput): Promise<Device> {
    return prisma.device.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        config: input.config as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<Device> {
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundError('Device', id);
    return device;
  }

  async findAll(params: FindAllParams): Promise<PaginatedResult<Device>> {
    const { page, limit, projectId, type, isActive } = params;
    const where: Prisma.DeviceWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.device.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.device.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, input: UpdateDeviceInput): Promise<Device> {
    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Device', id);

    const updateData: Prisma.DeviceUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.config !== undefined) updateData.config = input.config as Prisma.InputJsonValue;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return prisma.device.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Device', id);
    await prisma.device.delete({ where: { id } });
  }

  async getByProject(projectId: string): Promise<Device[]> {
    return prisma.device.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveByProject(projectId: string): Promise<Device[]> {
    return prisma.device.findMany({
      where: { projectId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}

export const deviceService = new DeviceService();
