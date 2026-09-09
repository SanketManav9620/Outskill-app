import { Request, Response, NextFunction } from 'express';
import { env } from '../env';

export function basicAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin"');
    res.status(401).send('Authentication required for administrative dashboard');
    return;
  }

  const credentialsBase64 = authHeader.split(' ')[1] || '';
  const credentials = Buffer.from(credentialsBase64, 'base64').toString('utf8').split(':');
  const username = credentials[0];
  const password = credentials[1];

  const expectedUser = env.BULLBOARD_USER || 'admin';
  const expectedPass = env.BULLBOARD_PASS || 'admin123';

  if (username === expectedUser && password === expectedPass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin"');
    res.status(401).send('Invalid admin credentials');
  }
}
