import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';

class StorageService {
  static const String _keyToken = 'auth_token';
  static const String _keyUser = 'auth_user';
  static const String _keyOnboarding = 'onboarding_completed';
  static const String _keyBookings = 'cached_bookings';

  static final Map<String, dynamic> _memoryCache = {};

  static Future<SharedPreferences?> _getPrefs() async {
    try {
      return await SharedPreferences.getInstance();
    } catch (e) {
      debugPrint('[StorageService] SharedPreferences error: $e');
      return null;
    }
  }

  static Future<void> saveToken(String token) async {
    _memoryCache[_keyToken] = token;
    final prefs = await _getPrefs();
    await prefs?.setString(_keyToken, token);
  }

  static Future<String?> getToken() async {
    if (_memoryCache.containsKey(_keyToken)) {
      return _memoryCache[_keyToken] as String?;
    }
    final prefs = await _getPrefs();
    final val = prefs?.getString(_keyToken);
    if (val != null) _memoryCache[_keyToken] = val;
    return val;
  }

  static Future<void> saveUser(UserModel user) async {
    _memoryCache[_keyUser] = user.toJson();
    final prefs = await _getPrefs();
    await prefs?.setString(_keyUser, jsonEncode(user.toJson()));
  }

  static Future<UserModel?> getUser() async {
    if (_memoryCache.containsKey(_keyUser)) {
      final cached = _memoryCache[_keyUser];
      if (cached is Map<String, dynamic>) {
        return UserModel.fromJson(cached);
      }
    }
    final prefs = await _getPrefs();
    final val = prefs?.getString(_keyUser);
    if (val != null) {
      try {
        final map = jsonDecode(val) as Map<String, dynamic>;
        _memoryCache[_keyUser] = map;
        return UserModel.fromJson(map);
      } catch (e) {
        debugPrint('[StorageService] parse user error: $e');
      }
    }
    return null;
  }

  static Future<void> clearAuth() async {
    _memoryCache.remove(_keyToken);
    _memoryCache.remove(_keyUser);
    final prefs = await _getPrefs();
    await prefs?.remove(_keyToken);
    await prefs?.remove(_keyUser);
  }

  static Future<bool> isOnboardingCompleted() async {
    if (_memoryCache.containsKey(_keyOnboarding)) {
      return (_memoryCache[_keyOnboarding] as bool?) ?? true;
    }
    final prefs = await _getPrefs();
    final val = prefs?.getBool(_keyOnboarding) ?? true;
    _memoryCache[_keyOnboarding] = val;
    return val;
  }

  static Future<void> setOnboardingCompleted([bool completed = true]) async {
    _memoryCache[_keyOnboarding] = completed;
    final prefs = await _getPrefs();
    await prefs?.setBool(_keyOnboarding, completed);
  }

  static Future<void> saveBookings(List<Map<String, dynamic>> bookings) async {
    _memoryCache[_keyBookings] = bookings;
    final prefs = await _getPrefs();
    await prefs?.setString(_keyBookings, jsonEncode(bookings));
  }

  static Future<List<Map<String, dynamic>>> getBookings() async {
    if (_memoryCache.containsKey(_keyBookings)) {
      final cached = _memoryCache[_keyBookings];
      if (cached is List) {
        return cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    final prefs = await _getPrefs();
    final val = prefs?.getString(_keyBookings);
    if (val != null) {
      try {
        final list = jsonDecode(val) as List;
        final res = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _memoryCache[_keyBookings] = res;
        return res;
      } catch (e) {
        debugPrint('[StorageService] parse bookings error: $e');
      }
    }
    return [];
  }
}
