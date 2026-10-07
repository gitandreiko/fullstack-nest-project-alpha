import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';

export class UpdateDocumentDto {
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 160)
	title?: string;

	@ValidateIf((_object, value) => value !== undefined)
	@IsString()
	content?: string;
}
