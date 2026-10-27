import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

function toQueryNumber(value: unknown): number {
	if (typeof value === 'number') {
		return value;
	}
	if (typeof value !== 'string' || value.trim() === '') {
		return Number.NaN;
	}
	return Number(value);
}

export class SearchDocumentsQueryDto {
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(2, 100)
	declare q: string;

	@Transform(({ value }) => toQueryNumber(value))
	@IsInt()
	@Min(1)
	@Max(50)
	limit = 20;

	@Transform(({ value }) => toQueryNumber(value))
	@IsInt()
	@Min(0)
	@Max(5000)
	offset = 0;
}
