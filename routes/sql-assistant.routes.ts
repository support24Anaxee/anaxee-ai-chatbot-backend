import { Router } from 'express';
import {
    executeQuery,
    executeQueryStream,
    getAvailableTables,
    getTableSchema,
    testConnection,
    disconnectProject,
} from '../controllers/sql-assistant.controller';

const router = Router();

/**
 * SQL Assistant Routes
 */

// Execute query (non-streaming)
router.post('/:projectSlug/query', executeQuery);

// Execute query with streaming
router.post('/:projectSlug/query/stream', executeQueryStream);

// Get available tables
router.get('/:projectSlug/tables', getAvailableTables);

// Get table schema
router.get('/:projectSlug/schema', getTableSchema);

// Test database connection
router.post('/:projectSlug/test-connection', testConnection);

// Disconnect from database
router.post('/:projectSlug/disconnect', disconnectProject);

export default router;
