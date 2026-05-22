import { loadRootEnv } from '../../scripts/load-root-env.js'

if (process.env.NODE_ENV !== 'test') {
  loadRootEnv({
    production:
      process.env.APP_ENV === 'production' ||
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.VERCEL),
  })
}
