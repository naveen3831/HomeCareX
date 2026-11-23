import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';

class RazorpayCheckoutResult {
  final bool success;
  final String? paymentId;
  final String? orderId;
  final String? signature;
  final String? error;
  final bool isCancelled;

  const RazorpayCheckoutResult({
    required this.success,
    this.paymentId,
    this.orderId,
    this.signature,
    this.error,
    this.isCancelled = false,
  });

  factory RazorpayCheckoutResult.success({
    required String paymentId,
    String? orderId,
    String? signature,
  }) {
    return RazorpayCheckoutResult(
      success: true,
      paymentId: paymentId,
      orderId: orderId,
      signature: signature,
    );
  }

  factory RazorpayCheckoutResult.failure({required String error}) {
    return RazorpayCheckoutResult(
      success: false,
      error: error,
    );
  }

  factory RazorpayCheckoutResult.cancelled() {
    return const RazorpayCheckoutResult(
      success: false,
      isCancelled: true,
      error: 'Payment cancelled by user',
    );
  }
}

class RazorpayTestCheckoutSheet extends StatefulWidget {
  final double amount;
  final String? serviceName;
  final String? bookingId;
  final String? orderId;
  final String? customerName;
  final String? customerEmail;
  final String? customerPhone;

  const RazorpayTestCheckoutSheet({
    super.key,
    required this.amount,
    this.serviceName,
    this.bookingId,
    this.orderId,
    this.customerName,
    this.customerEmail,
    this.customerPhone,
  });

  static Future<RazorpayCheckoutResult?> show({
    required BuildContext context,
    required double amount,
    String? serviceName,
    String? bookingId,
    String? orderId,
    String? customerName,
    String? customerEmail,
    String? customerPhone,
  }) {
    return showModalBottomSheet<RazorpayCheckoutResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: true,
      enableDrag: true,
      builder: (ctx) => RazorpayTestCheckoutSheet(
        amount: amount,
        serviceName: serviceName,
        bookingId: bookingId,
        orderId: orderId,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
      ),
    );
  }

  @override
  State<RazorpayTestCheckoutSheet> createState() => _RazorpayTestCheckoutSheetState();
}

class _RazorpayTestCheckoutSheetState extends State<RazorpayTestCheckoutSheet> {
  bool _isInMockBank = false;
  String _selectedPaymentMethod = 'upi'; // 'upi', 'card', 'netbanking', 'wallet'
  String? _submittingOutcome; // 'S', 'F'
  String _selectedUpiApp = 'Google Pay';
  String _selectedBank = 'HDFC Bank';

