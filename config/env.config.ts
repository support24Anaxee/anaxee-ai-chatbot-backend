import { configDotenv } from "dotenv";
configDotenv();

export const config = {
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "yogesh",
    password: process.env.DB_PASSWORD || "nvidiagt710",
    database: process.env.DB_NAME || "ai-chatbot",
  },
  
  port: process.env.PORT || 5000,
  
  jwtSecret: process.env.JWT_SECRET || "nvidiagt710",
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
};
