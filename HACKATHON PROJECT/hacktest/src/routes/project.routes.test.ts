import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { ProjectStatus, UserRole, type Project } from '@prisma/client';
import app from '../app';
import { prisma } from '../config/database';
import { env } from '../config/env';

const OWNER_ID = '00000000-0000-4000-8000-000000000011';
const FOREIGN_ID = '00000000-0000-4000-8000-000000000012';
const JUDGE_ID = '00000000-0000-4000-8000-000000000013';
const PROJECT_ID = '00000000-0000-4000-8000-000000000001';

describe('project API', () => {
  let server: Server;
  let baseUrl: string;
  let project: Project;
  let createCalls = 0;
  let failProjectList = false;
  const originals: Array<{ target: object; key: string; descriptor: PropertyDescriptor | undefined }> = [];
  const token = jwt.sign({ userId: OWNER_ID, role: UserRole.PARTICIPANT }, env.JWT_SECRET, {
    algorithm: 'HS256',
  });

  it('allows only participants to create projects', async () => {
    const judgeToken = jwt.sign({ userId: JUDGE_ID, role: UserRole.JUDGE }, env.JWT_SECRET, {
      algorithm: 'HS256',
    });
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${judgeToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Judge project',
        description: 'Must not be created',
        projectUrl: 'https://1.1.1.1/',
      }),
    });

    assert.equal(response.status, 403);
  });

  const mockMethod = (target: object, key: string, value: (...args: never[]) => unknown): void => {
    originals.push({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) });
    Object.defineProperty(target, key, { configurable: true, value });
  };

  const authorized = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
    },
  });

  before(async () => {
    project = {
      id: PROJECT_ID,
      userId: OWNER_ID,
      name: 'Demo project',
      description: 'Before update',
      projectUrl: 'https://1.1.1.1/',
      repositoryUrl: null,
      status: ProjectStatus.CREATED,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    mockMethod(prisma.user, 'findUnique', async (args) => {
      const query = args as unknown as { where: { id: string } };
      return {
        id: query.where.id,
        role: query.where.id === JUDGE_ID ? UserRole.JUDGE : UserRole.PARTICIPANT,
      };
    });
    mockMethod(prisma.project, 'findMany', async (args) => {
      const query = args as unknown as { where: { userId: string } };
      if (failProjectList) throw new Error('private PostgreSQL connection details');
      return query.where.userId === OWNER_ID ? [project] : [];
    });
    mockMethod(prisma.project, 'findFirst', async (args) => {
      const query = args as unknown as { where: { id: string; userId: string } };
      return query.where.id === PROJECT_ID && query.where.userId === OWNER_ID ? project : null;
    });
    mockMethod(prisma.project, 'create', async (args) => {
      createCalls += 1;
      const query = args as unknown as { data: Partial<Project> };
      project = { ...project, ...query.data };
      return project;
    });
    mockMethod(prisma.project, 'updateMany', async (args) => {
      const query = args as unknown as { where: { id: string; userId: string }; data: Partial<Project> };
      if (query.where.id !== PROJECT_ID || query.where.userId !== OWNER_ID) return { count: 0 };
      project = { ...project, ...query.data };
      return { count: 1 };
    });
    mockMethod(prisma.project, 'deleteMany', async (args) => {
      const query = args as unknown as { where: { id: string; userId: string } };
      return { count: query.where.id === PROJECT_ID && query.where.userId === OWNER_ID ? 1 : 0 };
    });

    server = app.listen(0);
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/projects`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    for (const { target, key, descriptor } of originals.reverse()) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  });

  it('requires authentication', async () => {
    const response = await fetch(baseUrl);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(response.status, 401);
    assert.equal(payload.error?.code, 'MISSING_TOKEN');
  });

  it('creates projects with normalized URLs and does not return owner/database fields', async () => {
    createCalls = 0;
    const response = await fetch(baseUrl, authorized({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '  Demo project  ',
        description: '  A demo  ',
        projectUrl: 'HTTPS://1.1.1.1:443/demo#preview',
        repositoryUrl: null,
      }),
    }));
    const payload = await response.json() as { data: Record<string, unknown> };

    assert.equal(response.status, 201);
    assert.equal(payload.data.projectUrl, 'https://1.1.1.1/demo');
    assert.equal(payload.data.name, 'Demo project');
    assert.equal(payload.data.status, ProjectStatus.CREATED);
    assert.equal('userId' in payload.data, false);
    assert.equal('passwordHash' in payload.data, false);
    assert.equal(createCalls, 1);
  });

  it('rejects SSRF URL inputs before creating a project', async () => {
    const previousCreateCalls = createCalls;
    const response = await fetch(baseUrl, authorized({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Unsafe project',
        description: 'Must not be saved',
        projectUrl: 'https://169.254.169.254/latest/meta-data/',
      }),
    }));
    const payload = await response.json() as { error?: { code?: string } };

    assert.equal(response.status, 422);
    assert.equal(payload.error?.code, 'VALIDATION_ERROR');
    assert.equal(createCalls, previousCreateCalls);
  });

  it('rejects unsafe project URL updates', async () => {
    const response = await fetch(`${baseUrl}/${PROJECT_ID}`, authorized({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectUrl: 'https://[::ffff:127.0.0.1]/' }),
    }));
    const payload = await response.json() as { error?: { code?: string } };

    assert.equal(response.status, 422);
    assert.equal(payload.error?.code, 'VALIDATION_ERROR');
  });

  it('lists only the authenticated user’s projects', async () => {
    const response = await fetch(baseUrl, authorized());
    const payload = await response.json() as { data: Project[] };

    assert.equal(response.status, 200);
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].id, PROJECT_ID);
    assert.equal(payload.data.some((item) => item.userId === FOREIGN_ID), false);
  });

  it('allows an owner to read and update their project', async () => {
    const getResponse = await fetch(`${baseUrl}/${PROJECT_ID}`, authorized());
    assert.equal(getResponse.status, 200);

    const patchResponse = await fetch(`${baseUrl}/${PROJECT_ID}`, authorized({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Updated description' }),
    }));
    const payload = await patchResponse.json() as { data: Project };

    assert.equal(patchResponse.status, 200);
    assert.equal(payload.data.description, 'Updated description');
  });

  it('returns the same not-found response for another user’s project', async () => {
    const response = await fetch(`${baseUrl}/${PROJECT_ID}`, {
      headers: { authorization: `Bearer ${jwt.sign(
        { userId: FOREIGN_ID, role: UserRole.PARTICIPANT },
        env.JWT_SECRET,
        { algorithm: 'HS256' },
      )}` },
    });
    const payload = await response.json() as { error?: { code?: string; message?: string } };

    assert.equal(response.status, 404);
    assert.deepEqual(payload.error, {
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
    });
  });

  it('allows an owner to delete their project', async () => {
    const response = await fetch(`${baseUrl}/${PROJECT_ID}`, authorized({ method: 'DELETE' }));
    assert.equal(response.status, 204);
  });

  it('does not expose database error details', async () => {
    failProjectList = true;
    const response = await fetch(baseUrl, authorized());
    const payload = await response.json() as { error?: { message?: string } };
    failProjectList = false;

    assert.equal(response.status, 500);
    assert.equal(payload.error?.message, 'An unexpected error occurred');
    assert.equal(JSON.stringify(payload).includes('PostgreSQL'), false);
    assert.equal(JSON.stringify(payload).includes('connection'), false);
  });
});
