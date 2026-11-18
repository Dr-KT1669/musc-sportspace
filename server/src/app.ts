import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { errorHandler } from './http.js'
import { api } from './routes.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: true, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', api)

  if (process.env.NODE_ENV === 'production') {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
    app.use(express.static(root))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.sendFile(path.join(root, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}
