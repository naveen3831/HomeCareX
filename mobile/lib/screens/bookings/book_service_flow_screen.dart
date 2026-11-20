import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/address_model.dart';
import '../../core/models/service_model.dart';
import '../../core/utils/service_image_resolver.dart';
import '../../providers/booking_provider.dart';
import '../bookings/active_bookings_screen.dart';

class BookServiceFlowScreen extends StatefulWidget {
  final ServiceModel service;
  final int initialStep;

  const BookServiceFlowScreen({
    super.key,
    required this.service,
    this.initialStep = 1,
  });

  @override
  State<BookServiceFlowScreen> createState() => _BookServiceFlowScreenState();
}

class _BookServiceFlowScreenState extends State<BookServiceFlowScreen> {
  late int _currentStep;
  int _quantity = 1;

  // Step 2: Address
  late List<CustomerAddress> _savedAddresses;
  CustomerAddress? _selectedAddress;
  bool _isAddingNewAddress = false;
  final TextEditingController _mapSearchController = TextEditingController();
  final TextEditingController _houseController = TextEditingController();
  final TextEditingController _landmarkController = TextEditingController();
  final TextEditingController _cityController = TextEditingController(text: 'Hyderabad');
  final TextEditingController _pincodeController = TextEditingController(text: '500081');

  // Step 3: Schedule
  late List<DateTime> _bookableDates;
  late DateTime _selectedDate;
  String _selectedSlot = '10:30 AM - 11:30 AM';

  // Step 4: Review & Payment
  String _paymentMethod = 'cash'; // 'cash', 'online', 'wallet'
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _currentStep = widget.initialStep;

    // Default mock addresses matching web application
    _savedAddresses = [
      CustomerAddress(
        id: 'addr_1',
        label: 'Home',
        house: 'Flat 402, Sri Sai Nilayam',
        street: 'Ayyappa Society, Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        isDefault: true,
      ),
      CustomerAddress(
        id: 'addr_2',
        label: 'Office',
        house: 'Plot 12, Floor 3, Cyber Towers',
        street: 'Hitech City Main Rd',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
      ),
    ];
    _selectedAddress = _savedAddresses.first;

