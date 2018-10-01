import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import Koa from 'koa'
import Router from 'koa-router'
import path, { resolve } from 'path'
import rimraf from 'rimraf'
import { config } from './config'

const baseContentDir = '/var/www/vanatu_deployed'
const router = new Router()

router.post('/', async (ctx: Koa.Context) => {
    const payload = JSON.stringify(ctx.request.body)

    const hmac = crypto.createHmac('sha1', config.hubSecret)
    const digest = 'sha1=' + hmac.update(payload).digest('hex')
    const checksum = ctx.request.headers[config.hubHeader]
    console.log('digest:', digest)
    console.log('checksum:', checksum)

    if (!checksum || !digest || checksum !== digest) {
        ctx.status = 403
        ctx.body = 'Checksums did not match!'
        console.warn('Bad Checksum from GH')
        return
    }

    console.info('Checksum confirmed 👍')
    ctx.status = 200

    const sshURL = (ctx.request.body as any).repository.ssh_url
    const name = (ctx.request.body as any).repository.name
    console.log('Going to clone ', name, ' from ', sshURL)

    const targetDir = path.join(baseContentDir, name)
    console.log('Removing directory: ', targetDir)
    rimraf.sync(targetDir)

    console.log('Creating directory: ', targetDir)
    fs.mkdirSync(targetDir)

    console.log('Cloning')
    const child = spawn(
        'git', ['clone', sshURL, targetDir],
        { stdio: 'inherit' },
        )

    try {
        await new Promise((res, rej) => {
            child.on('exit', () => {
                res()
            })

            child.on('error', (err) => {
                console.error('Bad stuff happened: ', err)
                rej()
            })
        })

    } catch (err) {
        ctx.status = 500
        return
    }

    console.log('Repo Delivered...I think!')
})

export const routes = router.routes()
