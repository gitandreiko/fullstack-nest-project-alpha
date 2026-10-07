import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AuthenticatedRequest } from '../../auth/authenticated-request';
import { JwtAuth } from '../../auth/decorators/jwt-auth.decorator';
import { DocumentsService } from '../documents.service';
import { CreateDocumentDto } from '../dto/create-document.dto';

@JwtAuth()
@Controller('projects/:projectId/documents')
export class ProjectDocumentsController {
	constructor(private readonly documentsService: DocumentsService) {}

	@Get()
	list(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
		return this.documentsService.list(projectId, request.user.sub);
	}

	@Post()
	create(
		@Param('projectId') projectId: string,
		@Body() dto: CreateDocumentDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.documentsService.create(projectId, request.user.sub, dto);
	}
}
