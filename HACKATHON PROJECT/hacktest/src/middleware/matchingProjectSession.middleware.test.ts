import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { requireMatchingProjectSession } from './matchingProjectSession.middleware';
import { NotFoundError } from '../utils/errors';

describe('requireMatchingProjectSession', () => {
  const response = {} as Response;

  it('allows access only when the active session belongs to the requested project', () => {
    let nextCalled = false;
    const request = {
      params: { id: 'project-a' },
      activeProjectSession: { id: 'session-a', projectId: 'project-a' },
    } as unknown as Request;

    requireMatchingProjectSession(request, response, (() => { nextCalled = true; }) as NextFunction);
    assert.equal(nextCalled, true);
  });

  it('hides projects that do not match the authorized session', () => {
    let receivedError: unknown;
    const request = {
      params: { id: 'project-b' },
      activeProjectSession: { id: 'session-a', projectId: 'project-a' },
    } as unknown as Request;

    requireMatchingProjectSession(request, response, ((error?: unknown) => { receivedError = error; }) as NextFunction);
    assert.ok(receivedError instanceof NotFoundError);
  });
});
