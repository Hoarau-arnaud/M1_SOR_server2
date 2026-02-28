import { Application } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { errorMiddleware } from "./middleware/error.ts";
import { entropyMiddleware } from "./middleware/entropy.ts";

import pollsRouter from "./routes/polls.ts";
import votesRouter from "./routes/votes.ts";
import usersRouter from "./routes/users.ts";

const PROTOCOL = "http";
const HOSTNAME = "localhost";
const PORT = 8000;
const ADDRESS = `${PROTOCOL}://${HOSTNAME}:${PORT}`;

const app = new Application();

app.use(errorMiddleware);
app.use(entropyMiddleware);
app.use(oakCors());

app.use(pollsRouter.routes());
app.use(pollsRouter.allowedMethods());

app.use(votesRouter.routes());
app.use(votesRouter.allowedMethods());

app.use(usersRouter.routes());
app.use(usersRouter.allowedMethods());

app.addEventListener(
  "listen",
  () => console.log(`Server listening on ${ADDRESS}`),
);

if (import.meta.main) {
  await app.listen({ hostname: HOSTNAME, port: PORT });
}

export { app };