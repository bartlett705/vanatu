export enum BuildType {
    Production = 'prod',
    Development = 'dev',
    Test = 'test',
}

function getBuildType(env: NodeJS.ProcessEnv) {
   switch (env.buildType) {
       case 'prod' : return BuildType.Production
       case 'dev': return BuildType.Development
       case 'test': return BuildType.Test
   }
}

export const config = {
    buildType: getBuildType(process.env),
    port: process.env.PORT || 7331,
    prettyPrint: true,
}
