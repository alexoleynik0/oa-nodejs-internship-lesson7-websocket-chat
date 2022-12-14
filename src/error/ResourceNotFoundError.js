const ResponseError = require('./ResponseError');

const DEFAULT_MESSAGE = 'Resource you\'re trying to reach not found.';

/**
 * @exports
 * @extends ResponseError
 */
class ResourceNotFoundError extends ResponseError {
  statusCode = 404;

  /**
   * @constructor
   * @param {any} message
   */
  constructor(message = DEFAULT_MESSAGE) {
    super();
    this.message = message;
    this.name = 'E_RESOURCE_NOT_FOUND';
  }
}

module.exports = ResourceNotFoundError;
