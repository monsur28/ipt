import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../core/constants/env.dart';
import 'api_exception.dart';

/// Centralized HTTP client wrapping Dio.
///
/// Provides:
/// - Pre-configured base URL, timeouts, and headers
/// - Debug-only request/response logging
/// - Global error interceptor mapping DioException → [ApiException]
class ApiService {
  late final Dio _dio;

  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: Duration(seconds: Env.connectTimeoutSeconds),
        receiveTimeout: Duration(seconds: Env.receiveTimeoutSeconds),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Debug-only request logging
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
          logPrint: (obj) => debugPrint('[API] $obj'),
        ),
      );
    }

    // Global error interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (DioException error, ErrorInterceptorHandler handler) {
          final apiException = _mapDioError(error);
          handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              error: apiException,
              type: error.type,
              response: error.response,
            ),
          );
        },
      ),
    );
  }

  /// Raw Dio instance for advanced usage (e.g., custom base URL for streams).
  Dio get dio => _dio;

  /// GET request returning parsed JSON response data.
  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return response.data;
    } on DioException catch (e) {
      throw e.error is ApiException ? e.error! : _mapDioError(e);
    }
  }

  /// POST request.
  Future<dynamic> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      return response.data;
    } on DioException catch (e) {
      throw e.error is ApiException ? e.error! : _mapDioError(e);
    }
  }

  /// Maps raw [DioException] to a typed [ApiException].
  static ApiException _mapDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiTimeoutException(originalError: error);

      case DioExceptionType.connectionError:
        return NetworkException(originalError: error);

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        if (statusCode == 404) {
          return NotFoundException(originalError: error);
        }
        if (statusCode != null && statusCode >= 500) {
          return ServerException(
            statusCode: statusCode,
            message: 'Server error ($statusCode). Please try again later.',
            originalError: error,
          );
        }
        return ApiException(
          message: error.response?.data?['error']?.toString() ??
              'Request failed with status $statusCode',
          statusCode: statusCode,
          originalError: error,
        );

      case DioExceptionType.cancel:
        return const ApiException(message: 'Request was cancelled.');

      default:
        return UnknownApiException(originalError: error);
    }
  }

  /// Ping the backend health endpoint. Returns true if reachable.
  Future<bool> checkHealth() async {
    try {
      // Health endpoint is at root, not under /api prefix
      final healthDio = Dio(
        BaseOptions(
          baseUrl: Env.apiBaseUrl.replaceAll('/api', ''),
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
      final response = await healthDio.get('/health');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
