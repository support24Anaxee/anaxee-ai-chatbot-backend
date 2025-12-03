import { eq } from 'drizzle-orm';
import { db } from '../config/db.config';
import { projects } from '../models/projects';
import { DatabaseConfig } from '../types/sql-assistant.types';

export const createProject = async (
    name: string,
    slug: string,
    scriptName: string,
    tables?: string[],
    businessRule?: string,
    dbConfig?: DatabaseConfig
) => {
    try {
        const [result] = await db.insert(projects).values({
            name,
            slug,
            scriptName,
            tables,
            businessRule,
            dbConfig,
        }).$returningId();
        return { id: result.id, name, slug, scriptName, tables, businessRule, dbConfig };
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
