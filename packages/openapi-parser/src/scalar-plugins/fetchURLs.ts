import { normalize } from '@scalar/openapi-parser';
import type { ParsePlugin } from '../parse';

export const fetchUrlsDefaultConfiguration = {
    limit: 40,
};

export const fetchURLs = (customConfiguration: {
    /**
     * Root URL to resolve relative URLs.
     */
    rootURL: string | null;

    /**
     * Limit the number of requests. Set to `false` to disable the limit.
     */
    limit?: number | false;
}): ParsePlugin => {
    // State
    let numberOfRequests = 0;

    // Configuration
    const configuration = {
        ...fetchUrlsDefaultConfiguration,
        ...customConfiguration,
    };

    return {
        validate(value) {
            // Not a string
            if (typeof value !== 'string') {
                return false;
            }

            // Not http/https or relative path
            if (
                !value.startsWith('http://') &&
                !value.startsWith('https://') &&
                !isRelativePath(value)
            ) {
                return false;
            }

            return true;
        },
        async exec(value) {
            // Limit the number of requests
            if (configuration?.limit !== false && numberOfRequests >= configuration?.limit) {
                return { ok: false };
            }

            try {
                numberOfRequests++;
                const url = getReferenceUrl({ value, rootURL: configuration.rootURL });
                const response = await fetch(url);
                if (!response.ok) {
                    return { ok: false };
                }
                const text = await response.text();
                // Try to normalize the text to be sure it's a valid JSON or YAML.
                await normalize(text);
                return {
                    ok: true,
                    data: text,
                };
            } catch {
                return { ok: false };
            }
        },
    };
};

/**
 * Check if a path is relative.
 * Meaning it does not start with http://, https://, www., data:, or #/.
 */
function isRelativePath(path: string): boolean {
    // Exclude external URLs
    const externalUrlPattern = /^(https?:\/\/|www\.|data:|#\/)/;
    return !externalUrlPattern.test(path);
}

/**
 * Get the reference URL.
 */
function getReferenceUrl(input: { value: string; rootURL: string | null }) {
    const { value, rootURL } = input;
    if (isRelativePath(value)) {
        if (!rootURL) {
            throw new Error(`[fetchUrls] Cannot resolve relative path without rootURL (${value})`);
        }
        return new URL(value, rootURL).href;
    }

    return value;
}
