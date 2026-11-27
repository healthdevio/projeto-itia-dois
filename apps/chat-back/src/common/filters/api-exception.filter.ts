import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '../../models/api-response.js';
import { ContractValidationError } from '../../models/contract-validation.js';
import { sanitizeForLog } from '../../utils/sanitize-for-log.js';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractHttpExceptionMessage(exception: HttpException): string {
  const payload = exception.getResponse();

  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  if (isObjectRecord(payload)) {
    if (typeof payload.error === 'string' && payload.success === false) {
      return payload.error;
    }

    if (Array.isArray(payload.message)) {
      const messages = payload.message.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      );
      if (messages.length > 0) {
        return messages.join('; ');
      }
    }

    if (
      typeof payload.message === 'string' &&
      payload.message.trim().length > 0
    ) {
      return payload.message;
    }
  }

  return 'Requisição inválida';
}

function isMalformedJsonError(exception: unknown): boolean {
  if (!(exception instanceof SyntaxError)) {
    return false;
  }
  const status = (exception as { status?: unknown }).status;
  return status === HttpStatus.BAD_REQUEST;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ContractValidationError) {
      const body: ApiResponse = {
        success: false,
        error: exception.message,
      };
      response.status(HttpStatus.BAD_REQUEST).json(body);
      return;
    }

    if (isMalformedJsonError(exception)) {
      const body: ApiResponse = {
        success: false,
        error: 'Corpo da requisição inválido',
      };
      response.status(HttpStatus.BAD_REQUEST).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        console.error(
          `[Core] Erro HTTP 5xx capturado: ${JSON.stringify({ status, error: sanitizeForLog(exception.message) })}`,
        );
        const body: ApiResponse = {
          success: false,
          error: 'Erro interno do servidor',
        };
        response.status(status).json(body);
        return;
      }

      const body: ApiResponse = {
        success: false,
        error: extractHttpExceptionMessage(exception),
      };
      response.status(status).json(body);
      return;
    }

    console.error(
      `[Core] Erro não tratado: ${JSON.stringify(sanitizeForLog(exception))}`,
    );
    const body: ApiResponse = {
      success: false,
      error: 'Erro interno do servidor',
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
