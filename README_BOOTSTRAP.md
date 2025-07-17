# Brand Configuration

All organisation-wide branding assets and stakeholder details are defined in `brandingAssets/brandconfig.json`.

This file is loaded on server start via `config/brandContext.js`. The loader validates required fields and exposes a singleton `brandContext` object used by the agents.

To update branding:
1. Edit `brandingAssets/brandconfig.json` with new values or asset paths.
2. Restart the server so `brandContext` picks up the changes.

Agents that generate output receive `brandContext` and pull colours, fonts and stakeholder rows directly from it.

`npm test` ensures the configuration can be loaded and errors are thrown if required keys are missing.
