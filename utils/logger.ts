import winston from "winston";
import path from "node:path";
import fs from "node:fs";


// Create logs directory path
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
// Custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
 
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = ` | ${JSON.stringify(meta)}`;
    }
    const stackStr = stack ? `\n${JSON.stringify(stack)}` : "";
    return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: customFormat,
  defaultMeta: { service: "ai-chatbot" },
  transports: [
    // Console transport - always enabled
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),

    // File transport - all logs
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: customFormat,
    }),

    // File transport - error logs only
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: customFormat,
    }),

    // File transport - warning logs
    new winston.transports.File({
      filename: path.join(logsDir, "warn.log"),
      level: "warn",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: customFormat,
    }),
  ],
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, "exceptions.log"),
    format: customFormat,
  })
);

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

export default logger;
