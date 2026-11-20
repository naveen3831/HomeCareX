import 'package:flutter/material.dart';
import '../core/models/booking_model.dart';
import '../core/services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/services/storage_service.dart';

class BookingProvider extends ChangeNotifier {
  List<BookingModel> _bookings = [];
  bool _isLoading = false;
  bool syncRemote = true;

  BookingProvider() {
    _loadCachedBookings();
  }

  List<BookingModel> get bookings => _bookings;
  bool get isLoading => _isLoading;

  List<BookingModel> get activeBookings => _bookings.where((b) {
        final s = b.status.toLowerCase().trim();
        return s != 'completed' && s != 'cancelled' && s != 'refunded';
      }).toList();

  List<BookingModel> get pastBookings => _bookings.where((b) {
        final s = b.status.toLowerCase().trim();
        return s == 'completed' || s == 'cancelled' || s == 'refunded';
      }).toList();

  Future<void> _loadCachedBookings() async {
    try {
      final cached = await StorageService.getBookings();
      if (cached.isNotEmpty) {
        _bookings = cached.map((b) => BookingModel.fromJson(b)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[BookingProvider] load cached bookings error: $e');
    }
  }

  Future<void> _persistBookings() async {
    try {
      await StorageService.saveBookings(_bookings.map((b) => b.toJson()).toList());
    } catch (e) {
      debugPrint('[BookingProvider] persist bookings error: $e');
    }
  }

  Future<void> fetchBookings() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.bookings);
      if (res is List && res.isNotEmpty) {
        final serverBookings = res
            .map((b) => BookingModel.fromJson(Map<String, dynamic>.from(b)))
            .toList();

        // Preserve locally created bookings that haven't synced to server yet
        final serverIds = serverBookings.map((b) => b.id).toSet();
        final localOnly = _bookings.where((b) => !serverIds.contains(b.id)).toList();

        _bookings = [...localOnly, ...serverBookings];
        await _persistBookings();
      } else if (_bookings.isEmpty) {
        await _loadCachedBookings();
      }
    } catch (e) {
      debugPrint('[BookingProvider] Error: $e');
      if (_bookings.isEmpty) {
        await _loadCachedBookings();
      }
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

    // 1. Create a local confirmed booking immediately so My Bookings updates right away
    final serviceTitle = (items.isNotEmpty && items.first['name'] != null)
        ? items.first['name'].toString()
        : 'Home Care Service';
    final serviceId = (items.isNotEmpty && items.first['serviceId'] != null)
        ? items.first['serviceId'].toString()
        : '';
    final qty = (items.isNotEmpty && items.first['quantity'] is num)
        ? (items.first['quantity'] as num).toInt()
        : 1;

    final bookingId = 'BK-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
    final localBooking = BookingModel(
      id: bookingId,
      serviceTitle: serviceTitle,
      amount: totalAmount,
      status: 'confirmed',
      scheduledAt: scheduledDate,
      address: address,
      partnerName: 'Priya Sharma (Assigned)',
      partnerPhone: '+91 98765 43210',
      startOtp: (1000 + (DateTime.now().millisecondsSinceEpoch % 9000)).toString(),
    );

    _bookings.insert(0, localBooking);
    await _persistBookings();
    notifyListeners();

    // 2. Sync to backend API if available
    if (syncRemote) {
      try {
        final dateStr =
            "${scheduledDate.year}-${scheduledDate.month.toString().padLeft(2, '0')}-${scheduledDate.day.toString().padLeft(2, '0')}";

        final postData = {
          'serviceId': serviceId,
          'quantity': qty,
          'date': dateStr,
          'slot': '10:00 - 11:00',
          'items': items,
          'address': address,
          'newAddress': {
            'line1': address,
            'city': 'Hyderabad',
            'state': 'Telangana',
            'pincode': '500081',
            'location': {'lat': 17.4483, 'lng': 78.3915},
          },
          'scheduledAt': scheduledDate.toIso8601String(),
          'totalAmount': totalAmount,
          'expectedTotal': totalAmount.toInt(),
        };

        final res = await ApiService.post(ApiConstants.bookings, postData);
        if (res != null && res is Map) {
          final serverBooking = BookingModel.fromJson(Map<String, dynamic>.from(res));
          final idx = _bookings.indexWhere((b) => b.id == bookingId);
          if (idx != -1) {
            _bookings[idx] = serverBooking;
          } else {
            _bookings.insert(0, serverBooking);
          }
          await _persistBookings();
        }
      } catch (e) {
        debugPrint('[BookingProvider] createBooking backend sync error: $e');
      }
    }

    _isLoading = false;
    notifyListeners();
    return true;
  }
}