    // Initialize bookable dates starting today
    final now = DateTime.now();
    _bookableDates = List.generate(7, (i) => DateTime(now.year, now.month, now.day + i));
    _selectedDate = _bookableDates.first;
  }

  @override
  void dispose() {
    _mapSearchController.dispose();
    _houseController.dispose();
    _landmarkController.dispose();
    _cityController.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  int get _itemTotal => (widget.service.price * _quantity).toInt();
  int get _gstAmount => (_itemTotal * 0.18).round();
  int get _platformFee => 29;
  int get _grandTotal => _itemTotal + _gstAmount + _platformFee;

  IconData _getCategoryIcon() {
    final s = widget.service.slug.toLowerCase();
    final n = widget.service.name.toLowerCase();
    if (s.contains('salon') || s.contains('spa') || n.contains('hair') || n.contains('massage')) {
      return Icons.content_cut_rounded;
    }
    if (s.contains('clean') || n.contains('clean')) {
      return Icons.auto_awesome_rounded;
    }
    if (s.contains('ac-') || s.contains('repair') || n.contains('appliance')) {
      return Icons.handyman_rounded;
    }
    if (s.contains('paint')) return Icons.format_paint_rounded;
    if (s.contains('plumb')) return Icons.water_drop_rounded;
    if (s.contains('electr')) return Icons.bolt_rounded;
    return Icons.home_repair_service_rounded;
  }

  String _getCategoryName() {
    final s = widget.service.slug.toLowerCase();
    final n = widget.service.name.toLowerCase();
    if (s.contains('salon') || s.contains('spa') || n.contains('hair') || n.contains('massage')) {
      return 'Salon & Spa';
    }
    if (s.contains('clean') || n.contains('clean')) return 'Home Cleaning';
    if (s.contains('ac-') || s.contains('repair') || n.contains('appliance')) return 'Appliance Repair';
    if (s.contains('paint')) return 'Painting & Waterproofing';
    if (s.contains('plumb')) return 'Plumbing';
    if (s.contains('electr')) return 'Electrical';
    return 'Home Service';
  }

  void _handleBack() {
    if (_currentStep > 1) {
      setState(() => _currentStep--);
    } else {
      Navigator.of(context).pop();
    }
  }

  void _handleNext() {
    if (_currentStep == 2 && _selectedAddress == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select or add a service address.'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_currentStep < 4) {
      setState(() => _currentStep++);
    } else {
      _confirmBooking();
    }
  }

  Future<void> _confirmBooking() async {
    setState(() => _isSubmitting = true);

    final bookingProvider = context.read<BookingProvider>();
    final addressText = _selectedAddress != null
        ? '${_selectedAddress!.house}, ${_selectedAddress!.street ?? ''}, ${_selectedAddress!.city} - ${_selectedAddress!.pincode}'
        : 'Flat 402, Sri Sai Nilayam, Madhapur, Hyderabad - 500081';

    try {
      await bookingProvider.createBooking(
        items: [
          {
            'serviceId': widget.service.id,
            'name': widget.service.name,
            'price': widget.service.price,
            'quantity': _quantity,
          }
        ],
        address: addressText,
        scheduledDate: _selectedDate,
        totalAmount: _grandTotal.toDouble(),
      );
    } catch (_) {}

    if (mounted) {
      setState(() => _isSubmitting = false);
      _showBookingSuccessModal();
    }
  }

  void _showBookingSuccessModal() {
    final bookingId = 'BK-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (modalCtx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // Celebratory Icon
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFA7F3D0), width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF059669).withValues(alpha: 0.15),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 36),
                ),
              ),
              const SizedBox(height: 18),

              const Text(
                'Booking Confirmed!',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E1B2E),
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 6),

              Text(
                'Booking ID: #$bookingId',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF4F46E5),
                ),
              ),
              const SizedBox(height: 12),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.home_repair_service_rounded, size: 16, color: Color(0xFF4F46E5)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            widget.service.name,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E1B2E)),
                          ),
                        ),
                        Text('Qty: $_quantity', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      ],
                    ),
                    const Divider(height: 18, color: Color(0xFFE2E8F0)),
                    Row(
                      children: [
                        const Icon(Icons.access_time_rounded, size: 16, color: Color(0xFF4F46E5)),
                        const SizedBox(width: 8),
                        Text(
                          '${_formatDate(_selectedDate)} • $_selectedSlot',
                          style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: Color(0xFF4F46E5)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _selectedAddress?.formattedAddress ?? 'Home Address',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4338CA),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  ),
                  onPressed: () {
                    Navigator.pop(modalCtx);
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const ActiveBookingsScreen()),
                    );
                  },
                  child: const Text('Track Booking', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
              ),
              const SizedBox(height: 10),

              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(modalCtx);
                    Navigator.of(context).popUntil((r) => r.isFirst);
                  },
                  child: const Text('Back to Home', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[date.weekday - 1]}, ${date.day} ${months[date.month - 1]}';
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
          onPressed: _handleBack,
        ),
        titleSpacing: 0,
        title: const Text(
          'Book Service',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 1. Service Pill Banner
                    _buildServicePillBanner(),
                    const SizedBox(height: 12),

                    // 2. Stepper Card (Matches Screenshot 2 & 3)
                    _buildStepperCard(),
                    const SizedBox(height: 14),

                    // 3. Step Content
                    if (_currentStep == 1) _buildStep1ServiceDetails(),
                    if (_currentStep == 2) _buildStep2AddressDetails(),
                    if (_currentStep == 3) _buildStep3ScheduleDetails(),
                    if (_currentStep == 4) _buildStep4ReviewAndPay(),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),

            // 4. Sticky Bottom Bar
            _buildStickyBottomBar(),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 1. SERVICE PILL BANNER
  // --------------------------------------------------------------------------
  Widget _buildServicePillBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F5FD),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E6FA), width: 1),
      ),
      child: Row(
        children: [
          Icon(_getCategoryIcon(), size: 18, color: const Color(0xFF4F46E5)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              widget.service.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
          ),
          if (_currentStep >= 2) ...[
            Text(
              'Step $_currentStep of 4',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF4F46E5),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 2. STEPPER CARD (Matches Screenshot 2 & 3)
  // --------------------------------------------------------------------------
  Widget _buildStepperCard() {
    String stepTitle = 'Service Details';
    String nextTitle = 'Address';

    if (_currentStep == 2) {
      stepTitle = 'Address Details';
      nextTitle = 'Schedule';
    } else if (_currentStep == 3) {
      stepTitle = 'Date & Time';
      nextTitle = 'Review & Pay';
    } else if (_currentStep == 4) {
      stepTitle = 'Review & Pay';
      nextTitle = 'Confirm';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_currentStep != 2)
                    Text(
                      'Step $_currentStep of 4',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF4F46E5),
                      ),
                    ),
                  Text(
                    stepTitle,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              ),
              if (_currentStep < 4)
                Text(
                  'Next: $nextTitle',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // 4-Segment Progress Bar matching reference
          Row(
            children: List.generate(4, (index) {
              final isDoneOrCurrent = index < _currentStep;
              return Expanded(
                child: Container(
                  height: 6,
                  margin: EdgeInsets.only(right: index < 3 ? 6 : 0),
                  decoration: BoxDecoration(
                    color: isDoneOrCurrent ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STEP 1: SERVICE DETAILS (Matches Screenshot 2)
  // --------------------------------------------------------------------------
  Widget _buildStep1ServiceDetails() {
    final s = widget.service;
    final imgAsset = ServiceImageResolver.resolve(s.slug, s.name);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row with Sparkles icon
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Icon(Icons.auto_awesome_rounded, color: Color(0xFF4F46E5), size: 18),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'What do you need done?',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Set the quantity and pick any extras for this visit.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Service Box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.asset(
                    imgAsset,
                    width: 52,
                    height: 52,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 52,
                      height: 52,
                      color: const Color(0xFFEEF2FF),
                      child: const Icon(Icons.spa_rounded, color: Color(0xFF4F46E5)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _getCategoryName(),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        s.name,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '₹${s.price.toInt()} per unit • ⏱ ${s.durationMinutes} min',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Quantity Stepper Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No. of Persons',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Units to be serviced (up to 10)',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove_rounded, size: 16),
                      onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                      color: const Color(0xFF1E1B2E),
                      disabledColor: const Color(0xFFCBD5E1),
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                    Text(
                      '$_quantity',
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_rounded, size: 16),
                      onPressed: _quantity < 10 ? () => setState(() => _quantity++) : null,
                      color: const Color(0xFF1E1B2E),
                      disabledColor: const Color(0xFFCBD5E1),
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STEP 2: ADDRESS DETAILS (Matches Screenshot 3)
  // --------------------------------------------------------------------------
  Widget _buildStep2AddressDetails() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row with Pin icon
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Icon(Icons.location_on_outlined, color: Color(0xFF4F46E5), size: 18),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Choose Service Address',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Choose where you\'d like the service performed.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Saved Addresses Selector
          ..._savedAddresses.map((addr) {
            final isSelected = _selectedAddress?.id == addr.id && !_isAddingNewAddress;
            return GestureDetector(
              onTap: () {
                setState(() {
                  _selectedAddress = addr;
                  _isAddingNewAddress = false;
                });
              },
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFF5F3FF) : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                      color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                addr.label,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                              if (addr.isDefault) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEEF2FF),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text('DEFAULT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5))),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            addr.formattedAddress,
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 6),
          const Divider(color: Color(0xFFE2E8F0)),
          const SizedBox(height: 10),

          // Add a new address trigger / Map Card
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Add a new address',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              if (!_isAddingNewAddress)
                TextButton(
                  onPressed: () => setState(() => _isAddingNewAddress = true),
                  child: const Text('+ New Address', style: TextStyle(color: Color(0xFF4F46E5), fontSize: 12, fontWeight: FontWeight.bold)),
                ),
            ],
          ),

          if (_isAddingNewAddress) ...[
            const SizedBox(height: 8),
            // Map Preview Box matching Screenshot 3
            Container(
              height: 180,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                color: const Color(0xFFF1F5F9),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                children: [
                  // Stylized Map Illustration Background
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _MapCanvasPainter(),
                    ),
                  ),

                  // Search Box overlay
                  Positioned(
                    top: 12,
                    left: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.search, size: 16, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: TextField(
                              controller: _mapSearchController,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF1E1B2E)),
                              decoration: const InputDecoration(
                                hintText: 'Search for area, street or landmark...',
                                hintStyle: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Center Pin Icon
                  const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.location_on_rounded, size: 38, color: Color(0xFF4F46E5)),
                        SizedBox(height: 4),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Address Input Fields
            TextField(
              controller: _houseController,
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                labelText: 'House / Flat / Building No.',
                labelStyle: const TextStyle(fontSize: 12),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),

            TextField(
              controller: _landmarkController,
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Street / Landmark',
                labelStyle: const TextStyle(fontSize: 12),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 14),

            // Action Buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => setState(() => _isAddingNewAddress = false),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4338CA),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    final house = _houseController.text.trim();
                    final street = _landmarkController.text.trim();
                    if (house.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter flat/house number')),
                      );
                      return;
                    }
                    final newAddr = CustomerAddress(
                      id: 'addr_${DateTime.now().millisecondsSinceEpoch}',
                      label: 'New Address',
                      house: house,
                      street: street.isNotEmpty ? street : 'Hyderabad',
                      city: _cityController.text.trim(),
                      state: 'Telangana',
                      pincode: _pincodeController.text.trim(),
                    );
                    setState(() {
                      _savedAddresses.add(newAddr);
                      _selectedAddress = newAddr;
                      _isAddingNewAddress = false;
                      _houseController.clear();
                      _landmarkController.clear();
                    });
                  },
                  child: const Text('Save & select', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STEP 3: SCHEDULE / DATE & TIME
  // --------------------------------------------------------------------------
  Widget _buildStep3ScheduleDetails() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Icon(Icons.calendar_today_rounded, color: Color(0xFF4F46E5), size: 18),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Select Date & Time',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Choose when you want the service done.',
                      style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Horizontal Date Scroller
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: _bookableDates.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) {
                final d = _bookableDates[i];
                final isSelected = d.day == _selectedDate.day && d.month == _selectedDate.month;
                final isToday = i == 0;
                final isTomorrow = i == 1;

                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                String label = isToday ? 'Today' : (isTomorrow ? 'Tomorrow' : days[d.weekday - 1]);

                return GestureDetector(
                  onTap: () => setState(() => _selectedDate = d),
                  child: Container(
                    width: 76,
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? Colors.white70 : const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${d.day} ${months[d.month - 1]}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                            color: isSelected ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 22),

          const Text(
            'Select Time Slot',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 10),

          // Time Slots Grid
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              '09:00 AM - 10:00 AM',
              '10:30 AM - 11:30 AM',
              '01:00 PM - 02:00 PM',
              '02:30 PM - 03:30 PM',
              '04:00 PM - 05:00 PM',
              '06:00 PM - 07:00 PM',
            ].map((slot) {
              final isSelected = _selectedSlot == slot;
              return GestureDetector(
                onTap: () => setState(() => _selectedSlot = slot),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFF5F3FF) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Text(
                    slot,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF1E1B2E),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STEP 4: REVIEW & PAY
  // --------------------------------------------------------------------------
  Widget _buildStep4ReviewAndPay() {
    return Column(
      children: [
        // Booking Summary Card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Booking Summary', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              const SizedBox(height: 14),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(widget.service.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                  Text('Qty: $_quantity', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5)),
                ],
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, size: 14, color: Color(0xFF64748B)),
                  const SizedBox(width: 6),
                  Text('${_formatDate(_selectedDate)} • $_selectedSlot', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
              const SizedBox(height: 6),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF64748B)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(_selectedAddress?.formattedAddress ?? 'Selected Address', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)), maxLines: 2),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Payment Method Card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Payment Method', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              const SizedBox(height: 12),

              _buildPaymentOption('cash', 'Cash on Service', 'Pay after completion via cash or UPI', Icons.payments_outlined),
              _buildPaymentOption('online', 'Online Payment / UPI', 'Instant payment with Cards or QR', Icons.qr_code_rounded),
              _buildPaymentOption('wallet', 'HomeCareX Wallet', 'Available balance: ₹1,500', Icons.account_balance_wallet_outlined),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Price Breakdown Card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Bill Details', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              const SizedBox(height: 12),

              _buildBillRow('Item Total', '₹$_itemTotal'),
              _buildBillRow('Taxes & GST (18%)', '₹$_gstAmount'),
              _buildBillRow('Platform Safety Fee', '₹$_platformFee'),
              const Divider(height: 20, color: Color(0xFFE2E8F0)),
              _buildBillRow('Grand Total', '₹$_grandTotal', isTotal: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentOption(String id, String title, String subtitle, IconData icon) {
    final isSelected = _paymentMethod == id;
    return GestureDetector(
      onTap: () => setState(() => _paymentMethod = id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF5F3FF) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8), size: 18),
            const SizedBox(width: 10),
            Icon(icon, color: const Color(0xFF4F46E5), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBillRow(String label, String value, {bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 14.5 : 12.5,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
              color: isTotal ? const Color(0xFF0F172A) : const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isTotal ? 16 : 13,
              fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
              color: isTotal ? const Color(0xFF4F46E5) : const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STICKY BOTTOM BAR (Matches Screenshot 2 & 3)
  // --------------------------------------------------------------------------
  Widget _buildStickyBottomBar() {
    final estimatePrice = _currentStep == 4 ? _grandTotal : _itemTotal;
    final buttonLabel = _currentStep == 4 ? 'Confirm Booking ✓' : 'Next Step →';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _currentStep == 4 ? 'Total Amount' : 'Running Estimate',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '₹$estimatePrice',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),

          ElevatedButton(
            onPressed: _isSubmitting ? null : _handleNext,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4338CA),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              elevation: 0,
            ),
            child: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : Text(
                    buttonLabel,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

// Custom Painter for Map preview background on Step 2
class _MapCanvasPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFFF1F5F9);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    final roadPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke;

    final primaryRoadPaint = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 10
      ..style = PaintingStyle.stroke;

    // Draw stylized roads
    canvas.drawLine(Offset(0, size.height * 0.35), Offset(size.width, size.height * 0.4), primaryRoadPaint);
    canvas.drawLine(Offset(0, size.height * 0.75), Offset(size.width, size.height * 0.7), roadPaint);
    canvas.drawLine(Offset(size.width * 0.3, 0), Offset(size.width * 0.35, size.height), roadPaint);
    canvas.drawLine(Offset(size.width * 0.65, 0), Offset(size.width * 0.6, size.height), primaryRoadPaint);

    // Green park blob
    final parkPaint = Paint()..color = const Color(0xFFDCFCE7);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.08, size.height * 0.45, 70, 45), const Radius.circular(12)),
      parkPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

