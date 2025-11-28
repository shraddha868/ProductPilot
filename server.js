// server.js
import express from 'express';
import cors from 'cors';
import { generate } from './chatbot.js';

const app = express();
const port = 3002;

// Middlewares (ensure these run BEFORE your routes)
app.use(cors());
app.use(express.json()); // parse application/json
app.use(express.urlencoded({ extended: true })); // parse form data if ever sent

// Simple logger to help debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} → ${req.method} ${req.url}`);
  // Uncomment to log headers for debugging:
  // console.log('Headers:', req.headers);
  next();
});

app.get('/', (req, res) => {
  res.send('Welcome to ChatDPT!');
});

app.post('/chat', async (req, res) => {
  // defensive: if req.body is missing, return a clear error
  if (!req.body) {
    return res.status(400).json({ message: 'Request body is missing. Make sure you send JSON and include the Content-Type: application/json header.' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message field is required in request body.' });
  }

  console.log('User message:', message);

  try {
    const result = await generate(message); // your chatbot.generate should accept single message
    return res.json({ message: result });
  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ message: 'Internal server error. Try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
