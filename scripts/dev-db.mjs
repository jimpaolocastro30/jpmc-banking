import { MongoMemoryServer } from "mongodb-memory-server";
import { writeFileSync } from "fs";

process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || "7.0.24";

const server = await MongoMemoryServer.create({ instance: { dbName: "bankak" } });
const uri = server.getUri("bankak");
writeFileSync(
  ".env.local",
  `MONGODB_URI=${uri}\nJWT_SECRET=local-dev-secret-bankak-32\nAPP_URL=http://localhost:3000\n`,
);
console.log(`READY ${uri}`);
setInterval(() => undefined, 60_000);
