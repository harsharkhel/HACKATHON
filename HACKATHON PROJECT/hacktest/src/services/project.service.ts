import { ProjectStatus, Prisma, type Project } from '@prisma/client';
import { prisma } from '../config/database';
import { resolveAndValidateTarget } from './urlSecurityService';
import { NotFoundError } from '../utils/errors';
import type { CreateProjectInput, UpdateProjectInput } from '../validators/project.validators';

export type ProjectResponse = Pick<
  Project,
  'id' | 'name' | 'description' | 'projectUrl' | 'repositoryUrl' | 'status' | 'createdAt' | 'updatedAt'
>;

const toProjectResponse = (project: Project): ProjectResponse => ({
  id: project.id,
  name: project.name,
  description: project.description,
  projectUrl: project.projectUrl,
  repositoryUrl: project.repositoryUrl,
  status: project.status,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const projectNotFound = (): NotFoundError =>
  new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');

export const createProject = async (userId: string, input: CreateProjectInput): Promise<ProjectResponse> => {
  const target = await resolveAndValidateTarget(input.projectUrl);
  const repositoryUrl = input.repositoryUrl === undefined || input.repositoryUrl === null
    ? input.repositoryUrl
    : (await resolveAndValidateTarget(input.repositoryUrl)).url;

  const project = await prisma.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      projectUrl: target.url,
      repositoryUrl,
      status: ProjectStatus.CREATED,
    },
  });

  return toProjectResponse(project);
};

export const listProjects = async (userId: string): Promise<ProjectResponse[]> => {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  return projects.map(toProjectResponse);
};

export const getProject = async (userId: string, id: string): Promise<ProjectResponse> => {
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) throw projectNotFound();
  return toProjectResponse(project);
};

export const updateProject = async (
  userId: string,
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectResponse> => {
  const data: Prisma.ProjectUpdateManyMutationInput = { ...input };

  if (input.projectUrl !== undefined) {
    const target = await resolveAndValidateTarget(input.projectUrl);
    data.projectUrl = target.url;
  }

  if (input.repositoryUrl !== undefined && input.repositoryUrl !== null) {
    data.repositoryUrl = (await resolveAndValidateTarget(input.repositoryUrl)).url;
  }

  const result = await prisma.project.updateMany({
    where: { id, userId },
    data,
  });

  if (result.count !== 1) throw projectNotFound();
  return getProject(userId, id);
};

export const deleteProject = async (userId: string, id: string): Promise<void> => {
  const result = await prisma.project.deleteMany({ where: { id, userId } });
  if (result.count !== 1) throw projectNotFound();
};
