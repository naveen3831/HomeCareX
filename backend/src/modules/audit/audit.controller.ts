
import type { Request, Response } from 'express';
import { auditService } from './audit.service';
import {
  AuditQueryValidationError,
  parseAuditQuery,
} from './audit.validation';

export class AuditController {
  async getAuditLogs(req: Request, res: Response) {
    let query;

    // Validate query parameters before querying the database.
    try {
      query = parseAuditQuery(
        req.query as Record<string, unknown>
      );
    } catch (error) {
      if (error instanceof AuditQueryValidationError) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      throw error;
    }

    // Retrieve audit logs. Unexpected errors are handled by
    // the existing Express error-handling middleware.
    const result = await auditService.getAuditLogs(query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  }
}

export const auditController = new AuditController();
