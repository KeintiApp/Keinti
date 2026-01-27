const path = require('path');
const dotenv = require('dotenv');

// Always load the backend .env from the Backend/ folder, regardless of process CWD.
// This avoids accidentally connecting to the fallback DB when starting the server
// from a different working directory.
dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});
