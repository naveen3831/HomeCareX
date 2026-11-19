import 'package:flutter/material.dart';
import '../core/models/booking_model.dart';
import '../core/services/api_service.dart';
import '../core/constants/api_constants.dart';

class BookingProvider extends ChangeNotifier {
  List<BookingModel> _bookings = [];
  bool _isLoading = false;

  List<BookingModel> get bookings => _bookings;
  bool get isLoading => _isLoading;

  List<BookingModel> get activeBookings => _bookings.where((b) =>
      b.status != 'completed' && b.status != 'cancelled' && b.status != 'refunded').toList();

  List<BookingModel> get pastBookings => _bookings.where((b) =>
      b.status == 'completed' || b.status == 'cancelled' || b.status == 'refunded').toList();

  Future<void> fetchBookings() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.bookings);
      if (res is List) {
        _bookings = res
            .map((b) => BookingModel.fromJson(Map<String, dynamic>.from(b)))
            .toList();
      }
    } catch (e) {
      debugPrint('[BookingProvider] Error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createBooking({
    required List<Map<String, dynamic>> items,
    required String address,
    required DateTime scheduledDate,
    required double totalAmount,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      await ApiService.post(ApiConstants.bookings, {
        'items': items,
        'address': address,
        'scheduledAt': scheduledDate.toIso8601String(),
        'totalAmount': totalAmount,
      });

      await fetchBookings();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
}

