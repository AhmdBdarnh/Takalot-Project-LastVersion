## Getting started

Create a help-seeker or technician account from the login page, then sign in using the account type selector.

## Deploying to Render

This repository deploys the Node.js web application. Deploy the Flask image classifier from its own repository as a separate Render web service, then set `PYTHON_API_URL` to that service's `/predict` URL.

The included `render.yaml` configures Node.js, `npm ci`, `npm start`, and the `/health` health check. Set `MONGO_URI` to the MongoDB Atlas connection string. Render generates `SESSION_SECRET` from the blueprint; keep it stable across deploys so browser sessions survive restarts. `PORT` is supplied by Render and should not be hard-coded.

Keep database credentials and API keys in Render's environment settings, not in the repository. `.env` and `sendgrid.env` are ignored by Git.
