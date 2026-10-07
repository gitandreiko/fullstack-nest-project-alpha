import { Body, Controller, Delete, Get, Param, Patch, Req } from '@nestjs/common';
import { AuthenticatedRequest } from '../../auth/authenticated-request';
import { JwtAuth } from '../../auth/decorators/jwt-auth.decorator';
import { DocumentsService } from '../documents.service';
import { UpdateDocumentDto } from '../dto/update-document.dto';

@JwtAuth()
@Controller('documents')
export class DocumentsController {
	constructor(private readonly documentsService: DocumentsService) {}

	@Get(':documentId')
	get(@Param('documentId') documentId: string, @Req() request: AuthenticatedRequest) {
		return this.documentsService.get(documentId, request.user.sub);
	}

	@Patch(':documentId')
	update(
		@Param('documentId') documentId: string,
		@Body() dto: UpdateDocumentDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.documentsService.update(documentId, request.user.sub, dto);
	}

	@Patch(':documentId/archive')
	archive(@Param('documentId') documentId: string, @Req() request: AuthenticatedRequest) {
		return this.documentsService.archive(documentId, request.user.sub);
	}

	@Delete(':documentId')
	remove(@Param('documentId') documentId: string, @Req() request: AuthenticatedRequest) {
		return this.documentsService.remove(documentId, request.user.sub);
	}
}
