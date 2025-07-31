# ScopeGenApp
Used to convert BRD into client ready SOW 

## Environment Variables

Create a `.env` file with the following entries:

```
GEMINI_API_KEY=<your gemini key>
PS_API_KEY=<your process street api key>
TOGETHER_API_KEY=<your together.ai key>
# Optional override
TOGETHER_API_BASE=https://api.together.ai
```

The `PS_API_KEY` is required for the `/ps/tasks/:runId` endpoint which lists tasks for a workflow run.
