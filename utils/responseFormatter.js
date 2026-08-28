const successResponse = (data, message = 'Succès') => {
  return {
    success: true,
    message,
    data
  };
};

const errorResponse = (message, code = 500, errors = null) => {
  return {
    success: false,
    message,
    code,
    errors
  };
};

module.exports = {
  successResponse,
  errorResponse
};