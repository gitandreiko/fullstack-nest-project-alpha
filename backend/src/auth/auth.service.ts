import {
	BadRequestException,
	ConflictException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { readBcryptRounds } from '../password-rounds';
import { PrismaService } from '../prisma/prisma.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const publicUser = {
	id: true,
	email: true,
	name: true,
	createdAt: true,
} as const;

@Injectable()
export class AuthService {
	private readonly rounds: number;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		config: ConfigService,
	) {
		this.rounds = readBcryptRounds(config.get<string>('BCRYPT_ROUNDS') || '12');
	}

	async register(dto: RegisterDto) {
		if (dto.password !== dto.passwordConfirmation) {
			throw new BadRequestException('Passwords do not match');
		}

		const existingUser = await this.prisma.user.findUnique({
			where: {
				email: dto.email,
			},
		});
		if (existingUser) {
			throw new ConflictException('Account already exists');
		}

		const password = await bcrypt.hash(dto.password, this.rounds);

		return this.prisma.user.create({
			data: {
				email: dto.email,
				name: dto.name,
				password,
			},
			select: publicUser,
		});
	}

	async login(dto: LoginDto) {
		const user = await this.prisma.user.findUnique({
			where: {
				email: dto.email,
			},
		});
		const matches = user ? await bcrypt.compare(dto.password, user.password) : false;

		if (!user || !matches) {
			throw new UnauthorizedException('Invalid credentials');
		}

		return {
			accessToken: this.jwt.sign({
				sub: user.id,
				email: user.email,
			}),
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
			},
		};
	}

	async me(id: string) {
		return this.prisma.user.findUnique({
			where: {
				id,
			},
			select: publicUser,
		});
	}

	async close(id: string, dto: DeleteAccountDto) {
		const user = await this.prisma.user.findUnique({
			where: {
				id,
			},
			select: {
				password: true,
				_count: {
					select: {
						projects: true,
						documents: true,
					},
				},
			},
		});
		const matches = user ? await bcrypt.compare(dto.currentPassword, user.password) : false;

		if (!user || !matches) {
			throw new UnauthorizedException('Invalid credentials');
		}
		if (user._count.projects > 0 || user._count.documents > 0) {
			throw new ConflictException('Account owns projects or documents');
		}

		await this.prisma.$transaction([
			this.prisma.workspaceMember.deleteMany({
				where: {
					userId: id,
				},
			}),
			this.prisma.user.delete({
				where: {
					id,
				},
			}),
		]);

		return {
			message: 'Account deleted successfully',
		};
	}
}
