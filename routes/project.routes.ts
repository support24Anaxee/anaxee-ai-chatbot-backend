import { Router } from 'express';
import * as projectController from '../controllers/project.controller';

const router = Router();

router.post('/', projectController.createProject);
router.get('/', projectController.getProjects);

export default router;
