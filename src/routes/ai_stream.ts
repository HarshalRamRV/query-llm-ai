import { Router } from 'express';

const router = Router();

router.post('/stream', (_req, res) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'AI SDK stream endpoint not implemented yet',
    },
  });
});

export default router;
