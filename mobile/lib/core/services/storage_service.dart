import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const String _keyToken = 'auth_token';
  static const String _keyUser = 'auth_user';
  static const String _keyOnboarding = 'onboarding_completed';

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
}
