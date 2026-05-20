/** Slugify a free-text string for use in URL paths. */
export function slugify(s, max = 60) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max);
}
/** Append a short random suffix so concurrent slugs don't collide. */
export function slugifyUnique(s, max = 60) {
    return `${slugify(s, max - 8)}-${Date.now().toString(36).slice(-6)}`;
}
//# sourceMappingURL=slug.js.map