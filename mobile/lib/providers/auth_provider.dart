import 'package:flutter/material.dart';
import '../core/models/user_model.dart';
import '../core/services/api_service.dart';
import '../core/services/storage_service.dart';
import '../core/constants/api_constants.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> checkAuth() async {
    try {
      final token = await StorageService.getToken();
      if (token == null) return;

      final res = await ApiService.get(ApiConstants.profile);
      if (res is Map) {
        _user = UserModel.fromJson(Map<String, dynamic>.from(res));
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[AuthProvider] checkAuth error: $e');
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.post(ApiConstants.login, {
        'email': email.trim().toLowerCase(),
        'password': password,
      });

      if (res is Map && res['token'] != null) {
        await StorageService.saveToken(res['token'].toString());
        if (res['user'] != null) {
          _user = UserModel.fromJson(Map<String, dynamic>.from(res['user']));
        } else {
          await checkAuth();
        }
        _isLoading = false;
        notifyListeners();
        return true;
      }
      throw Exception('Invalid login response');
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    String? referralCode,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final body = {
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'phone': phone.trim(),
        'password': password,
        'role': 'customer',
      };
      if (referralCode != null && referralCode.trim().isNotEmpty) {
        body['referralCode'] = referralCode.trim().toUpperCase();
      }

      final res = await ApiService.post(ApiConstants.register, body);
      if (res is Map && res['token'] != null) {
        await StorageService.saveToken(res['token'].toString());
        if (res['user'] != null) {
          _user = UserModel.fromJson(Map<String, dynamic>.from(res['user']));
        }
        _isLoading = false;
        notifyListeners();
        return true;
      }
      return await login(email, password);
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> forgotPassword(String email) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.post(ApiConstants.forgotPassword, {
        'email': email.trim().toLowerCase(),
      });
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.post(ApiConstants.resetPassword, {
        'email': email.trim().toLowerCase(),
        'otp': otp.trim(),
        'newPassword': newPassword,
      });
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateProfile({
    String? name,
    String? email,
    String? phone,
    String? avatarUrl,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final patch = <String, dynamic>{};
      if (name != null) patch['name'] = name.trim();
      if (email != null) patch['email'] = email.trim().toLowerCase();
      if (phone != null) patch['phone'] = phone.trim().isEmpty ? null : phone.trim();

      if (patch.isNotEmpty) {
        final res = await ApiService.patch(ApiConstants.profile, patch);
        if (res is Map && res['profile'] != null) {
          _user = UserModel.fromJson(Map<String, dynamic>.from(res['profile']));
        } else if (_user != null) {
          _user = UserModel(
            id: _user!.id,
            name: name ?? _user!.name,
            email: email ?? _user!.email,
            phone: phone ?? _user!.phone,
            role: _user!.role,
            avatarUrl: avatarUrl ?? _user!.avatarUrl,
            referralCode: _user!.referralCode,
          );
        }
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await StorageService.clearAuth();
    _user = null;
    notifyListeners();
  }
}

