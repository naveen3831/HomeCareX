import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';
import 'storage_service.dart';

class ApiService {
  static String? lastError;
  static String? _activeBaseUrl;

  static List<String> get _candidateUrls {
    if (_activeBaseUrl != null) {
      return [_activeBaseUrl!];
    }
    final primary = ApiConstants.baseUrl;
    final fallback = ApiConstants.fallbackBaseUrl;
    if (primary == fallback) {
      return [primary];
    }
    return [primary, fallback];
  }

  static void resetActiveBaseUrl() {
    _activeBaseUrl = null;
  }

  static Future<Map<String, String>> _headers([Map<String, String>? extra]) async {
    final token = await StorageService.getToken();
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (extra != null) {
      headers.addAll(extra);
    }
    return headers;
  }

  static const Duration _timeout = Duration(seconds: 10);

  static Future<dynamic> get(String endpoint) async {
    lastError = null;
    final headers = await _headers();
    final candidates = _candidateUrls;

    for (int i = 0; i < candidates.length; i++) {
      final base = candidates[i];
      try {
        final uri = Uri.parse('$base$endpoint');
        final response = await http.get(uri, headers: headers).timeout(_timeout);
        final res = _handleResponse(response);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _activeBaseUrl = base;
        }
        return res;
      } catch (e) {
        debugPrint('[ApiService] GET $base$endpoint failed: $e');
        if (i == candidates.length - 1) {
          lastError ??= 'Cannot connect to server. Please check your network connection.';
          return null;
        }
      }
    }
    return null;
  }

  static Future<dynamic> post(
    String endpoint,
    Map<String, dynamic> body, {
    Map<String, String>? headers,
  }) async {
    lastError = null;
    final reqHeaders = await _headers(headers);
    final encoded = jsonEncode(body);
    final candidates = _candidateUrls;

    for (int i = 0; i < candidates.length; i++) {
      final base = candidates[i];
      try {
        final uri = Uri.parse('$base$endpoint');
        final response = await http.post(uri, headers: reqHeaders, body: encoded).timeout(_timeout);
        final res = _handleResponse(response);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _activeBaseUrl = base;
        }
        return res;
      } catch (e) {
        debugPrint('[ApiService] POST $base$endpoint failed: $e');
        if (i == candidates.length - 1) {
          lastError ??= 'Cannot connect to server. Please check your network connection.';
          return null;
        }
      }
    }
    return null;
  }

  static Future<dynamic> patch(String endpoint, Map<String, dynamic> body) async {
    lastError = null;
    final headers = await _headers();
    final encoded = jsonEncode(body);
    final candidates = _candidateUrls;

    for (int i = 0; i < candidates.length; i++) {
      final base = candidates[i];
      try {
        final uri = Uri.parse('$base$endpoint');
        final response = await http.patch(uri, headers: headers, body: encoded).timeout(_timeout);
        final res = _handleResponse(response);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _activeBaseUrl = base;
        }
        return res;
      } catch (e) {
        debugPrint('[ApiService] PATCH $base$endpoint failed: $e');
        if (i == candidates.length - 1) {
          lastError ??= 'Cannot connect to server. Please check your network connection.';
          return null;
        }
      }
    }
    return null;
  }

  static Future<dynamic> delete(String endpoint) async {
    lastError = null;
    final headers = await _headers();
    final candidates = _candidateUrls;

    for (int i = 0; i < candidates.length; i++) {
      final base = candidates[i];
      try {
        final uri = Uri.parse('$base$endpoint');
        final response = await http.delete(uri, headers: headers).timeout(_timeout);
        final res = _handleResponse(response);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _activeBaseUrl = base;
        }
        return res;
      } catch (e) {
        debugPrint('[ApiService] DELETE $base$endpoint failed: $e');
        if (i == candidates.length - 1) {
          lastError ??= 'Cannot connect to server. Please check your network connection.';
          return null;
        }
      }
    }
    return null;
  }

  static dynamic _handleResponse(http.Response response) {
    try {
      final body = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        lastError = null;
        if (body is Map && body.containsKey('data')) {
          return body['data'];
        }
        return body;
      } else {
        final msg = body is Map && body['message'] != null ? body['message'] : 'Request error';
        lastError = msg.toString();
        debugPrint('[ApiService] Response status ${response.statusCode}: $msg');
        return null;
      }
    } catch (e) {
      debugPrint('[ApiService] jsonDecode error: $e');
      lastError = 'Server error. Please try again.';
      return null;
    }
  }
}
