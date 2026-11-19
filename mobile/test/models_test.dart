import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/core/models/category_model.dart';
import 'package:homecarex_mobile/core/models/service_model.dart';
import 'package:homecarex_mobile/core/models/user_model.dart';
import 'package:homecarex_mobile/core/models/booking_model.dart';
import 'package:homecarex_mobile/core/constants/api_constants.dart';

void main() {
  group('HomeCareX Core Models & Constants Tests', () {
    test('CategoryModel deserializes JSON correctly with Cloudinary URL', () {
      final json = {
        'id': 'cat-123',
        'name': 'Deep Cleaning',
        'slug': 'deep-cleaning',
        'icon': '🧹',
        'iconUrl': 'https://res.cloudinary.com/ddgjubbbx/image/upload/v1/cleaning.png',
        'servicesCount': 12,
      };

      final cat = CategoryModel.fromJson(json);
      expect(cat.id, 'cat-123');
      expect(cat.name, 'Deep Cleaning');
      expect(cat.slug, 'deep-cleaning');
      expect(cat.icon, '🧹');
      expect(cat.iconUrl, contains('cloudinary.com'));
      expect(cat.servicesCount, 12);
    });

    test('ServiceModel deserializes JSON with pricing and duration', () {
      final json = {
        'id': 'srv-456',
        'name': 'AC Jet Pump Service',
        'categoryId': 'cat-ac',
        'price': 499.0,
        'durationMinutes': 60,
        'rating': 4.8,
        'reviewCount': 140,
        'features': ['Filter Wash', 'Gas Check', 'Jet Spray'],
      };

      final srv = ServiceModel.fromJson(json);
      expect(srv.id, 'srv-456');
      expect(srv.name, 'AC Jet Pump Service');
      expect(srv.price, 499.0);
      expect(srv.durationMinutes, 60);
      expect(srv.rating, 4.8);
      expect(srv.reviewsCount, 140);
      expect(srv.inclusions.length, 3);
    });

    test('UserModel deserializes referralCode and avatar', () {
      final json = {
        '_id': 'usr-789',
        'name': 'Naveen Kumar',
        'email': 'naveenkumar970100@gmail.com',
        'phone': '+91 9876543210',
        'role': 'customer',
        'referralCode': 'NAVEEN100',
      };

      final user = UserModel.fromJson(json);
      expect(user.id, 'usr-789');
      expect(user.name, 'Naveen Kumar');
      expect(user.email, 'naveenkumar970100@gmail.com');
      expect(user.referralCode, 'NAVEEN100');
    });

    test('BookingModel computes amount and status correctly', () {
      final json = {
        '_id': 'bk-001',
        'status': 'confirmed',
        'items': [
          {'name': 'Kitchen Deep Cleaning', 'price': 899, 'quantity': 1},
        ],
        'totalAmount': 1897.0,
        'startOtp': '4821',
        'partnerName': 'Ramesh Professional',
      };

      final booking = BookingModel.fromJson(json);
      expect(booking.id, 'bk-001');
      expect(booking.status, 'confirmed');
      expect(booking.serviceTitle, 'Kitchen Deep Cleaning');
      expect(booking.amount, 1897.0);
      expect(booking.startOtp, '4821');
    });

    test('ApiConstants provides valid endpoint URIs', () {
      expect(ApiConstants.lanHost, '192.168.1.6');
      expect(ApiConstants.port, 5000);
      expect(ApiConstants.login, '/auth/login');
      expect(ApiConstants.register, '/auth/register');
      expect(ApiConstants.forgotPassword, '/auth/forgot-password');
      expect(ApiConstants.categories, '/categories');
    });
  });
}
