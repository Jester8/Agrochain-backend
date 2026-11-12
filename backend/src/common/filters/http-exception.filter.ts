import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Nest's built-in exceptions (and ValidationPipe's 400s) wrap the actual
    // message inside an object like { statusCode, message, error } rather
    // than returning it directly - unwrap that here so clients always get a
    // plain string or string[], never a nested object to accidentally render.
    let message: string | string[] = 'Something went wrong. Please try again.';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object' && 'message' in res) {
        message = (res as { message: string | string[] }).message;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
