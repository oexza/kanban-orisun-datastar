/**
 * Converts a PascalCase class name to snake_case
 * @param className - The class name to convert (e.g., "ClerkOrganizationEventHandler")
 * @returns The converted snake_case name (e.g., "clerk_organization_event_handler")
 */
export function classNameToSnakeCase(className: string): string {
    return className.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Converts a constructor function's name to snake_case
 * @param constructor - The constructor function
 * @returns The converted snake_case name
 */
export function constructorNameToSnakeCase(constructor: Function): string {
    return classNameToSnakeCase(constructor.name);
}

export function formatSnakeCase(str: string): string {
  if (!str) return 'N/A';
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}