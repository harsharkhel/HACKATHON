import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { getUser, getUsers, updateUser } from './user.controller';
import { updateUserSchema } from './user.schema';

const router = Router();

router.use(requireAuth);
router.get('/', getUsers);
router.get('/:id', getUser);
router.patch('/:id', validate(updateUserSchema), updateUser);

export default router;
