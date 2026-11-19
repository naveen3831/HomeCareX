import 'package:flutter/material.dart';
import '../core/models/service_model.dart';

class CartItem {
  final ServiceModel service;
  int quantity;

  CartItem({required this.service, this.quantity = 1});

  double get subtotal => service.price * quantity;
}

class CartProvider extends ChangeNotifier {
  final Map<String, CartItem> _items = {};
  String? _couponCode;
  double _discountAmount = 0.0;

  Map<String, CartItem> get items => _items;
  List<CartItem> get itemList => _items.values.toList();
  int get itemCount => _items.values.fold(0, (sum, i) => sum + i.quantity);
  String? get couponCode => _couponCode;
  double get discountAmount => _discountAmount;

  double get itemTotal => _items.values.fold(0.0, (sum, i) => sum + i.subtotal);
  double get taxes => itemTotal * 0.18; // 18% GST standard for home services
  double get grandTotal => (itemTotal + taxes - _discountAmount).clamp(0.0, double.infinity);

  bool hasItem(String serviceId) => _items.containsKey(serviceId);
  int getItemQuantity(String serviceId) => _items[serviceId]?.quantity ?? 0;

  void addItem(ServiceModel service) {
    if (_items.containsKey(service.id)) {
      _items[service.id]!.quantity += 1;
    } else {
      _items[service.id] = CartItem(service: service);
    }
    notifyListeners();
  }

  void removeOne(String serviceId) {
    if (!_items.containsKey(serviceId)) return;
    if (_items[serviceId]!.quantity > 1) {
      _items[serviceId]!.quantity -= 1;
    } else {
      _items.remove(serviceId);
    }
    notifyListeners();
  }

  void removeItem(String serviceId) {
    _items.remove(serviceId);
    notifyListeners();
  }

  void applyCoupon(String code, double discount) {
    _couponCode = code;
    _discountAmount = discount;
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _couponCode = null;
    _discountAmount = 0.0;
    notifyListeners();
  }
}

