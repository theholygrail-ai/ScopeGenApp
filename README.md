# ScopeGenApp
Used to convert BRD into client ready SOW 

## Environment Variables

Create a `.env` file with the following entries for the backend:

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
# CORS configuration
CORS_ORIGIN=https://your-frontend-domain.example.com
```

The `PS_API_KEY` is required for the `/ps/tasks/:runId` endpoint which lists tasks for a workflow run.

### Frontend

The web frontend reads its backend URL from `VITE_API_BASE_URL`. Set this
environment variable in the Amplify build or your local `.env` file to point to
the deployed API Gateway URL. Two example stages are:

```
Staging:   https://wiztvffuyg.execute-api.us-east-1.amazonaws.com/staging
Production: https://wiztvffuyg.execute-api.us-east-1.amazonaws.com/production
```

An optional `VITE_ADMIN_TOKEN` can be provided to enable admin UI features. It
is sent as the `x-admin-token` header when calling admin routes such as
`POST /admin/cache/clear`.

An admin endpoint `POST /admin/cache/clear` clears the in-memory slide cache and
resets metrics. Send the `x-admin-token` header matching `ADMIN_TOKEN`.

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

### CLI Deployment (PowerShell)

1. **Package the backend**

   ```powershell
   npm run prepare-lambda
   npm run package-lambda
   ```

2. **Upload the code to Lambda**

   ```powershell
   aws lambda update-function-code `
     --function-name sow-backend_function `
     --zip-file fileb://lambda.zip `
     --region us-east-1
   ```

3. **Configure environment variables**

   ```powershell
   aws lambda update-function-configuration `
     --function-name sow-backend_function `
     --environment "Variables={PS_API_KEY=...,ADMIN_TOKEN=...,GEMINI_API_KEY=...,TOGETHER_API_KEY=...,DATABASE_URL=...,GOOGLE_SHEET_ID=...,GOOGLE_SHEET_NAME=...,CORS_ORIGIN=https://your-frontend.example.com}" `
     --region us-east-1
   ```

4. **Test the function**

   ```powershell
   aws lambda invoke `
     --function-name sow-backend_function `
     --payload '{"httpMethod":"GET","path":"/health"}' `
     output.json `
     --region us-east-1
   Get-Content output.json
   aws logs tail /aws/lambda/sow-backend_function --follow --region us-east-1
   ```

## AWS Amplify Deployment

1. **Connect Repository** - In the AWS Amplify console create a new app and
   connect this repository. Amplify will use `amplify.yml` to build the
   frontend located in `sow-web`.
2. **Package the Backend** - Run `npm run package-lambda` to create
   `lambda.zip` containing the Express application and its dependencies.
   Upload this archive as a Lambda function and set the handler to
   `lambda.handler`.
3. **Create API Gateway** - Add an HTTP API Gateway trigger for the Lambda
   function and note the invoke URL. Configure environment variables in the
   Lambda function to match `.env`.
4. **Point the Frontend** - In Amplify add an environment variable
   `VITE_API_BASE_URL` set to the API Gateway URL so the React app can reach the
   backend.

With these steps the SOW web frontend will be served by Amplify and all backend
requests will be routed through the Lambda/API Gateway endpoint.

## Manual Testing

To verify the API stages directly:

```
curl -i "https://wiztvffuyg.execute-api.us-east-1.amazonaws.com/staging/ps/runs?workflowId=<some-id>"
curl -i "https://wiztvffuyg.execute-api.us-east-1.amazonaws.com/production/ps/runs?workflowId=<some-id>"
```

Admin routes require the token header:

```
curl -i -H "x-admin-token: <token>" "https://wiztvffuyg.execute-api.us-east-1.amazonaws.com/staging/admin/cache/clear"
```

When the frontend is deployed, open the browser console to confirm a log similar
to `Resolved API base URL: https://.../staging`. Network requests such as
`/ps/runs` should hit the same base URL and return data without CORS errors.


