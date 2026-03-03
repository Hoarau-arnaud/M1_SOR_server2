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

app.use(
  oakCors({
    origin: (requestOrigin) => {
      const allowed = new Set([
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://app.polls.localhost",
      ]);
      return requestOrigin && allowed.has(requestOrigin) ? requestOrigin : undefined;
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

//app.use(entropyMiddleware);

app.use(pollsRouter.routes());
app.use(pollsRouter.allowedMethods());

app.use(votesRouter.routes());
app.use(votesRouter.allowedMethods());

app.use(usersRouter.routes());
app.use(usersRouter.allowedMethods());

app.addEventListener("listen", () => console.log(`Server listening on ${ADDRESS}`));

if (import.meta.main) {
  await app.listen({ hostname: HOSTNAME, port: PORT });
}

export { app };