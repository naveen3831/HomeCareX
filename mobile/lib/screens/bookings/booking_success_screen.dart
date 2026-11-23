import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/address_model.dart';
import '../../core/models/booking_model.dart';
import '../../core/models/service_model.dart';
import '../../core/utils/bell_3d_icon.dart';
import '../../providers/address_provider.dart';
import '../../providers/notification_provider.dart';
import '../notifications/notifications_screen.dart';
import 'bookings_screen.dart';
import 'booking_tracking_screen.dart';

/// Full-page Booking Confirmation Screen matching web customer/booking/success/:id
/// (media_1795425402997_a1f12228.png)
class BookingSuccessScreen extends StatelessWidget {
  final String bookingId;
  final BookingModel? booking;
  final ServiceModel? service;
  final CustomerAddress? selectedAddress;
  final String? addressText;
  final DateTime? selectedDate;
  final String? selectedSlot;
  final String paymentMethod;
  final double totalAmount;
  final bool isCod;
  final DateTime? createdAt;

  const BookingSuccessScreen({
    super.key,
    required this.bookingId,
    this.booking,
    this.service,
    this.selectedAddress,
    this.addressText,
    this.selectedDate,
    this.selectedSlot,
    this.paymentMethod = 'Net banking',
    this.totalAmount = 742.0,
    this.isCod = false,
    this.createdAt,
  });

  String _formatLongDate(DateTime dt) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  String _formatShortDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  String _formatTimestamp(DateTime dt) {
    final dateStr = _formatShortDate(dt);
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final suffix = dt.hour >= 12 ? 'PM' : 'AM';
    return '$dateStr • ${hour.toString().padLeft(2, '0')}:$minute $suffix';
  }

