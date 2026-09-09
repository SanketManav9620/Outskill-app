import express, { Request, Response } from 'express';
import { asyncHandler, AppError, errorHandler } from '../src/middleware/errorHandler';
import http from 'http';

async function runErrorHandlerTests() {
  console.log('🧪 Testing Centralized Express Error-Handling Middleware & AsyncHandler...\n');

  const app = express();
  app.use(express.json());

  // Test Route 1: Route throwing custom AppError
  app.get(
    '/test/app-error',
    asyncHandler(async (_req: Request, _res: Response) => {
      throw new AppError('Invalid parameter supplied', 400, 'INVALID_PARAMETER');
    })
  );

  // Test Route 2: Route throwing unhandled unexpected Error
  app.get(
    '/test/unhandled-error',
    asyncHandler(async (_req: Request, _res: Response) => {
      throw new Error('Database connection failed unexpectedly');
    })
  );

  // Mount centralized error handler middleware
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  try {
    // Test Case 1: Custom AppError response format
    const res1 = await fetch(`http://localhost:${port}/test/app-error`);
    const json1 = (await res1.json()) as any;

    console.log('--- Test Case 1: AppError Response ---');
    console.log('- Status:', res1.status, '(Expected: 400)');
    console.log('- Body:', JSON.stringify(json1));

    if (
      res1.status === 400 &&
      json1.error &&
      json1.error.message === 'Invalid parameter supplied' &&
      json1.error.code === 'INVALID_PARAMETER'
    ) {
      console.log('✅ Test Case 1 PASSED: Correct error response format returned for AppError.\n');
    } else {
      throw new Error('Test Case 1 FAILED');
    }

    // Test Case 2: Unhandled Rejection Error response format
    const res2 = await fetch(`http://localhost:${port}/test/unhandled-error`);
    const json2 = (await res2.json()) as any;

    console.log('--- Test Case 2: Unhandled Rejection Error Response ---');
    console.log('- Status:', res2.status, '(Expected: 500)');
    console.log('- Body:', JSON.stringify(json2));

    if (
      res2.status === 500 &&
      json2.error &&
      json2.error.message === 'Database connection failed unexpectedly' &&
      json2.error.code === 'INTERNAL_SERVER_ERROR'
    ) {
      console.log('✅ Test Case 2 PASSED: Unhandled rejection caught without crashing process.\n');
    } else {
      throw new Error('Test Case 2 FAILED');
    }

    console.log('==================================================');
    console.log('🎉 ALL ERROR HANDLER TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');
  } finally {
    server.close();
  }
}

runErrorHandlerTests().catch((err) => {
  console.error('❌ Error Handler test script failed:', err);
  process.exit(1);
});
