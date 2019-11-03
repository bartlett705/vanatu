import { ChildProcess, spawn } from "child_process";
import crypto from "crypto";
import Koa from "koa";
import * as fs from 'fs'
import Router from "koa-router";
import path from "path";
import { config } from "./config";
import { Logger } from "./logger";


export const createRoutes = (logger: Logger, fileSystem = fs) => {
  const router = new Router();

  router.post("/", async (ctx: Koa.Context) => {
    const rawBody = JSON.stringify(ctx.request.body);

    const hmac = crypto.createHmac("sha1", config.hubSecret);
    const computedSignature = "sha1=" + hmac.update(rawBody).digest("hex");
    const receivedSignature = ctx.request.headers[config.hubHeader];
    logger.debug("computed:", computedSignature);
    logger.debug("received:", receivedSignature);

    if (!receivedSignature || !computedSignature || receivedSignature !== computedSignature) {
      ctx.status = 403;
      ctx.body = "Checksums did not match!";
      logger.warn("Bad Checksum from GH");
      return;
    }

    logger.info("Checksum confirmed 👍");
    ctx.status = 200;

    const payload: any = ctx.request.body as any
    // Ensure this is a payload we want to handle - namely succesful check_suites
    if (payload.action !== "completed") {
      logger.info('Received non-actionable payload: ', payload.action)
      ctx.status = 200;
      return;
    }
    
    processPayload(logger, payload, fileSystem)
    ctx.status = 200;
    return;
  });

  return router.routes();
};

  function promisify(child: ChildProcess) {
    return new Promise((res, rej) => {
      child.on("exit", () => {
        res();
      });
      child.on("error", (err) => {
        console.error("Bad stuff happened: ", err);
        rej();
      });
    });
  }

async function processPayload(logger: Logger, payload: any, fileSystem: typeof fs) {
  const name = payload.repository;
  logger.debug("Going to update ", name, " from ", config.sshURLs[name]);
  let child: ChildProcess;

  const targetDir = path.join(config.baseContentDir, name);
  if (!fileSystem.existsSync(targetDir)) {
    logger.debug("target not found in vanatu; cloning into", targetDir);
    child = spawn("git", ["clone", config.sshURLs[name], targetDir], { stdio: "inherit" });
  } else {
    logger.debug(
      "target found in vanatu; pulling latest master in ",
      targetDir
    );

    process.chdir(targetDir);
    child = spawn("git", ["pull"], { stdio: "inherit" })
  }

  logger.debug("Awaiting child process.");

  try {
    await promisify(child);
  } catch (err) {
    logger.error("failed to update repo.", err)
    return;
  }

  process.chdir(targetDir);
  logger.info("Repo Updated. Running install step.");

  const installChild = spawn("npm", ["ci"], { stdio: "inherit" })
  try {
    await promisify(installChild);
  } catch (err) {
    logger.error("failed to run install step.", err)
    return;
  }

  logger.info("Install completed. Running build step.");

  const buildChild = spawn("npm", ["run", "build:vanatu"], { stdio: "inherit" })
  try {
    await promisify(buildChild);
  } catch (err) {
    logger.error("failed to run build step.", err)
    return;
  }

  logger.info(`${name} build complete!`)
} 