  String _formatSlot(String? slot) {
    if (slot == null || slot.trim().isEmpty) return '04:00 PM - 06:00 PM';
    final parts = slot.split('-');
    if (parts.length == 2) {
      String to12(String timeStr) {
        final t = timeStr.trim();
        final segs = t.split(':');
        if (segs.length == 2) {
          final h = int.tryParse(segs[0]) ?? 0;
          final m = int.tryParse(segs[1]) ?? 0;
          final suffix = h >= 12 ? 'PM' : 'AM';
          final hr = h % 12 == 0 ? 12 : h % 12;
          return '${hr.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')} $suffix';
        }
        return timeStr;
      }
      return '${to12(parts[0])} - ${to12(parts[1])}';
    }
    return slot;
  }

  String _resolveBookingRef(String id) {
    if (id.isEmpty) return '#2A97C6';
    final clean = id.replaceAll('BK-', '').replaceAll('#', '').trim();
    if (clean.length >= 6) {
      return '#${clean.substring(clean.length - 6).toUpperCase()}';
    }
    return '#${clean.toUpperCase()}';
  }

  BookingModel _resolveBookingModel() {
    if (booking != null) return booking!;
    return BookingModel(
      id: bookingId,
      serviceTitle: service?.name ?? 'Haircut & Styling',
      amount: totalAmount,
      status: 'confirmed',
      scheduledAt: selectedDate ?? DateTime.now(),
      address: addressText ?? '000000, Image Garden Road, Ayyappa Society Colony, Hyderabad - 500081',
      partnerName: 'Priya Sharma (Assigned)',
      partnerPhone: '+91 98765 43210',
      startOtp: '4082',
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = createdAt ?? DateTime.now();
    final schedDate = selectedDate ?? now;
    final schedSlot = _formatSlot(selectedSlot);
    final bookingRef = _resolveBookingRef(bookingId);

    // Resolve address line
    String addr = addressText ?? '';
    if (addr.isEmpty && selectedAddress != null) {
      addr = selectedAddress!.formattedAddress;
    }
    if (addr.isEmpty) {
      try {
        final ap = context.watch<AddressProvider>();
        if (ap.selectedAddress != null) {
          addr = ap.selectedAddress!.formattedAddress;
        }
      } catch (_) {}
    }
    if (addr.isEmpty) {
      addr = '000000, Image Garden Road, Ayyappa Society Colony, Hyderabad - 500081';
    }

    // Resolve unread notifications
    int unreadCount = 1;
    try {
      final notifProv = context.watch<NotificationProvider>();
      unreadCount = notifProv.unreadCount;
    } catch (_) {}

    // Resolve payment info
    final isOnlinePaid = !isCod &&
        paymentMethod.toLowerCase() != 'cash' &&
        paymentMethod.toLowerCase() != 'cod' &&
        paymentMethod.toLowerCase() != 'cash on service';
    final resolvedMethod = isOnlinePaid ? paymentMethod : 'Cash on Service';
    final paymentStatusLabel = isOnlinePaid ? 'Paid online' : 'Pay on service';

    final serviceTitle = service?.name ?? booking?.serviceTitle ?? 'Haircut & Styling';
    final serviceDesc = service?.description ??
        'Professional home cleaning for a cleaner and healthier home.';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          Navigator.of(context).popUntil((r) => r.isFirst);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFAFAFC),
        body: SafeArea(
          child: Column(
            children: [
              // 1. Sticky Top Location Bar with 3D Notification Bell
              _buildTopLocationHeader(context, addr, unreadCount),

              // 2. Scrollable Confirmation Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Banner Card: "Booking Confirmed!" with 3D illustration
                      _buildConfirmationBanner(isCod),
                      const SizedBox(height: 14),

                      // Booking Details Card
                      _buildBookingDetailsCard(
                        serviceTitle: serviceTitle,
                        serviceDesc: serviceDesc,
                        dateStr: _formatLongDate(schedDate),
                        timeSlot: schedSlot,
                        address: addr,
                        method: resolvedMethod,
                        isPaid: isOnlinePaid,
                        statusLabel: paymentStatusLabel,
                        bookingRef: bookingRef,
                        amount: totalAmount,
                      ),
                      const SizedBox(height: 14),

                      // Booking Progress Tracker Card
                      _buildProgressTrackerCard(
                        isCod: isCod,
                        confirmedAt: _formatTimestamp(now),
                        serviceVisitTime: '${_formatShortDate(schedDate)} • $schedSlot',
                      ),
                      const SizedBox(height: 20),

                      // Action Buttons
                      _buildActionButtons(context),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 1. Top Location Header matching HomeScreen & web screenshot
  Widget _buildTopLocationHeader(BuildContext context, String addressLine, int badgeCount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Location details
          Expanded(
            child: GestureDetector(
              onTap: () {
                // Return to home or open address selection
                Navigator.of(context).popUntil((r) => r.isFirst);
              },
              behavior: HitTestBehavior.opaque,
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: Color(0xFFEEECFB),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.location_on_rounded,
                        color: AppColors.brand,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Text(
                              'Deliver to ',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                            Text(
                              '• Home',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.brand,
                              ),
                            ),
                            SizedBox(width: 2),
                            Icon(
                              Icons.keyboard_arrow_down_rounded,
                              size: 16,
                              color: AppColors.brand,
                            ),
                          ],
                        ),
                        Text(
                          addressLine,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF9CA3AF),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),

          // 3D Notification Bell
          NotificationBellButton(
            count: badgeCount,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              );
            },
          ),
        ],
      ),
    );
  }

  /// 2. Celebratory Banner Card matching screenshot & web index.tsx
  Widget _buildConfirmationBanner(bool isCod) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            Color(0xFFDCFCE7),
            Color(0xFFF0FDF4),
            Color(0xFFECFDF5),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFA7F3D0), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF10B981).withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 3D Vector Illustration (Check badge & modern house)
          const SizedBox(
            width: 82,
            height: 64,
            child: CustomPaint(
              size: Size(82, 64),
              painter: _Success3DIllustrationPainter(),
            ),
          ),
          const SizedBox(width: 12),

          // Heading & Subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isCod ? 'Order Placed!' : 'Booking Confirmed!',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 3),
                Text.rich(
                  TextSpan(
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF475569),
                      height: 1.35,
                    ),
                    children: [
                      TextSpan(
                        text: isCod
                            ? 'Your order has been placed successfully. Pay the professional in cash after the service.'
                            : 'Your service has been booked successfully. Thank you for choosing ',
                      ),
                      if (!isCod)
                        const TextSpan(
                          text: 'HomeCareX',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4338CA),
                          ),
                        ),
                      if (!isCod) const TextSpan(text: '!'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 3. Booking Details Card matching screenshot & web index.tsx
  Widget _buildBookingDetailsCard({
    required String serviceTitle,
    required String serviceDesc,
    required String dateStr,
    required String timeSlot,
    required String address,
    required String method,
    required bool isPaid,
    required String statusLabel,
    required String bookingRef,
    required double amount,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF281E50).withValues(alpha: 0.05),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: "Booking Details" + "✓ Confirmed" badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.receipt_long_rounded,
                        color: Color(0xFF4338CA),
                        size: 15,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Booking Details',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_rounded, color: Color(0xFF059669), size: 13),
                    SizedBox(width: 4),
                    Text(
                      'Confirmed',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF047857),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Service Row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildServiceThumbnail(serviceTitle),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Service',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF4338CA),
                        ),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      serviceTitle,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      serviceDesc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 12),

          // 2x2 Info Grid
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date & Time
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.calendar_today_rounded, size: 12, color: Color(0xFF4338CA)),
                        SizedBox(width: 4),
                        Text(
                          'Date & Time',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      dateStr,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      timeSlot,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Service Address
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.location_on_rounded, size: 12, color: Color(0xFF4338CA)),
                        SizedBox(width: 4),
                        Text(
                          'Service Address',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      address,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Payment Method
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.credit_card_rounded, size: 12, color: Color(0xFF4338CA)),
                        SizedBox(width: 4),
                        Text(
                          'Payment Method',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      method,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Payment Status
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isPaid ? Icons.check_circle_rounded : Icons.pending_rounded,
                          size: 12,
                          color: isPaid ? const Color(0xFF059669) : const Color(0xFFD97706),
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          'Payment Status',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      statusLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isPaid ? const Color(0xFF059669) : const Color(0xFFD97706),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Bottom Highlight Strip: Reference ID & Total Amount
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F3FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE0E7FE)),
            ),
            child: Row(
              children: [
                // Hash icon
                Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: Color(0xFF4338CA),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Text(
                      '#',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Booking Reference
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'BOOKING REFERENCE',
                      style: TextStyle(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF94A3B8),
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      bookingRef,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),

                const Spacer(),
                Container(
                  width: 1,
                  height: 26,
                  color: const Color(0xFFC7D2FE),
                ),
                const Spacer(),

                // Total Amount
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'TOTAL AMOUNT',
                      style: TextStyle(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF94A3B8),
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '₹${amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2)}',
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF4338CA),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Service Thumbnail matching screenshot icon styling
  Widget _buildServiceThumbnail(String name) {
    final lower = name.toLowerCase();
    Color bg = const Color(0xFFEEF2FF);
    Color iconColor = const Color(0xFF4338CA);
    IconData icon = Icons.home_repair_service_rounded;

    if (lower.contains('haircut') || lower.contains('salon') || lower.contains('styling')) {
      bg = const Color(0xFFFDF2F8);
      iconColor = const Color(0xFFDB2777);
      icon = Icons.content_cut_rounded;
    } else if (lower.contains('clean') || lower.contains('shelf') || lower.contains('rod')) {
      bg = const Color(0xFFEFF6FF);
      iconColor = const Color(0xFF2563EB);
      icon = Icons.cleaning_services_rounded;
    } else if (lower.contains('appliance') || lower.contains('repair') || lower.contains('service')) {
      bg = const Color(0xFFFEF3C7);
      iconColor = const Color(0xFFD97706);
      icon = Icons.build_rounded;
    }

    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Center(
        child: Icon(icon, color: iconColor, size: 24),
      ),
    );
  }

  /// 4. Booking Progress Tracker Card matching screenshot & web index.tsx
  Widget _buildProgressTrackerCard({
    required bool isCod,
    required String confirmedAt,
    required String serviceVisitTime,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF281E50).withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          // Step 1: Confirmed
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: const BoxDecoration(
                    color: Color(0xFF10B981),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.check_rounded, color: Colors.white, size: 15),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        isCod ? 'Order Placed' : 'Booking Confirmed',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        confirmedAt,
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Green Connecting Line
          Container(
            width: 20,
            height: 3,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Step 2: Service Visit
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFC7D2FE), width: 1.5),
                  ),
                  child: const Center(
                    child: Icon(Icons.access_time_rounded, color: Color(0xFF4338CA), size: 14),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Service Visit',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        serviceVisitTime,
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 5. Action Buttons matching screenshot & web index.tsx
  Widget _buildActionButtons(BuildContext context) {
    return Column(
      children: [
        // Primary Button: "View My Bookings ->"
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4338CA),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const BookingsScreen()),
              );
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.calendar_month_outlined, size: 18),
                SizedBox(width: 8),
                Text(
                  'View My Bookings',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward_rounded, size: 18),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),

        // Track Booking Button (matches existing test assertions & provides quick job tracking)
        SizedBox(
          width: double.infinity,
          height: 46,
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF4338CA),
              side: const BorderSide(color: Color(0xFFC7D2FE), width: 1.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            onPressed: () {
              final b = _resolveBookingModel();
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => BookingTrackingScreen(booking: b)),
              );
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.explore_outlined, size: 18),
                SizedBox(width: 8),
                Text(
                  'Track Booking',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),

        // Secondary Button: "Return to Home"
        SizedBox(
          width: double.infinity,
          height: 46,
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF4338CA),
              side: const BorderSide(color: Color(0xFFC7D2FE), width: 1.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            onPressed: () {
              Navigator.of(context).popUntil((r) => r.isFirst);
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.home_outlined, size: 18),
                SizedBox(width: 8),
                Text(
                  'Return to Home',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// 3D Vector Illustration CustomPainter matching web frontend SuccessBadgeIllustration
class _Success3DIllustrationPainter extends CustomPainter {
  const _Success3DIllustrationPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 130.0;
    canvas.save();
    canvas.scale(scale);

    // 1. Sparkles & Ambient dots
    final starPaint = Paint()
      ..color = const Color(0xFF10B981).withValues(alpha: 0.75)
      ..style = PaintingStyle.fill;
    final starPath = Path()
      ..moveTo(48, 10)
      ..lineTo(50, 15)
      ..lineTo(55, 17)
      ..lineTo(50, 19)
      ..lineTo(48, 24)
      ..lineTo(46, 19)
      ..lineTo(41, 17)
      ..lineTo(46, 15)
      ..close();
    canvas.drawPath(starPath, starPaint);

    final dot1 = Paint()..color = const Color(0xFF34D399);
    canvas.drawCircle(const Offset(20, 40), 3, dot1);

    final dot2 = Paint()..color = const Color(0xFF6EE7B7);
    canvas.drawCircle(const Offset(120, 30), 2.5, dot2);

    // 2. 3D Check Card Base (tilted pill)
    canvas.save();
    canvas.translate(45, 45);
    canvas.rotate(-6 * 3.141592653589793 / 180);
    canvas.translate(-45, -45);

    final cardRRect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(18, 14, 56, 56),
      const Radius.circular(16),
    );
    final cardFill = Paint()..color = const Color(0xFFF0FDF4);
    final cardStroke = Paint()
      ..color = const Color(0xFFD1FAE5)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    canvas.drawRRect(cardRRect, cardFill);
    canvas.drawRRect(cardRRect, cardStroke);

    // Green Check Circle
    final greenGrad = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF34D399), Color(0xFF059669)],
      ).createShader(const Rect.fromLTWH(25, 21, 42, 42))
      ..style = PaintingStyle.fill;
    canvas.drawCircle(const Offset(46, 42), 21, greenGrad);

    // White Checkmark
    final checkPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final checkPath = Path()
      ..moveTo(38, 42.5)
      ..lineTo(43.5, 48)
      ..lineTo(54.5, 37);
    canvas.drawPath(checkPath, checkPaint);

    canvas.restore();

    // 3. 3D Modern House
    canvas.save();
    canvas.translate(68, 28);

    // Shrubs
    final bush1 = Paint()..color = const Color(0xFF10B981);
    final bush2 = Paint()..color = const Color(0xFF34D399);
    canvas.drawCircle(const Offset(48, 44), 12, bush1);
    canvas.drawCircle(const Offset(4, 46), 8, bush2);

    // House Base
    final houseRRect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(10, 22, 40, 34),
      const Radius.circular(6),
    );
    final houseFill = Paint()..color = Colors.white;
    final houseStroke = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawRRect(houseRRect, houseFill);
    canvas.drawRRect(houseRRect, houseStroke);

    // Indigo Roof
    final roofOuter = Paint()
      ..color = const Color(0xFF4338CA)
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final roofOuterPath = Path()
      ..moveTo(6, 24)
      ..lineTo(28, 4)
      ..lineTo(54, 24);
    canvas.drawPath(roofOuterPath, roofOuter);

    final roofInner = Paint()
      ..color = const Color(0xFF6366F1)
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final roofInnerPath = Path()
      ..moveTo(8, 23)
      ..lineTo(28, 5)
      ..lineTo(52, 23);
    canvas.drawPath(roofInnerPath, roofInner);

    // Door
    final doorRRect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(23, 36, 14, 20),
      const Radius.circular(3),
    );
    final doorPaint = Paint()..color = const Color(0xFF1E1B4B);
    canvas.drawRRect(doorRRect, doorPaint);

    // Window
    final winFill = Paint()..color = const Color(0xFFEEF2FF);
    final winStroke = Paint()
      ..color = const Color(0xFF818CF8)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(const Offset(28, 19), 3.5, winFill);
    canvas.drawCircle(const Offset(28, 19), 3.5, winStroke);

    canvas.restore();
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
