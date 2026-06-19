const logger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`;
    
    if (statusCode >= 500) {
      console.error(`\x1b[31m${logMsg}\x1b[0m`); // Red
    } else if (statusCode >= 400) {
      console.warn(`\x1b[33m${logMsg}\x1b[0m`);  // Yellow
    } else {
      console.log(`\x1b[32m${logMsg}\x1b[0m`);   // Green
    }
  });

  next();
};

export default logger;
