import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/cart_provider.dart';
import '../../providers/booking_provider.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../bookings/bookings_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final TextEditingController _couponCtrl = TextEditingController();
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _selectedTime = const TimeOfDay(hour: 10, minute: 0);
  bool _isBooking = false;

  @override
  void dispose() {
    _couponCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final auth = context.watch<AuthProvider>();

    if (cart.itemList.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.canvas,
        appBar: AppBar(
          title: const Text('My Cart', style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.bold, fontSize: 16)),
          backgroundColor: AppColors.panel,
          elevation: 0,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: const BoxDecoration(color: AppColors.brandSoft, shape: BoxShape.circle),
                child: const Icon(Icons.shopping_bag_outlined, size: 50, color: AppColors.brand),
              ),
              const SizedBox(height: 16),
              const Text('Your cart is empty', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.ink)),
              const SizedBox(height: 8),
              const Text('Browse services and add them to get started', style: TextStyle(color: AppColors.muted, fontSize: 13)),
              const SizedBox(height: 24),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Explore Services'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: const Text('Cart & Checkout', style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: AppColors.panel,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: () => cart.clearCart(),
            child: const Text('Clear', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Items list
            Container(
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: cart.itemList.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
                itemBuilder: (context, index) {
                  final item = cart.itemList[index];
                  return Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.service.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              const SizedBox(height: 4),
                              Text('₹${item.service.price.toInt()} each', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                            ],
                          ),
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, size: 20, color: AppColors.brand),
                              onPressed: () => cart.removeOne(item.service.id),
                            ),
                            Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.bold)),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline, size: 20, color: AppColors.brand),
                              onPressed: () => cart.addItem(item.service),
                            ),
                          ],
                        ),
                        Text('₹${item.subtotal.toInt()}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.ink)),
                      ],
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),

            // Schedule Slot Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Select Date & Time Slot', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.calendar_today, size: 16),
                          label: Text('${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}'),
                          onPressed: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: _selectedDate,
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 30)),
                            );
                            if (picked != null) setState(() => _selectedDate = picked);
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.access_time, size: 16),
                          label: Text(_selectedTime.format(context)),
                          onPressed: () async {
                            final picked = await showTimePicker(
                              context: context,
                              initialTime: _selectedTime,
                            );
                            if (picked != null) setState(() => _selectedTime = picked);
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Coupon Code Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_offer_outlined, color: AppColors.brand),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _couponCtrl,
                      decoration: const InputDecoration(
                        hintText: 'Enter coupon (e.g. WELCOME50)',
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      final code = _couponCtrl.text.trim().toUpperCase();
                      if (code == 'WELCOME50' || code == 'HCX50') {
                        cart.applyCoupon(code, 50);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Coupon applied! ₹50 saved')),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Invalid coupon code')),
                        );
                      }
                    },
                    child: const Text('Apply', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Bill Breakdown
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Payment Summary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 12),
                  _billRow('Item Total', '₹${cart.itemTotal.toInt()}'),
                  const SizedBox(height: 6),
                  _billRow('Taxes & GST (18%)', '₹${cart.taxes.toInt()}'),
                  if (cart.discountAmount > 0) ...[
                    const SizedBox(height: 6),
                    _billRow('Coupon Discount', '-₹${cart.discountAmount.toInt()}', isDiscount: true),
                  ],
                  const Divider(height: 20, color: AppColors.line),
                  _billRow('Grand Total', '₹${cart.grandTotal.toInt()}', isBold: true),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Checkout CTA
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _isBooking
                    ? null
                    : () async {
                        final bookingProvider = context.read<BookingProvider>();
                        if (!auth.isAuthenticated) {
                          final loggedIn = await Navigator.of(context).push<bool>(
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                          );
                          if (!mounted || loggedIn != true) return;
                        }

                        setState(() => _isBooking = true);

                        final bookingDate = DateTime(
                          _selectedDate.year,
                          _selectedDate.month,
                          _selectedDate.day,
                          _selectedTime.hour,
                          _selectedTime.minute,
                        );

                        final items = cart.itemList.map((i) => {
                          'serviceId': i.service.id,
                          'name': i.service.name,
                          'price': i.service.price,
                          'quantity': i.quantity,
                        }).toList();

                        final success = await bookingProvider.createBooking(
                          items: items,
                          address: 'Flat 402, Green Meadows, Madhapur, Hyderabad',
                          scheduledDate: bookingDate,
                          totalAmount: cart.grandTotal,
                        );

                        if (!mounted || !context.mounted) return;
                        setState(() => _isBooking = false);

                        if (success) {
                          cart.clearCart();
                          showDialog(
                            context: context,
                            barrierDismissible: false,
                            builder: (dialogCtx) => AlertDialog(
                              title: const Row(
                                children: [
                                  Icon(Icons.check_circle, color: AppColors.success),
                                  SizedBox(width: 8),
                                  Text('Booking Confirmed!'),
                                ],
                              ),
                              content: const Text('Your service partner will be assigned shortly. You can track status in your bookings.'),
                              actions: [
                                TextButton(
                                  onPressed: () {
                                    Navigator.of(dialogCtx).pop();
                                    Navigator.of(context).pushReplacement(
                                      MaterialPageRoute(builder: (_) => const BookingsScreen()),
                                    );
                                  },
                                  child: const Text('View Bookings', style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Failed to confirm booking. Please try again.')),
                          );
                        }
                      },
                child: _isBooking
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text('Pay & Confirm • ₹${cart.grandTotal.toInt()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _billRow(String label, String value, {bool isBold = false, bool isDiscount = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isBold ? 15 : 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w400,
            color: isDiscount ? AppColors.success : (isBold ? AppColors.ink : AppColors.muted),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isBold ? 16 : 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: isDiscount ? AppColors.success : (isBold ? AppColors.brand : AppColors.ink),
          ),
        ),
      ],
    );
  }
}

