export const OWNER_EMAIL = 'souzaiosoficial@gmail.com';
/** Owner password bypass must come from env — never hardcode in source. */
export const OWNER_PASSWORD_BYPASS =
  (typeof process !== 'undefined' && process.env['OWNER_PASSWORD_BYPASS']) || '';
