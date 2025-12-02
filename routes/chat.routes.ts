import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';

const router = Router();

router.post('/', chatController.createChat);
router.get('/', chatController.getChats);
router.get('/:chatId/messages', chatController.getMessages);
router.post('/:chatId/messages', chatController.sendMessage);
router.post('/:chatId/messages/stream', chatController.streamMessage);

export default router;
