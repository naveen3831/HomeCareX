import 'package:flutter/material.dart';
import '../core/models/user_model.dart';
import '../core/services/api_service.dart';
import '../core/services/storage_service.dart';
import '../core/constants/api_constants.dart';

class AuthProvider extends ChangeNotifier {
  static final UserModel defaultCustomer = UserModel(
    id: 'customer_default',
    name: 'TATUKULA EDUKONDALU',
    email: 'tatukulaedukondalu@gmail.com',
    phone: '8346167714',
    role: 'customer',
    referralCode: 'HOMECAREX10',
  );

  UserModel? _user = StorageService.isLoggedOutSync() ? null : defaultCustomer;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void setUser(UserModel? user) {
    _user = user;
    notifyListeners();
  }

  AuthProvider() {
    _initUser();
  }

  Future<void> _initUser() async {
    try {
      final loggedOut = await StorageService.isLoggedOut();
      if (loggedOut) {
        _user = null;
        notifyListeners();
        return;
      }

      final cached = await StorageService.getUser();
      if (cached != null) {
        _user = cached;
      } else {
        _user = defaultCustomer;
      }
      notifyListeners();
    } catch (_) {}
    await checkAuth();
  }

  Future<void> checkAuth() async {
    try {
      final token = await StorageService.getToken();
      if (token == null) {
        if (_user == null) {
          notifyListeners();
        }
        return;
      }

      final res = await ApiService.get(ApiConstants.profile);
      if (res is Map) {
        final profileMap = res['profile'] != null
            ? Map<String, dynamic>.from(res['profile'])
            : Map<String, dynamic>.from(res);
        _user = UserModel.fromJson(profileMap);
        await StorageService.saveUser(_user!);
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
        await StorageService.setLoggedOut(false);
        await StorageService.saveToken(res['token'].toString());
        if (res['user'] != null) {
          _user = UserModel.fromJson(Map<String, dynamic>.from(res['user']));
          await StorageService.saveUser(_user!);
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
        await StorageService.setLoggedOut(false);
        await StorageService.saveToken(res['token'].toString());
        if (res['user'] != null) {
          _user = UserModel.fromJson(Map<String, dynamic>.from(res['user']));
          await StorageService.saveUser(_user!);
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
      if (name != null && name.trim().isNotEmpty) patch['name'] = name.trim();
      if (email != null && email.trim().isNotEmpty) patch['email'] = email.trim().toLowerCase();
      if (phone != null) patch['phone'] = phone.trim().isEmpty ? null : phone.trim();

      bool backendUpdated = false;
      if (patch.isNotEmpty) {
        try {
          final res = await ApiService.patch(ApiConstants.profile, patch);
          if (res is Map) {
            final profileMap = res['profile'] != null
                ? Map<String, dynamic>.from(res['profile'])
                : Map<String, dynamic>.from(res);
            _user = UserModel.fromJson(profileMap);
            backendUpdated = true;
          }
        } catch (apiErr) {
          debugPrint('[AuthProvider] updateProfile API error: $apiErr');
        }
      }

      if (!backendUpdated) {
        final current = _user ?? defaultCustomer;
        _user = UserModel(
          id: current.id,
          name: (name != null && name.trim().isNotEmpty) ? name.trim() : current.name,
          email: (email != null && email.trim().isNotEmpty) ? email.trim() : current.email,
          phone: phone != null ? phone.trim() : current.phone,
          role: current.role,
          avatarUrl: avatarUrl ?? current.avatarUrl,
          referralCode: current.referralCode,
        );
      }

      if (_user != null) {
        await StorageService.saveUser(_user!);
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

  Future<bool> deleteAccount() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      try {
        await ApiService.delete(ApiConstants.profile);
      } catch (e) {
        debugPrint('[AuthProvider] deleteAccount API error: $e');
      }
      await logout();
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
    await StorageService.setLoggedOut(true);
    _user = null;
    notifyListeners();
  }
}

