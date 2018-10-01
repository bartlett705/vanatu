
import Koa from 'koa'

import bodyParser from 'koa-bodyparser'
import { config } from './config'
import { logger } from './logger'
import { routes } from './routes'

const app = new Koa()

app.use(logger)
app.use(bodyParser())
app.use(routes)

app.listen(config.port)

console.log(`Vanatu running on port ${config.port}`)
