const mongoose = require('mongoose');
const logger = require('../helpers/logger');

const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 2000,
};

const mongooseConnection = mongoose.createConnection(
  process.env.MONGODB_URI,
  connectOptions,
  (error) => {
    if (error) {
      logger.emerg(error);
      process.exit(1);
    }
  },
);

mongooseConnection.on('error', (error) => {
  logger.emerg(error);
});

module.exports = mongooseConnection;
