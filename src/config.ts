export enum BuildType {
    Production = 'prod',
    Development = 'dev',
    Test = 'test',
}

function getBuildType(env: NodeJS.ProcessEnv) {
   switch (env.BUILD_TYPE) {
       case 'prod' : return BuildType.Production
       case 'dev': return BuildType.Development
       case 'test': return BuildType.Test
   }
}

const buildType = getBuildType(process.env)
const isProduction = buildType === BuildType.Production

if (!process.env.HUB_HEADER || !process.env.HUB_SECRET) {
    throw new Error("Hub signature info missing!")
}

export const config = {
    baseContentDir: process.env.BASE_CONTENT_DIR,
    buildType,
    hubHeader: process.env.HUB_HEADER,
    hubSecret: process.env.HUB_SECRET,
    logLevel: Number(process.env.LOG_LEVEL) || (isProduction ? 0 : 4),
    port: Number(process.env.PORT) || (isProduction ? 7409 : 7410),
    prettyPrint: !isProduction,
    sshURLs: JSON.parse(process.env.SSH_URLS)
}
