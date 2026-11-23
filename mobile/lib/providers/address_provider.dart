import 'package:flutter/material.dart';
import '../core/models/address_model.dart';
import '../core/services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/services/storage_service.dart';

class AddressProvider extends ChangeNotifier {
  List<CustomerAddress> _addresses = _defaultSeedAddresses();
  String? _selectedAddressId = 'seed-addr-1';
  bool _isLoading = false;
  bool syncRemote = true;
  bool _isInitialized = false;

  AddressProvider() {
    _initializeAddresses();
  }

  static List<CustomerAddress> _defaultSeedAddresses() {
    return [
      CustomerAddress(
        id: 'seed-addr-1',
        label: 'Home',
        house: '000000',
        street: 'Image Garden Road',
        area: 'Ayyappa Society Colony',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        isDefault: true,
      ),
    ];
  }

  List<CustomerAddress> get addresses => List.unmodifiable(_addresses);
  bool get isLoading => _isLoading;
  String? get selectedAddressId => _selectedAddressId;

  CustomerAddress? get selectedAddress {
    if (_addresses.isEmpty) return null;
    if (_selectedAddressId != null) {
      final match = _addresses.where((a) => a.id == _selectedAddressId);
      if (match.isNotEmpty) return match.first;
    }
    final defaultMatch = _addresses.where((a) => a.isDefault);
    if (defaultMatch.isNotEmpty) return defaultMatch.first;
    return _addresses.first;
  }

  Future<void> _initializeAddresses() async {
    if (!syncRemote) return;
    if (_isInitialized) return;
    _isInitialized = true;

    try {
      final cached = await StorageService.getAddresses();
      final savedId = await StorageService.getSelectedAddressId();
      if (cached.isNotEmpty) {
        _addresses = cached.map((a) => CustomerAddress.fromJson(a)).toList();
      }
      if (savedId != null) {
        _selectedAddressId = savedId;
      }
      notifyListeners();
    } catch (e) {
      debugPrint('[AddressProvider] init error: $e');
    }
  }

  Future<void> _persistAddresses() async {
    try {
      await StorageService.saveAddresses(_addresses.map((a) => a.toJson()).toList());
      if (_selectedAddressId != null) {
        await StorageService.saveSelectedAddressId(_selectedAddressId!);
      }
    } catch (e) {
      debugPrint('[AddressProvider] persist error: $e');
    }
  }

  Future<void> fetchAddresses() async {
    if (!syncRemote) return;
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.addresses);
      if (res != null && res is Map && res['addresses'] is List) {
        final list = (res['addresses'] as List)
            .map((item) => CustomerAddress.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        if (list.isNotEmpty) {
          _addresses = list;
          final defaultAddr = list.where((a) => a.isDefault);
          if (defaultAddr.isNotEmpty) {
            _selectedAddressId = defaultAddr.first.id;
          }
          await _persistAddresses();
        }
      }
    } catch (e) {
      debugPrint('[AddressProvider] fetchAddresses error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> selectAddress(String id) async {
    _selectedAddressId = id;
    for (int i = 0; i < _addresses.length; i++) {
      final isCurrent = _addresses[i].id == id;
      if (_addresses[i].isDefault != isCurrent) {
        _addresses[i] = _addresses[i].copyWith(isDefault: isCurrent);
      }
    }
    notifyListeners();
    await _persistAddresses();

    if (syncRemote) {
      try {
        await ApiService.patch('${ApiConstants.addresses}/$id', {'isDefault': true});
      } catch (e) {
        debugPrint('[AddressProvider] selectAddress remote error: $e');
      }
    }
  }

  Future<void> addAddress(CustomerAddress address) async {
    _addresses = [..._addresses, address];
    if (address.isDefault || _addresses.length == 1) {
      _selectedAddressId = address.id;
    }
    notifyListeners();
    await _persistAddresses();
  }
}

