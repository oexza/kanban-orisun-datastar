/**
 * URL utility functions for the inventory management application
 */
/**
 * Get the base URL for the application based on the environment
 * @returns The appropriate base URL for the current environment
 */
export function getBaseUrl() {
    // Check if we're in local development
    if (process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'local' ||
        !process.env.NODE_ENV) {
        return 'http://localhost:3001';
    }
    // Check if we're in preview/staging
    if (process.env.NODE_ENV === 'test') {
        return 'https://test-inventory.jetvision.ai';
    }
    // Production environment
    return 'https://inventory.jetvision.ai';
}
