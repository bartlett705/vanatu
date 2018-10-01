import Koa from 'koa'
import Router from 'koa-router'

const router = new Router()

router.post('/', async (ctx: Koa.Context) => {
    console.log('got:', ctx.request.body)
})

router.get('/test', async (ctx: Koa.Context) => {
    ctx.status = 201
    ctx.body = 'test'
})

export const routes = router.routes()
