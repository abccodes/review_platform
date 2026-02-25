import app from './app';
import dotenv from 'dotenv';
dotenv.config();

const port = Number(process.env.PORT) || 8000;

if (!process.env.PORT) {
  console.warn('Warning: PORT not set in .env file, using default port 8000');
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please use a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
