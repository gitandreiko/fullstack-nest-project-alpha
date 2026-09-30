import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth';
import {
	DocumentsController,
	DocumentsService,
	ProjectsController,
	ProjectsService,
} from './resources';

import { PrismaModule } from './prisma/prisma.module';

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
