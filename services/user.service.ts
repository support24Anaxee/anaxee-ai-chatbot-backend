import { eq } from 'drizzle-orm';
import { db } from '../config/db.config';
import { users } from '../models/users';
import { usersClient } from '../models/users.client';

export const createUser = async (name: string, email: string) => {
    try {
        const [result] = await db.insert(users).values({ name, email }).$returningId();
        return { id: result.id, name, email };
    } catch (error) {
        throw error;
    }
};

export const getUserByEmail = async (email: string) => {
    try {
        const result = await db.select().from(usersClient).where(eq(usersClient.email, email));
        return result[0];
    } catch (error) {
        throw error;
    }
};

export const getUserById = async (id: number) => {
    try {
        const result = await db.select().from(usersClient).where(eq(usersClient.id, id));
        return result[0];
    } catch (error) {
        throw error;
    }
};
