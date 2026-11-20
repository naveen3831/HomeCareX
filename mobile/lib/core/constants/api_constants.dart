class ApiConstants {
  // Machine Wi-Fi LAN IP for physical device connection
  static const String lanHost = '192.168.1.6';
  static const int port = 5000;

  static String? _customBaseUrl;

  static void setCustomBaseUrl(String url) {
    _customBaseUrl = url;
  }

  // 127.0.0.1 is the primary host for web, simulator, and physical devices over USB (adb reverse)
  static String get baseUrl {
    if (_customBaseUrl != null && _customBaseUrl!.isNotEmpty) {
      return _customBaseUrl!;
    }
    return 'http://127.0.0.1:$port/api/v1';
  }

  static String get fallbackBaseUrl => 'http://$lanHost:$port/api/v1';

  // Endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String profile = '/customer/profile';
  static const String categories = '/categories';
  static const String services = '/services';
  static const String bookings = '/bookings';
  static const String wallet = '/wallet';
  static const String referrals = '/referrals';
  static const String tickets = '/support/tickets';
  static const String banners = '/banners';
  static const String uploadImage = '/uploads/image';
  static const String reviews = '/reviews';
  static const String reviewsPending = '/reviews/pending';
  static const String payments = '/payments';
  static const String changePassword = '/auth/change-password';
  static const String customerPreferences = '/customer/preferences';
  static const String customerNotifications = '/customer/notifications';
  static const String sessions = '/auth/sessions';
  static const String logoutAll = '/auth/logout-all';
}
