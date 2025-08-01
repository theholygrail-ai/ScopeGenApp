# ScopeGenApp
Used to convert BRD into client ready SOW 

## Environment Variables

Create a `.env` file with the following entries:

```
GEMINI_API_KEY=<your gemini key>
PS_API_KEY=<your process street api key>
TOGETHER_API_KEY=<your together.ai key>
# Optional database
DATABASE_URL=postgres://user:pass@localhost:5432/db
# Optional override
TOGETHER_API_BASE=https://api.together.ai
# Cache settings
CACHE_TTL_MS=3600000
ADMIN_TOKEN=changeme
VITE_API_BASE_URL=http://localhost:8000
```

The `PS_API_KEY` is required for the `/ps/tasks/:runId` endpoint which lists tasks for a workflow run.

An admin endpoint `POST /admin/cache/clear` clears the in-memory slide cache and resets metrics. Send the `x-admin-token` header matching `ADMIN_TOKEN`.

## Slide Editing API

Slides are generated and edited via the `/slides` routes.

* `POST /slides/generate` body `{ fullSow: "markdown" }` → returns an array of slide objects with `id` and `currentHtml`.
* `POST /slides/:id/edit` body `{ instruction: "Add teal header" }` → updates the slide and returns it.
* `GET /slides/:id` → returns a single slide with its version and chat history.
* `GET /slides/:id/versions` → lists prior versions of the slide HTML.
* `POST /slides/:id/revert` body `{ versionIndex: 0 }` → restores a previous version.

Each slide tracks `chatHistory`, `currentHtml`, and `versionHistory` as it is edited.

When `DATABASE_URL` is provided, generated slides are persisted with a run identifier. Additional endpoints become available:

* `GET /slides/export/html/:runId` → downloads a consolidated HTML presentation for a run.
* `GET /export/pptx/run/:runId` → generates a PPTX file from the stored slides using their latest HTML.
## Lambda Deployment

To run the Express app on AWS Lambda with API Gateway, install `serverless-http` and create `lambda.js`:

```js
const serverless = require('serverless-http');
const app = require('./server');

module.exports.handler = serverless(app);
```

Deploy `lambda.js` as a Lambda function and attach an API Gateway trigger.


