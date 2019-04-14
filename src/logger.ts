import chalk from 'chalk'
import Koa from 'koa'
import { config } from './config'

interface LogData {
  data: any
  errorMessage: string
  errorStack: string
  host: string
  method: string
  remoteAddress: string[] | string
  responseTime: number
  statusCode: number
  time: string
  url: string
  userAgent: string
}

const error = chalk.bold.red
const warn = chalk.keyword('orange')
const info = chalk.blueBright
const debug = chalk.white
const externalCall = chalk.black.bgGreenBright

const noOp = (): void => undefined

export class Logger {
  public error: (...args: any) => void
  public warn: (...args: any) => void
  public info: (...args: any) => void
  public debug: (...args: any) => void
  public externalCall: (...args: any) => void

  constructor(logLevel: number) {
    this.error = (...args: any) => console.log(error(...args))
    this.warn =
      logLevel > 0 ? (...args: any) => console.log(warn(...args)) : noOp
    this.info =
      logLevel > 1 ? (...args: any) => console.log(info(...args)) : noOp
    this.debug =
      logLevel > 2 ? (...args: any) => console.log(debug(...args)) : noOp
    this.externalCall =
      logLevel > 2
        ? (...args: any) => console.log(externalCall(...args))
        : noOp
  }
}

export const requestLoggerMiddleware = (logger: Logger) => async (
  ctx: Koa.Context,
  next: () => Promise<any>
) => {
  const start = Date.now()
  const logData: Partial<LogData> = {
    method: ctx.method,
    remoteAddress: ctx.request.ips.length ? ctx.request.ips : ctx.request.ip,
    time: new Date().toISOString(),
    url: ctx.url,
    userAgent: ctx.headers['user-agent']
  }

  let errorThrown: any = null
  try {
    await next()
    logData.statusCode = ctx.status
  } catch (e) {
    errorThrown = e
    logData.errorMessage = e.message
    logData.errorStack = e.stack
    logData.statusCode = e.status || 500
    if (e.data) {
      logData.data = e.data
    }
  }

  logData.responseTime = Date.now() - start
  outputLog(logger, logData, errorThrown)

  if (errorThrown) {
    throw errorThrown
  }
}

function outputLog(logger: Logger, data: Partial<LogData>, thrownError: any) {
  if (config.prettyPrint) {
    logger.info(
      `${data.statusCode} ${data.method} ${data.url} - ${data.responseTime}ms`
    )
    if (thrownError) {
      logger.error(thrownError)
    }
  } else if (data.statusCode < 400) {
    process.stdout.write(JSON.stringify(data) + '\n')
  } else {
    process.stderr.write(JSON.stringify(data) + '\n')
  }
}
