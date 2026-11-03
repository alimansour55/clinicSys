/** Joins class names, skipping falsy values. Use the `!` suffix to override a primitive's class. */
export const cx = (...classes) => classes.filter(Boolean).join(' ')
