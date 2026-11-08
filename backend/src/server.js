const { port } = require('./config');
const { connectDb } = require('./db');
const app = require('./app');

async function main() {
  await connectDb();
  app.listen(port, () => console.log(`Server listening on port ${port}`));
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
