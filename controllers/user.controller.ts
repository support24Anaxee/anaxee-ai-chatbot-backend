import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { sendSuccess, sendError, asyncHandler } from '../utils/response';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

export const register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email } = req.body;
    if (!name || !email) {
        throw new ValidationError('Name and email are required');
    }

    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
        throw new ConflictError('User already exists');
    }

    const newUser = await userService.createUser(name, email);
    sendSuccess(res, 'User registered successfully', newUser, 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        throw new ValidationError('Email is required');
    }

    const user = await userService.getUserByEmail(email);
    if (!user) {
        throw new NotFoundError('User not found');
    }

    // In a real app, we would check password and issue a JWT.
    // For now, we just return the user info.
    sendSuccess(res, 'Login successful', user);
});