  Future<void> _handleBankOutcome(String outcome) async {
    if (_submittingOutcome != null) return;
    setState(() => _submittingOutcome = outcome);

    final orderId = widget.orderId ?? 'order_${DateTime.now().millisecondsSinceEpoch}';
    final paymentId = 'pay_test_${DateTime.now().millisecondsSinceEpoch}';

    // In background, try hitting test-simulate if bookingId is provided
    if (widget.bookingId != null && widget.bookingId!.isNotEmpty) {
      try {
        await ApiService.post(
          '${ApiConstants.payments}/test-simulate',
          {
            'bookingId': widget.bookingId,
            'outcome': outcome == 'S' ? 'success' : 'failure',
          },
        );
      } catch (_) {
        // Fallback for offline / demo mode
      }
    }

    // Give user visual feedback of the authorization step
    await Future.delayed(const Duration(milliseconds: 600));

    if (!mounted) return;

    if (outcome == 'S') {
      Navigator.of(context).pop(
        RazorpayCheckoutResult.success(
          paymentId: paymentId,
          orderId: orderId,
          signature: 'sig_test_${DateTime.now().millisecondsSinceEpoch}',
        ),
      );
    } else {
      Navigator.of(context).pop(
        RazorpayCheckoutResult.failure(
          error: 'Payment declined by customer in demo bank',
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(splashFactory: NoSplash.splashFactory),
      child: SafeArea(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.90,
        ),
        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.35),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Razorpay Header
            _buildRazorpayHeader(),

            // Content body: either Checkout Options or Demo Bank Page
            Flexible(
              child: SingleChildScrollView(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  child: _isInMockBank
                      ? _buildDemoBankView()
                      : _buildCheckoutOptionsView(),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Widget _buildRazorpayHeader() {
    return Container(
      color: const Color(0xFF0C2340), // Razorpay dark navy
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Razorpay Icon + Merchant Name
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0066FF),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: const Center(
                        child: Text(
                          'R',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'HomeCareX',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.2,
                            ),
                          ),
                          Text(
                            widget.serviceName != null
                                ? 'Payment for ${widget.serviceName}'
                                : 'Test Payment',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),

              // TEST MODE Badge + Close Button
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFF59E0B), width: 1),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.science_outlined, size: 11, color: Color(0xFFB45309)),
                        SizedBox(width: 3),
                        Text(
                          'TEST MODE',
                          style: TextStyle(
                            color: Color(0xFFB45309),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).pop(RazorpayCheckoutResult.cancelled());
                    },
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${widget.amount.toInt()}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              const Text(
                'rzp_test_gateway',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutOptionsView() {
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Preferred Payment Methods title
          const Text(
            'PREFERRED PAYMENT METHODS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Color(0xFF64748B),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 14),

          // 1. UPI Section
          _buildMethodHeader(
            id: 'upi',
            icon: Icons.qr_code_2_rounded,
            iconColor: const Color(0xFF0284C7),
            title: 'UPI / QR',
            subtitle: 'Google Pay, PhonePe, Paytm, QR Code',
          ),
          if (_selectedPaymentMethod == 'upi') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                _buildUpiAppTile('Google Pay', const Color(0xFF1A73E8), 'GPay'),
                const SizedBox(width: 8),
                _buildUpiAppTile('PhonePe', const Color(0xFF5F259F), 'PE'),
                const SizedBox(width: 8),
                _buildUpiAppTile('Paytm', const Color(0xFF00B9F1), 'PAY'),
              ],
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => setState(() => _isInMockBank = true),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.qr_code_scanner_rounded, size: 18, color: Color(0xFF0284C7)),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Show QR Code / Enter any UPI ID',
                        style: TextStyle(fontSize: 12, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF94A3B8)),
                  ],
                ),
              ),
            ),
          ],

          const Divider(height: 24, color: Color(0xFFF1F5F9)),

          // 2. Cards Section
          _buildMethodHeader(
            id: 'card',
            icon: Icons.credit_card_rounded,
            iconColor: const Color(0xFF0D9488),
            title: 'Cards (Credit / Debit)',
            subtitle: 'Visa, MasterCard, RuPay, Maestro',
          ),
          if (_selectedPaymentMethod == 'card') ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF10B981)),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '4111 •••• •••• 4444 (Razorpay Test Card)',
                      style: TextStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                  Text('EXP 12/28', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ),
          ],

          const Divider(height: 24, color: Color(0xFFF1F5F9)),

          // 3. Netbanking Section
          _buildMethodHeader(
            id: 'netbanking',
            icon: Icons.account_balance_rounded,
            iconColor: const Color(0xFF4F46E5),
            title: 'Netbanking',
            subtitle: 'SBI, HDFC, ICICI, Axis, Canara Bank',
          ),
          if (_selectedPaymentMethod == 'netbanking') ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank'].map((b) {
                final isSelected = _selectedBank == b;
                return GestureDetector(
                  onTap: () => setState(() => _selectedBank = b),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                        width: isSelected ? 1.5 : 1,
                      ),
                    ),
                    child: Text(
                      b,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF334155),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],

          const Divider(height: 24, color: Color(0xFFF1F5F9)),

          // 4. Wallets Section
          _buildMethodHeader(
            id: 'wallet',
            icon: Icons.account_balance_wallet_rounded,
            iconColor: const Color(0xFFD97706),
            title: 'Wallets',
            subtitle: 'Airtel Money, Mobikwik, Freecharge',
          ),

          const SizedBox(height: 22),

          // Pay Button CTA
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => setState(() => _isInMockBank = true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0066FF),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_rounded, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Pay ₹${widget.amount.toInt()}',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),
          const Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined, size: 12, color: Color(0xFF94A3B8)),
                SizedBox(width: 4),
                Text(
                  'Secured by Razorpay • Test Environment',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMethodHeader({
    required String id,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    final isSelected = _selectedPaymentMethod == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedPaymentMethod = id),
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          Icon(
            isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
            color: isSelected ? const Color(0xFF0066FF) : const Color(0xFFCBD5E1),
            size: 20,
          ),
        ],
      ),
    );
  }

  Widget _buildUpiAppTile(String name, Color color, String badge) {
    final isSelected = _selectedUpiApp == name;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedUpiApp = name),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.08) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? color : const Color(0xFFE2E8F0),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  badge,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                name,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: const Color(0xFF1E293B),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Exact replica of Mobile-Compatible Razorpay Demo Bank Mock Page from StepReview.tsx
  Widget _buildDemoBankView() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Back to methods row
          Row(
            children: [
              GestureDetector(
                onTap: () => setState(() => _isInMockBank = false),
                child: const Row(
                  children: [
                    Icon(Icons.arrow_back_rounded, size: 16, color: Color(0xFF64748B)),
                    SizedBox(width: 4),
                    Text(
                      'Back to methods',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Big Blue Italic '1' Glyph
          const Text(
            '1',
            style: TextStyle(
              color: Color(0xFF2563EB),
              fontSize: 56,
              fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 12),

          // Welcome to Razorpay Software Private Ltd Bank
          const Text(
            'Welcome to Razorpay Software Private Ltd Bank',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F172A),
              height: 1.25,
            ),
          ),
          const SizedBox(height: 8),

          // Subtitle: This is just a demo bank page.
          const Text(
            'This is just a demo bank page.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),

          // Description
          const Text(
            'You can choose whether to make this payment successful or not:',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF334155),
            ),
          ),
          const SizedBox(height: 24),

          // Success & Failure side-by-side action buttons
          Row(
            children: [
              // Green Success Button
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _submittingOutcome != null
                        ? null
                        : () => _handleBankOutcome('S'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF22C55E),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _submittingOutcome == 'S'
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Success',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ),
              const SizedBox(width: 14),

              // Red Failure Button
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _submittingOutcome != null
                        ? null
                        : () => _handleBankOutcome('F'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _submittingOutcome == 'F'
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Failure',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),

          if (_submittingOutcome != null) ...[
            const SizedBox(height: 16),
            Text(
              _submittingOutcome == 'S'
                  ? 'Authorizing payment…'
                  : 'Declining payment…',
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
