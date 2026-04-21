import app from './app.js';
import { startCronJobs } from './lib/cron.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  startCronJobs();
});
