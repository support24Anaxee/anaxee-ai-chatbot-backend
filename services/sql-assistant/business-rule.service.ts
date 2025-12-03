import { getOrSetCached } from '../../utils/cache-utils';
import { generateBusinessRuleKey, cacheConfig } from '../../config/cache.config';
import logger from '../../utils/logger';

/**
 * Business rule service for managing project-specific SQL generation rules
 */
export class BusinessRuleService {
    constructor(
        private projectId: number,
        private businessRule?: string
    ) { }

    /**
     * Get business rule with caching
     */
    async getBusinessRule(): Promise<string> {
        if (!this.businessRule) {
            return '';
        }

        const cacheKey = generateBusinessRuleKey(this.projectId);

        try {
            return await getOrSetCached(
                cacheKey,
                cacheConfig.businessRuleTTL,
                async () => this.businessRule || ''
            );
        } catch (error) {
            logger.error('Error getting business rule:', error);
            return this.businessRule; // Fallback to direct value
        }
    }

    /**
     * Format business rule for AI prompt
     */
    async formatForPrompt(): Promise<string> {
        const rule = await this.getBusinessRule();

        if (!rule || rule.trim().length === 0) {
            return '';
        }

        return `\nBusiness Rules:\n${rule}\n`;
    }

    /**
     * Check if specific tables trigger special business rules
     */
    hasSpecialRules(tableNames: string[]): boolean {
        // Example: Check if certain table combinations exist
        const specialTables = new Set([
            'apar_mapping_qa_data',
            'apar_profiling_qa_data',
            'apar_order_taking_qa_data'
        ]);

        return tableNames.some(table => specialTables.has(table));
    }
}
