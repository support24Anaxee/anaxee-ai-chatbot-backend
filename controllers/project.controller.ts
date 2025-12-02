import { Request, Response } from 'express';
import * as projectService from '../services/project.service';
import { sendSuccess, asyncHandler } from '../utils/response';
import { ConflictError, ValidationError } from '../utils/errors';

export const createProject = asyncHandler(async (req: Request, res: Response) => {
    const { name, slug, scriptName } = req.body;
    if (!name || !slug || !scriptName) {
        throw new ValidationError('Name, slug, and scriptName are required');
    }

    const existingProject = await projectService.getProjectBySlug(slug);
    if (existingProject) {
        throw new ConflictError('Project with this slug already exists');
    }

    const newProject = await projectService.createProject(name, slug, scriptName);
    sendSuccess(res, 'Project created successfully', newProject, 201);
});

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
    const projects = await projectService.getAllProjects();
    sendSuccess(res, 'Projects retrieved successfully', projects);
});
