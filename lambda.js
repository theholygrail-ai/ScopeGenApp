const serverless = require('serverless-http');
const app = require('./server');

// Wrap the Express app for AWS Lambda and manually ensure CORS headers are
// always present on the response. Some Lambda deployments (e.g. function URLs)
// ignore multi-value headers set by the `cors` middleware, so we merge the
// header values after the request has been handled.
const handler = serverless(app);

module.exports.handler = async (event, context) => {
  const response = await handler(event, context);

  const origin = process.env.CORS_ORIGIN || '*';
  response.headers = {
    ...response.headers,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  return response;
};
