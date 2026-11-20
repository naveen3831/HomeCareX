import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/booking_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../catalog/services_screen.dart';
import 'booking_tracking_screen.dart';
import 'bookings_screen.dart';

class ActiveBookingsScreen extends StatefulWidget {
  final bool autoFetch;
  final List<BookingModel>? initialBookings;

  const ActiveBookingsScreen({
    super.key,
    this.autoFetch = true,
    this.initialBookings,
  });

  @override
  State<ActiveBookingsScreen> createState() => _ActiveBookingsScreenState();
}

class _ActiveBookingsScreenState extends State<ActiveBookingsScreen> {
  late List<BookingModel> _bookings;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _bookings = widget.initialBookings != null
        ? List<BookingModel>.from(widget.initialBookings!)
        : [];

    if (widget.autoFetch && widget.initialBookings == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _fetchActiveBookings();
      });
    }
  }

  Future<void> _fetchActiveBookings() async {
    setState(() => _isLoading = true);
    try {
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated) {
        final bookingProv = context.read<BookingProvider>();
        await bookingProv.fetchBookings();
        if (mounted) {
          final allBookings = bookingProv.bookings;
          final active = allBookings.where((b) {
            final s = b.status.toLowerCase().trim();
            return s == 'assigned' ||
                s == 'on_the_way' ||
                s == 'en_route' ||
                s == 'in_progress' ||
                s == 'confirmed';
          }).toList();
          setState(() {
            _bookings = active;
          });
        }
      }
    } catch (_) {
      // Fallback or keep empty
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E1B2E), size: 22),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: const Text(
          'Active Bookings',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF4F46E5)))
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                child: Column(
                  children: [
                    if (_bookings.isEmpty) ...[
                      _buildEmptyStateCard(context),
                    ] else ...[
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _bookings.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 14),
                        itemBuilder: (ctx, index) {
                          return _buildActiveBookingCard(context, _bookings[index]);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildEmptyStateCard(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 36),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Open Inbox / Package outline icon matching web Lucide Inbox
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Icon(
                Icons.inbox_outlined,
                size: 26,
                color: Color(0xFF94A3B8),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'No active bookings to track',
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 6),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              'You don\'t have any live bookings at the moment. Once a partner is assigned or en route, you can track them here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12.5,
                color: Color(0xFF64748B),
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(height: 22),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Button 1: My Bookings
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF1F5F9),
                  foregroundColor: const Color(0xFF334155),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const BookingsScreen()),
                  );
                },
                child: const Text(
                  'My Bookings',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 12),
              // Button 2: Browse Services
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ServicesScreen()),
                  );
                },
                child: const Text(
                  'Browse Services',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActiveBookingCard(BuildContext context, BookingModel booking) {
    final status = booking.status.toLowerCase();
    Color statusBg = const Color(0xFFEFF6FF);
    Color statusFg = const Color(0xFF2563EB);
    String statusText = 'Confirmed';

    if (status == 'assigned') {
      statusBg = const Color(0xFFF3E8FF);
      statusFg = const Color(0xFF7C3AED);
      statusText = 'Partner Assigned';
    } else if (status == 'on_the_way' || status == 'en_route') {
      statusBg = const Color(0xFFFFF7ED);
      statusFg = const Color(0xFFEA580C);
      statusText = 'On the way';
    } else if (status == 'in_progress') {
      statusBg = const Color(0xFFECFDF5);
      statusFg = const Color(0xFF059669);
      statusText = 'In progress';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: statusFg,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusFg,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '#${booking.id.length > 8 ? booking.id.substring(booking.id.length - 6).toUpperCase() : booking.id}',
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            booking.serviceTitle,
            style: const TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  booking.partnerName != null && booking.partnerName!.isNotEmpty
                      ? 'Partner ${booking.partnerName} assigned'
                      : 'Partner is preparing for your service',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '₹${booking.amount.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BookingTrackingScreen(booking: booking),
                    ),
                  );
                },
                icon: const Icon(Icons.near_me_rounded, size: 14),
                label: const Text('Track Live', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
