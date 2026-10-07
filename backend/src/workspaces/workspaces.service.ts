import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspaceRole, WorkspaceStatus } from '@prisma/client';
import { AccessPolicyService } from '../access/access-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly access: AccessPolicyService,
	) {}

	async create(userId: string, dto: CreateWorkspaceDto) {
		return this.prisma.workspace.create({
			data: {
				name: dto.name,
				members: {
					create: {
						userId,
						role: WorkspaceRole.OWNER,
					},
				},
			},
		});
	}

	async list(userId: string) {
		return this.prisma.workspace.findMany({
			where: { members: { some: { userId } } },
			orderBy: { updatedAt: 'desc' },
		});
	}

	async get(id: string, userId: string) {
		return this.access.requireWorkspace(userId, id, 'view');
	}

	async update(id: string, userId: string, dto: UpdateWorkspaceDto) {
		await this.access.requireWorkspace(userId, id, 'update');
		if (dto.name === undefined) {
			throw new BadRequestException('At least one field is required');
		}

		return this.prisma.workspace.update({
			where: { id },
			data: { name: dto.name },
		});
	}

	async archive(id: string, userId: string) {
		await this.access.requireWorkspace(userId, id, 'archive');
		return this.prisma.workspace.update({
			where: { id },
			data: { status: WorkspaceStatus.ARCHIVED },
		});
	}

	async remove(id: string, userId: string) {
		await this.access.requireWorkspace(userId, id, 'delete');
		return this.prisma.workspace.delete({ where: { id } });
	}
}
