import { eq } from 'drizzle-orm';
import { db } from '../config/db.config';
import { projects } from '../models/projects';

export const createProject = async (name: string, slug: string, scriptName: string) => {
    try {
        const [result] = await db.insert(projects).values({ name, slug, scriptName }).$returningId();
        return { id: result.id, name, slug, scriptName };
    } catch (error) {
        throw error;
    }
};

export const getProjectBySlug = async (slug: string) => {
    try {
        const result = await db.select().from(projects).where(eq(projects.slug, slug));
        return result[0];
    } catch (error) {
        throw error;
    }
};

export const getProjectById = async (id: number) => {
    try {
        const result = await db.select().from(projects).where(eq(projects.id, id));
        return result[0];
    } catch (error) {
        throw error;
    }
};

export const getAllProjects = async () => {
    try {
        return await db.select().from(projects);
    } catch (error) {
        throw error;
    }
};
