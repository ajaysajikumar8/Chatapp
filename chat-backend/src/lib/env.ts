import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const loadEnv = () => {
  let currentDir = process.cwd();
  let envLoaded = false;
  
  for (let i = 0; i < 4; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      envLoaded = true;
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  if (!envLoaded) {
    dotenv.config();
  }
};

loadEnv();
