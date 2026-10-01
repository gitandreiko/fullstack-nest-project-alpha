import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateProjectDto {
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 120)
	declare name: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	declare description?: string | null;
}
