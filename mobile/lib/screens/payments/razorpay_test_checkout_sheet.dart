import 'dart:math';
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

class RazorpayTestCheckoutSheet extends StatelessWidget {
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
    return Navigator.of(context).push<RazorpayCheckoutResult>(
      MaterialPageRoute(
        builder: (_) => RazorpayCheckoutScreen(
          amount: amount,
          serviceName: serviceName,
          bookingId: bookingId,
          orderId: orderId,
          customerName: customerName,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RazorpayCheckoutScreen(
      amount: amount,
      serviceName: serviceName,
      bookingId: bookingId,
      orderId: orderId,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
    );
  }
}

class RazorpayCheckoutScreen extends StatefulWidget {
  final double amount;
  final String? serviceName;
  final String? bookingId;
  final String? orderId;
  final String? customerName;
  final String? customerEmail;
  final String? customerPhone;

  const RazorpayCheckoutScreen({
    super.key,
    required this.amount,
    this.serviceName,
    this.bookingId,
    this.orderId,
    this.customerName,
    this.customerEmail,
    this.customerPhone,
  });

  @override
  State<RazorpayCheckoutScreen> createState() => _RazorpayCheckoutScreenState();
}

class _RazorpayCheckoutScreenState extends State<RazorpayCheckoutScreen> {
  bool _isNetbankingExpanded = false;
  bool _isWalletExpanded = false;
  String _selectedNetBank = 'HDFC';
  String _selectedWallet = 'Paytm';

  void _openDemoBankModal() {
    showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.6),
      builder: (dlgCtx) => Theme(
        data: Theme.of(dlgCtx).copyWith(splashFactory: NoSplash.splashFactory),
        child: Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: Colors.white,
          insetPadding: const EdgeInsets.symmetric(horizontal: 22),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Close Button
                Align(
                  alignment: Alignment.topRight,
                  child: GestureDetector(
                    onTap: () => Navigator.of(dlgCtx).pop(),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),

                // Big Blue Italic '1'
                const Text(
                  '1',
                  style: TextStyle(
                    color: Color(0xFF2563EB),
                    fontSize: 54,
                    fontWeight: FontWeight.w900,
                    fontStyle: FontStyle.italic,
                    height: 1.0,
                  ),
                ),
                const SizedBox(height: 14),

                // Welcome to Razorpay Software Private Ltd Bank
                const Text(
                  'Welcome to Razorpay Software Private Ltd Bank',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 17,
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
                    fontSize: 12.5,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 6),

                // Prompt
                const Text(
                  'You can choose whether to make this payment successful or not:',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF334155),
                  ),
                ),
                const SizedBox(height: 22),

                // Success & Failure side-by-side action buttons
                Row(
                  children: [
                    // Green Success Button
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: ElevatedButton(
                          onPressed: () => _handleOutcome(dlgCtx, 'S'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF22C55E),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text(
                            'Success',
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Red Failure Button
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: ElevatedButton(
                          onPressed: () => _handleOutcome(dlgCtx, 'F'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEF4444),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text(
                            'Failure',
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleOutcome(BuildContext dialogContext, String outcome) async {
    Navigator.of(dialogContext).pop(); // dismiss demo bank modal

    final orderId = widget.orderId ?? 'order_${DateTime.now().millisecondsSinceEpoch}';
    final paymentId = 'pay_test_${DateTime.now().millisecondsSinceEpoch}';

    // In background, hit test-simulate if bookingId is provided
    if (widget.bookingId != null && widget.bookingId!.isNotEmpty) {
      try {
        await ApiService.post(
          '${ApiConstants.payments}/test-simulate',
          {
            'bookingId': widget.bookingId,
            'outcome': outcome == 'S' ? 'success' : 'failure',
          },
        );
      } catch (_) {}
    }

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

  void _showViewDetailsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Payment Details',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.of(ctx).pop(),
                    child: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildDetailRow('Merchant', 'HomeCareX'),
              _buildDetailRow('Service', widget.serviceName ?? 'Home Service'),
              _buildDetailRow('Environment', 'Razorpay Test Gateway (rzp_test)'),
              _buildDetailRow('Payment Amount', '₹${widget.amount.toInt()}'),
              _buildDetailRow('Platform Fee', 'Free'),
              const Divider(height: 20, color: Color(0xFFE2E8F0)),
              _buildDetailRow('Total Payable', '₹${widget.amount.toInt()}', isBold: true),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: isBold ? const Color(0xFF0F172A) : const Color(0xFF64748B), fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: isBold ? const Color(0xFF0F172A) : const Color(0xFF1E293B), fontWeight: isBold ? FontWeight.bold : FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(splashFactory: NoSplash.splashFactory),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              // 1. Top Bar matching media_1795424344222_1a10f3fb.jpg
              _buildTopBar(),

              // 2. Scrollable Body
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Section Header: Payment Options
                      const Text(
                        'Payment Options',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // UPI QR card
                      _buildUpiQrCard(),
                      const SizedBox(height: 18),

                      // Section Header: All Payment Options
                      const Text(
                        'All Payment Options',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Options List matching screenshot
                      _buildPaymentOptionTile(
                        icon: Icons.qr_code_2_rounded,
                        title: 'UPI',
                        badges: ['GPay', 'PhonePe', 'Paytm'],
                        badgeColors: [const Color(0xFF1A73E8), const Color(0xFF5F259F), const Color(0xFF00B9F1)],
                        onTap: _openDemoBankModal,
                      ),
                      _buildDivider(),

                      _buildPaymentOptionTile(
                        icon: Icons.credit_card_rounded,
                        title: 'Cards',
                        badges: ['VISA', 'MC', 'RuPay'],
                        badgeColors: [const Color(0xFF1A1F71), const Color(0xFFEB001B), const Color(0xFF097939)],
                        onTap: _openDemoBankModal,
                      ),
                      _buildDivider(),

                      _buildPaymentOptionTile(
                        icon: Icons.percent_rounded,
                        title: 'EMI',
                        badges: ['Credit/Debit'],
                        badgeColors: [const Color(0xFF475569)],
                        onTap: _openDemoBankModal,
                      ),
                      _buildDivider(),

                      _buildExpandableOptionTile(
                        icon: Icons.account_balance_outlined,
                        title: 'Netbanking',
                        badges: ['SBI', 'HDFC', 'ICICI'],
                        badgeColors: [const Color(0xFF0039A6), const Color(0xFF004C8F), const Color(0xFFB02A30)],
                        isExpanded: _isNetbankingExpanded,
                        onToggle: () => setState(() => _isNetbankingExpanded = !_isNetbankingExpanded),
                        expandedChild: _buildNetbankingExpandedContent(),
                      ),
                      _buildDivider(),

                      _buildExpandableOptionTile(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'Wallet',
                        badges: ['Paytm', 'Airtel', 'MobiKwik'],
                        badgeColors: [const Color(0xFF00B9F1), const Color(0xFFE11900), const Color(0xFF1E88E5)],
                        isExpanded: _isWalletExpanded,
                        onToggle: () => setState(() => _isWalletExpanded = !_isWalletExpanded),
                        expandedChild: _buildWalletExpandedContent(),
                      ),
                    ],
                  ),
                ),
              ),

              // 3. Sticky Bottom Action Bar matching media_1795424344222_1a10f3fb.jpg
              _buildStickyBottomBar(),
            ],
          ),
        ),
      ),
    );
  }

  /// Top Bar with vivid blue background, Back arrow, HomeCareX logo & User avatar
  Widget _buildTopBar() {
    return Container(
      color: const Color(0xFF0066FF), // Razorpay brand blue
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  Navigator.of(context).pop(RazorpayCheckoutResult.cancelled());
                },
                behavior: HitTestBehavior.opaque,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  child: Icon(Icons.arrow_back_rounded, color: Colors.white, size: 22),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.22),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Text(
                    'H',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'HomeCareX',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.22),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.person_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  /// UPI QR Box with Crisp QR Code and App Logos
  Widget _buildUpiQrCard() {
    return GestureDetector(
      onTap: _openDemoBankModal,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'UPI QR',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),
                  ),
                ),
                Row(
                  children: [
                    const Icon(Icons.access_time_rounded, size: 12, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Text(
                      '11:55',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                // Sharp vector QR Code box
                Container(
                  width: 86,
                  height: 86,
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: CustomPaint(
                    size: const Size(74, 74),
                    painter: const _AuthenticUpiQrPainter(),
                  ),
                ),
                const SizedBox(width: 14),

                // Right text & icons
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Scan the QR using any UPI App',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Row of mini app badges
                      Row(
                        children: [
                          _buildMiniCircleBadge('G', const Color(0xFF1A73E8)),
                          const SizedBox(width: 6),
                          _buildMiniCircleBadge('Pe', const Color(0xFF5F259F)),
                          const SizedBox(width: 6),
                          _buildMiniCircleBadge('P', const Color(0xFF00B9F1)),
                          const SizedBox(width: 6),
                          _buildMiniCircleBadge('B', const Color(0xFF059669)),
                          const SizedBox(width: 6),
                          _buildMiniCircleBadge('C', const Color(0xFF0F172A)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniCircleBadge(String text, Color bg) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: bg.withOpacity(0.25),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Center(
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 9.5,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentOptionTile({
    required IconData icon,
    required String title,
    required List<String> badges,
    required List<Color> badgeColors,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Icon(icon, size: 20, color: const Color(0xFF334155)),
            const SizedBox(width: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Row(
                children: List.generate(badges.length, (i) {
                  return Container(
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: badgeColors[i].withOpacity(0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      badges[i],
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: badgeColors[i],
                      ),
                    ),
                  );
                }),
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  Widget _buildExpandableOptionTile({
    required IconData icon,
    required String title,
    required List<String> badges,
    required List<Color> badgeColors,
    required bool isExpanded,
    required VoidCallback onToggle,
    required Widget expandedChild,
  }) {
    return Column(
      children: [
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Icon(icon, size: 20, color: const Color(0xFF334155)),
                const SizedBox(width: 12),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Row(
                    children: List.generate(badges.length, (i) {
                      return Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: badgeColors[i].withOpacity(0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          badges[i],
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: badgeColors[i],
                          ),
                        ),
                      );
                    }),
                  ),
                ),
                Icon(
                  isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                  size: 20,
                  color: const Color(0xFF94A3B8),
                ),
              ],
            ),
          ),
        ),
        if (isExpanded) expandedChild,
      ],
    );
  }

  Widget _buildNetbankingExpandedContent() {
    final banks = ['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: banks.map((b) {
          final isSelected = _selectedNetBank == b;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedNetBank = b);
              _openDemoBankModal();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isSelected ? const Color(0xFF0066FF) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Text(
                b,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? const Color(0xFF0066FF) : const Color(0xFF334155),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildWalletExpandedContent() {
    final wallets = ['Paytm', 'Airtel Money', 'MobiKwik', 'Freecharge'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: wallets.map((w) {
          final isSelected = _selectedWallet == w;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedWallet = w);
              _openDemoBankModal();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isSelected ? const Color(0xFF0066FF) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Text(
                w,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? const Color(0xFF0066FF) : const Color(0xFF334155),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDivider() {
    return const Divider(height: 1, color: Color(0xFFF1F5F9));
  }

  /// Sticky Bottom Bar matching media_1795424344222_1a10f3fb.jpg
  Widget _buildStickyBottomBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Amount & View Details Link
          GestureDetector(
            onTap: _showViewDetailsSheet,
            behavior: HitTestBehavior.opaque,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '₹${widget.amount.toInt()}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const Row(
                  children: [
                    Text(
                      'View Details',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF475569),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Icon(Icons.keyboard_arrow_up_rounded, size: 14, color: Color(0xFF64748B)),
                  ],
                ),
              ],
            ),
          ),

          // Continue Button
          SizedBox(
            width: 130,
            height: 44,
            child: ElevatedButton(
              onPressed: _openDemoBankModal,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B132B), // Dark navy / black button
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text(
                'Continue',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Authentic high-resolution QR code painter with 3 corner finder patterns and data modules
class _AuthenticUpiQrPainter extends CustomPainter {
  const _AuthenticUpiQrPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final fillPaint = Paint()..color = const Color(0xFF0F172A);
    const int grid = 21;
    final cellSize = size.width / grid;

    void drawFinderPattern(int r, int c) {
      // 7x7 outer square
      canvas.drawRect(Rect.fromLTWH(c * cellSize, r * cellSize, 7 * cellSize, 7 * cellSize), fillPaint);
      // 5x5 inner white square
      final whitePaint = Paint()..color = Colors.white;
      canvas.drawRect(Rect.fromLTWH((c + 1) * cellSize, (r + 1) * cellSize, 5 * cellSize, 5 * cellSize), whitePaint);
      // 3x3 center filled square
      canvas.drawRect(Rect.fromLTWH((c + 2) * cellSize, (r + 2) * cellSize, 3 * cellSize, 3 * cellSize), fillPaint);
    }

    drawFinderPattern(0, 0); // Top-left
    drawFinderPattern(0, grid - 7); // Top-right
    drawFinderPattern(grid - 7, 0); // Bottom-left

    // Deterministic module pattern
    final rand = Random(42);
    for (int r = 0; r < grid; r++) {
      for (int c = 0; c < grid; c++) {
        // Skip finder areas
        if ((r < 8 && c < 8) || (r < 8 && c >= grid - 8) || (r >= grid - 8 && c < 8)) {
          continue;
        }
        if (rand.nextBool()) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize + 0.3, r * cellSize + 0.3, cellSize - 0.6, cellSize - 0.6),
            fillPaint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
