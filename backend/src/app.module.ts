import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
	DocumentsController,
	DocumentsService,
	ProjectsController,
	ProjectsService,
} from './resources';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Controller('health')
class HealthController {
	@Get()
	health() {
		return {
			status: 'ok',
		};
	}
}

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		AuthModule,
		PrismaModule,
	],
	controllers: [HealthController, ProjectsController, DocumentsController],
	providers: [ProjectsService, DocumentsService],
})
export class AppModule {}
