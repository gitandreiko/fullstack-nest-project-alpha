import { INestApplication } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { seedDemoUsers } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAppValidationPipe } from '../src/validation.pipe';

const demoCredentials = {
	email: 'admin@example.com',
	password: 'password123',
};

describe('Auth and projects (e2e)', () => {
	let app: INestApplication | undefined;
	let prisma: PrismaService | undefined;
	let previousRounds: string | undefined;
	let accessToken = '';
	let userId = '';
	let projectId = '';

	const suffix = randomUUID();
	const email = `task1-${suffix}@example.com`;
	const password = 'password123';
	const deletableEmail = `task1-delete-${suffix}@example.com`;
	const workspaceId = `task1-workspace-${suffix}`;
	const inaccessibleWorkspaceId = `task1-inaccessible-${suffix}`;
	const deletableWorkspaceId = `task1-delete-workspace-${suffix}`;

	beforeAll(async () => {
		previousRounds = process.env.BCRYPT_ROUNDS;
		process.env.BCRYPT_ROUNDS = '4';

		const moduleFixture = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(createAppValidationPipe());
		await app.init();
		prisma = app.get(PrismaService);
	});

	afterAll(async () => {
		try {
			if (prisma) {
				await prisma.project.deleteMany({
					where: {
						id: projectId || '__not-created__',
					},
				});
				await prisma.workspaceMember.deleteMany({
					where: {
						workspaceId: {
							in: [workspaceId, inaccessibleWorkspaceId, deletableWorkspaceId],
						},
					},
				});
				await prisma.workspace.deleteMany({
					where: {
						id: {
							in: [workspaceId, inaccessibleWorkspaceId, deletableWorkspaceId],
						},
					},
				});
				await prisma.user.deleteMany({
					where: {
						email: {
							in: [email, deletableEmail],
						},
					},
				});
			}
		} finally {
			if (app) {
				await app.close();
			}
			if (previousRounds === undefined) {
				delete process.env.BCRYPT_ROUNDS;
			} else {
				process.env.BCRYPT_ROUNDS = previousRounds;
			}
		}
	});

	it('migrates demo plaintext passwords to bcrypt without creating duplicates', async () => {
		if (!app || !prisma) throw new Error('Test application is not initialized');

		await prisma.user.update({
			where: {
				email: demoCredentials.email,
			},
			data: {
				password: demoCredentials.password,
			},
		});
		const countBefore = await prisma.user.count({
			where: {
				email: demoCredentials.email,
			},
		});

		await seedDemoUsers(prisma);
		const migrated = await prisma.user.findUniqueOrThrow({
			where: {
				email: demoCredentials.email,
			},
		});
		expect(migrated.password).not.toBe(demoCredentials.password);
		expect(await bcrypt.compare(demoCredentials.password, migrated.password)).toBe(true);

		await seedDemoUsers(prisma);
		const seededAgain = await prisma.user.findUniqueOrThrow({
			where: {
				email: demoCredentials.email,
			},
		});
		expect(seededAgain.password).toBe(migrated.password);
		expect(
			await prisma.user.count({
				where: {
					email: demoCredentials.email,
				},
			}),
		).toBe(countBefore);

		await request(app.getHttpServer()).post('/auth/login').send(demoCredentials).expect(200);
	});

	it('rejects mismatched password confirmation', async () => {
		if (!app) throw new Error('Test application is not initialized');

		await request(app.getHttpServer())
			.post('/auth/register')
			.send({
				email,
				name: 'Task User',
				password,
				passwordConfirmation: 'different-password',
			})
			.expect(400);
	});

	it('registers a normalized user and stores only a bcrypt hash', async () => {
		if (!app || !prisma) throw new Error('Test application is not initialized');

		const response = await request(app.getHttpServer())
			.post('/auth/register')
			.send({
				email: `  ${email.toUpperCase()}  `,
				name: '  Task User  ',
				password,
				passwordConfirmation: password,
				role: 'OWNER',
			})
			.expect(201);

		expect(response.body).toMatchObject({
			email,
			name: 'Task User',
		});
		expect(response.body).toHaveProperty('id');
		expect(response.body).toHaveProperty('createdAt');
		expect(response.body).not.toHaveProperty('password');
		expect(response.body).not.toHaveProperty('passwordConfirmation');
		expect(response.body).not.toHaveProperty('role');
		userId = response.body.id as string;

		const stored = await prisma.user.findUniqueOrThrow({
			where: {
				email,
			},
		});
		expect(stored.password).not.toBe(password);
		expect(await bcrypt.compare(password, stored.password)).toBe(true);

		await request(app.getHttpServer())
			.post('/auth/register')
			.send({
				email,
				name: 'Duplicate User',
				password,
				passwordConfirmation: password,
			})
			.expect(409);
	});

	it('returns the same 401 response for a wrong password and an unknown email', async () => {
		if (!app) throw new Error('Test application is not initialized');

		const wrongPassword = await request(app.getHttpServer())
			.post('/auth/login')
			.send({
				email,
				password: 'wrong-password',
			})
			.expect(401);
		const unknownUser = await request(app.getHttpServer())
			.post('/auth/login')
			.send({
				email: `missing-${email}`,
				password,
			})
			.expect(401);

		expect(wrongPassword.body.message).toBe('Invalid credentials');
		expect(unknownUser.body.message).toBe(wrongPassword.body.message);
	});

	it('logs in and returns the current user only with a valid JWT', async () => {
		if (!app) throw new Error('Test application is not initialized');

		await request(app.getHttpServer()).get('/auth/me').expect(401);

		const login = await request(app.getHttpServer())
			.post('/auth/login')
			.send({
				email,
				password,
			})
			.expect(200);
		accessToken = login.body.accessToken as string;
		expect(typeof accessToken).toBe('string');
		expect(login.body.user).not.toHaveProperty('password');

		const me = await request(app.getHttpServer())
			.get('/auth/me')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		expect(me.body).toMatchObject({
			id: userId,
			email,
			name: 'Task User',
		});
		expect(me.body).toHaveProperty('createdAt');
		expect(me.body).not.toHaveProperty('password');
	});

	it('creates projects only in an accessible workspace and ignores service fields', async () => {
		if (!app || !prisma) throw new Error('Test application is not initialized');

		await prisma.workspace.create({
			data: {
				id: workspaceId,
				name: 'Task Workspace',
				members: {
					create: {
						userId,
						role: WorkspaceRole.OWNER,
					},
				},
			},
		});
		await prisma.workspace.create({
			data: {
				id: inaccessibleWorkspaceId,
				name: 'Inaccessible Workspace',
			},
		});

		const created = await request(app.getHttpServer())
			.post(`/workspaces/${workspaceId}/projects`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				name: '  Task Project  ',
				description: 'Safe fields only',
				workspaceId: inaccessibleWorkspaceId,
				createdById: 'another-user',
				status: 'ARCHIVED',
			})
			.expect(201);

		projectId = created.body.id as string;
		expect(created.body).toMatchObject({
			name: 'Task Project',
			description: 'Safe fields only',
			workspaceId,
			createdById: userId,
			status: 'ACTIVE',
		});

		await request(app.getHttpServer())
			.post(`/workspaces/${inaccessibleWorkspaceId}/projects`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				name: 'Forbidden Project',
			})
			.expect(404);
	});

	it('rejects an empty project patch and updates only DTO fields', async () => {
		if (!app || !prisma) throw new Error('Test application is not initialized');

		await request(app.getHttpServer())
			.patch(`/projects/${projectId}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({})
			.expect(400);
		await request(app.getHttpServer())
			.patch(`/projects/${projectId}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				status: 'ARCHIVED',
			})
			.expect(400);

		const updated = await request(app.getHttpServer())
			.patch(`/projects/${projectId}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				name: '  Renamed Project  ',
				description: null,
				status: 'ARCHIVED',
			})
			.expect(200);
		expect(updated.body).toMatchObject({
			name: 'Renamed Project',
			description: null,
			status: 'ACTIVE',
		});

		const stored = await prisma.project.findUniqueOrThrow({
			where: {
				id: projectId,
			},
		});
		expect(stored.status).toBe('ACTIVE');
	});

	it('does not delete an account that owns projects or documents', async () => {
		if (!app || !prisma) throw new Error('Test application is not initialized');

		await request(app.getHttpServer())
			.delete('/auth/me')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				currentPassword: password,
			})
			.expect(409);

		expect(
			await prisma.user.findUnique({
				where: {
					email,
				},
			}),
		).not.toBeNull();
	});

	it('deletes an account without owned resources after checking its password', async () => {
		if (!app || !prisma) throw new Error('Test application is not initialized');

		const registered = await request(app.getHttpServer())
			.post('/auth/register')
			.send({
				email: deletableEmail,
				name: 'Deletable User',
				password,
				passwordConfirmation: password,
			})
			.expect(201);
		const deletableUserId = registered.body.id as string;

		await prisma.workspace.create({
			data: {
				id: deletableWorkspaceId,
				name: 'Deletable Workspace',
				members: {
					create: {
						userId: deletableUserId,
						role: WorkspaceRole.MEMBER,
					},
				},
			},
		});

		const login = await request(app.getHttpServer())
			.post('/auth/login')
			.send({
				email: deletableEmail,
				password,
			})
			.expect(200);
		const deletableToken = login.body.accessToken as string;

		await request(app.getHttpServer())
			.delete('/auth/me')
			.set('Authorization', `Bearer ${deletableToken}`)
			.send({
				currentPassword: 'wrong-password',
			})
			.expect(401);
		await request(app.getHttpServer())
			.delete('/auth/me')
			.set('Authorization', `Bearer ${deletableToken}`)
			.send({
				currentPassword: password,
			})
			.expect(200)
			.expect({
				message: 'Account deleted successfully',
			});

		expect(
			await prisma.user.findUnique({
				where: {
					email: deletableEmail,
				},
			}),
		).toBeNull();
		expect(
			await prisma.workspaceMember.count({
				where: {
					userId: deletableUserId,
				},
			}),
		).toBe(0);
	});
});
