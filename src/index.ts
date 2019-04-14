import dotenv from 'dotenv'
dotenv.config({ })
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { config } from './config'
import { requestLoggerMiddleware, Logger } from './logger'
import { createRoutes } from './routes'
import * as fs from 'fs';

const app = new Koa()
const logger = new Logger(config.logLevel)
app.use(requestLoggerMiddleware(logger))
app.use(bodyParser())
app.use(createRoutes(logger, fs))

app.listen(config.port)
logger.info(`Vanatu running on port ${config.port}`)
logger.info(`Working Directory: ${config.baseContentDir}`)
logger.info('Current Contents:', fs.readdirSync(config.baseContentDir))
