import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
	constructor(private projectsService: ProjectsService) {}

	@UseGuards(AuthGuard('jwt'))
	@Get()
	list(@Req() request: AuthenticatedRequest) {
		return this.projectsService.list(request.user.sub);
	}

	@UseGuards(AuthGuard('jwt'))
	@Get(':id')
	get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
		return this.projectsService.get(id, request.user.sub);
	}

	@UseGuards(AuthGuard('jwt'))
	@Post()
	create(@Body() dto: CreateProjectDto, @Req() request: AuthenticatedRequest) {
		return this.projectsService.create(request.user.sub, dto);
	}

	@UseGuards(AuthGuard('jwt'))
	@Patch(':id')
	update(
		@Param('id') id: string,
		@Body() dto: UpdateProjectDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.projectsService.update(id, request.user.sub, dto);
	}

	@UseGuards(AuthGuard('jwt'))
	@Delete(':id')
	remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
		return this.projectsService.remove(id, request.user.sub);
	}
}
