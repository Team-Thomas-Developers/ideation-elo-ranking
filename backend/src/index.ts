import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow the configured frontend plus the common localhost/127.0.0.1 dev hosts.
// Vite commonly uses 5173/5174, and the browser treats localhost/127.0.0.1 as different origins.
const configuredFrontend = process.env.FRONTEND_URL?.trim();
const allowedOrigins = [
  configuredFrontend,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter(Boolean) as string[];
app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser clients (curl, same-origin) with no Origin header
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  })
);
app.use(express.json());

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
