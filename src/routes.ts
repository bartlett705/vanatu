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
    const payload = JSON.stringify(ctx.request.body);

    const hmac = crypto.createHmac("sha1", config.hubSecret);
    const computedSignature = "sha1=" + hmac.update(payload).digest("hex");
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

    const sshURL = (ctx.request.body as any).repository.ssh_url;
    const name = (ctx.request.body as any).repository.name;
    logger.debug("Going to update ", name, " from ", sshURL);
    let child: ChildProcess;

    const targetDir = path.join(config.baseContentDir, name);
    if (!fileSystem.existsSync(targetDir)) {
      logger.debug("target not found in vanatu; cloning into", targetDir);
      child = spawn("git", ["clone", sshURL, targetDir], { stdio: "inherit" });
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
      ctx.status = 500;
      return;
    }

    logger.info("Repo Updated. Running install step.");

    const installChild = spawn("npm", ["ci"], { stdio: "inherit" })
    try {
      await promisify(installChild);
    } catch (err) {
      logger.error("failed to run install step.", err)

      ctx.status = 500;
      return;
    }

    logger.info("Install completed. Running build step.");

    const buildChild = spawn("npm", ["run", "build:vanatu"], { stdio: "inherit" })
    try {
      await promisify(buildChild);
    } catch (err) {
      logger.error("failed to run build step.", err)

      ctx.status = 500;
      return;
    }
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
