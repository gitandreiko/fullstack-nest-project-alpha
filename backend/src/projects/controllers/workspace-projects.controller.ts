import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AuthenticatedRequest } from '../../auth/authenticated-request';
import { JwtAuth } from '../../auth/decorators/jwt-auth.decorator';
import { CreateProjectDto } from '../dto/create-project.dto';
import { ProjectsService } from '../projects.service';

@JwtAuth()
@Controller('workspaces/:workspaceId/projects')
export class WorkspaceProjectsController {
	constructor(private readonly projectsService: ProjectsService) {}

	@Get()
	list(@Param('workspaceId') workspaceId: string, @Req() request: AuthenticatedRequest) {
		return this.projectsService.listByWorkspace(workspaceId, request.user.sub);
	}

	@Post()
	create(
		@Param('workspaceId') workspaceId: string,
		@Body() dto: CreateProjectDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.projectsService.create(request.user.sub, workspaceId, dto);
	}
}
