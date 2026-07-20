// The only way responses are sent anywhere in this app. Every controller
// must use this instead of calling res.json() directly, so the response
// shape stays exactly { success, message, data, errors } everywhere.
function sendResponse(res, statusCode, success, message, data = null, errors = null) {
  return res.status(statusCode).json({ success, message, data, errors });
}

module.exports = sendResponse;
