import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';
import 'storage_service.dart';

class ApiService {
  static Future<Map<String, String>> _headers() async {
    final token = await StorageService.getToken();
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static const Duration _timeout = Duration(milliseconds: 1500);

  static Future<dynamic> get(String endpoint) async {
    final headers = await _headers();
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}$endpoint');
      final response = await http.get(uri, headers: headers).timeout(_timeout);
      return _handleResponse(response);
    } catch (_) {
      try {
        final fallbackUri = Uri.parse('${ApiConstants.fallbackBaseUrl}$endpoint');
        final response = await http.get(fallbackUri, headers: headers).timeout(_timeout);
        return _handleResponse(response);
      } catch (fallbackError) {
        debugPrint('[ApiService] GET $endpoint offline/fallback failed: $fallbackError');
        return null;
      }
    }
  }

  static Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _headers();
    final encoded = jsonEncode(body);
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}$endpoint');
      final response = await http.post(uri, headers: headers, body: encoded).timeout(_timeout);
      return _handleResponse(response);
    } catch (_) {
      try {
        final fallbackUri = Uri.parse('${ApiConstants.fallbackBaseUrl}$endpoint');
        final response = await http.post(fallbackUri, headers: headers, body: encoded).timeout(_timeout);
        return _handleResponse(response);
      } catch (fallbackError) {
        debugPrint('[ApiService] POST $endpoint offline/fallback failed: $fallbackError');
        return null;
      }
    }
  }

  static Future<dynamic> patch(String endpoint, Map<String, dynamic> body) async {
    final headers = await _headers();
    final encoded = jsonEncode(body);
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}$endpoint');
      final response = await http.patch(uri, headers: headers, body: encoded).timeout(_timeout);
      return _handleResponse(response);
    } catch (_) {
      try {
        final fallbackUri = Uri.parse('${ApiConstants.fallbackBaseUrl}$endpoint');
        final response = await http.patch(fallbackUri, headers: headers, body: encoded).timeout(_timeout);
        return _handleResponse(response);
      } catch (fallbackError) {
        debugPrint('[ApiService] PATCH $endpoint offline/fallback failed: $fallbackError');
        return null;
      }
    }
  }

  static dynamic _handleResponse(http.Response response) {
    try {
      final body = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (body is Map && body.containsKey('data')) {
          return body['data'];
        }
        return body;
      } else {
        final msg = body is Map && body['message'] != null ? body['message'] : 'Request error';
        debugPrint('[ApiService] Response status ${response.statusCode}: $msg');
        return null;
      }
    } catch (e) {
      debugPrint('[ApiService] jsonDecode error: $e');
      return null;
    }
  }
}
