/// Custom API exceptions for user-friendly error handling.
///
/// Maps raw Dio errors into structured exception types that the UI
/// can pattern-match on to display appropriate messages.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic originalError;

  const ApiException({
    required this.message,
    this.statusCode,
    this.originalError,
  });

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// No internet or DNS resolution failure.
class NetworkException extends ApiException {
  const NetworkException({
    super.message = 'No internet connection. Please check your network.',
    super.originalError,
  });
}

/// Backend returned 5xx.
class ServerException extends ApiException {
  const ServerException({
    super.message = 'Server error. Please try again later.',
    super.statusCode,
    super.originalError,
  });
}

/// Backend returned 404.
class NotFoundException extends ApiException {
  const NotFoundException({
    super.message = 'Resource not found.',
    super.statusCode = 404,
    super.originalError,
  });
}

/// Connection or receive timeout exceeded.
class ApiTimeoutException extends ApiException {
  const ApiTimeoutException({
    super.message = 'Request timed out. Please try again.',
    super.originalError,
  });
}

/// Catch-all for unexpected errors.
class UnknownApiException extends ApiException {
  const UnknownApiException({
    super.message = 'An unexpected error occurred.',
    super.originalError,
  });
}
