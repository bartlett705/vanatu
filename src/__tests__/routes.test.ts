import { join } from "path";
// tslint:disable-next-line:no-var-requires
require("dotenv").config({ path: join(__dirname, "./.env.test") });
import { Server } from "http";
import Koa from "koa";
import bodyParser = require("koa-bodyparser");
import supertest = require("supertest");
import { Logger } from "../logger";

// perhaps a small abuse of closures, this.
let failChild = false;
const mockSpawn = jest.fn((cmd: string) => ({
  on: (event: string, cb: Function) => {
    if (failChild && event === "error") {
      cb();
    }
    // insta-exit child processes
    if (event === "exit") {
      cb();
    }
  }
}));

jest.mock("child_process", () => ({
  spawn: mockSpawn
}));

const mockFS = {
  existsSync: jest.fn((path: string, data: string, callback: any) => {
    // console.log("looking for", path);
    if (path === "/test/vanatu/existing") {
      return true;
    }
    return false;
  })
};

import { createRoutes } from "../routes";

let server: Server;
beforeEach(() => {
  mockSpawn.mockClear();
  mockFS.existsSync.mockClear();
});
afterEach(() => server.close());
const setup = () => {
  const app = new Koa();
  const logger = new Logger(0);
  app.use(bodyParser({ onerror: err => console.error(err) }));
  // @ts-ignore
  app.use(createRoutes(logger, mockFS));
  server = app.listen(3000);
  const req = supertest(server);
  return { req, app, mockFS };
};

const mockPayload = (overrides?: any) => ({
  action: "completed",
  repository: "charcoal-client",
  ...overrides,
});

describe("On Check webhook", () => {
  it("403s a bad webhook signature and does not process anything", async () => {
    const { req } = setup();
    await req
      .post("/")
      .set("X-Hub-Signature", "sha1=232323")
      .send({ name: "junk" })
      .expect(403);

    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("does nothing if the payload is not a completed action", async () => {
    const { req } = setup();
    await req
      .post("/")
      .set("X-Hub-Signature", "sha1=a52ac91f6d24624d4925afe4afbe2c607fa35a5a")
      .send({ action: "requested" })
      .expect(200);

    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("clones a repo it has not seen before", async () => {
    const chdirSpy = jest.spyOn(process, "chdir").mockImplementation();
    const { req } = setup();
    await req
      .post("/")
      .set("X-Hub-Signature", "sha1=99ea7190d769cb732fa4d1274e3802c0e7948ee9")
      .send(mockPayload())
      .expect(200);

    expect(mockSpawn).toHaveBeenCalledTimes(3);

    expect(mockSpawn.mock.calls[0]).toMatchInlineSnapshot(`
            Array [
              "git",
              Array [
                "clone",
                "git+ssh+stuff",
                "/test/vanatu/charcoal-client",
              ],
              Object {
                "stdio": "inherit",
              },
            ]
        `);
    expect(chdirSpy).toHaveBeenCalledTimes(1)
    expect(chdirSpy).toHaveBeenCalledWith('/test/vanatu/charcoal-client')
    expect(mockSpawn.mock.calls[1]).toMatchInlineSnapshot(`
            Array [
              "npm",
              Array [
                "ci",
              ],
              Object {
                "stdio": "inherit",
              },
            ]
        `);
    expect(mockSpawn.mock.calls[2]).toMatchInlineSnapshot(`
            Array [
              "npm",
              Array [
                "run",
                "build:vanatu",
              ],
              Object {
                "stdio": "inherit",
              },
            ]
        `);
  });

  it("clones a repo it has not seen before", async () => {
    const chdirSpy = jest.spyOn(process, "chdir").mockImplementation();
    chdirSpy.mockClear();
    const { req } = setup();
    await req
      .post("/")
      .set("X-Hub-Signature", "sha1=47f1acb141ddbdeb81c474923e571dfccab7c56c")
      .send(mockPayload({ repository: "existing" }))
      .expect(200);

    expect(chdirSpy).toHaveBeenCalledWith("/test/vanatu/existing");
    expect(chdirSpy).toHaveBeenCalledTimes(2)
    expect(mockSpawn).toHaveBeenCalledTimes(3);

    expect(mockSpawn.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "git",
        Array [
          "pull",
        ],
        Object {
          "stdio": "inherit",
        },
      ]
    `);
    expect(mockSpawn.mock.calls[1]).toMatchInlineSnapshot(`
      Array [
        "npm",
        Array [
          "ci",
        ],
        Object {
          "stdio": "inherit",
        },
      ]
    `);
    expect(mockSpawn.mock.calls[2]).toMatchInlineSnapshot(`
      Array [
        "npm",
        Array [
          "run",
          "build:vanatu",
        ],
        Object {
          "stdio": "inherit",
        },
      ]
    `);
  });
});
