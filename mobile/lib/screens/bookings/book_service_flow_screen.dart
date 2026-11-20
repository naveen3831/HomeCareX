import 'package:flutter/gestures.dart';
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
  final bool initialAddingNewAddress;

  const BookServiceFlowScreen({
    super.key,
    required this.service,
    this.initialStep = 1,
    this.initialAddingNewAddress = true,
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
  late bool _isAddingNewAddress;
  String _locationTitle = 'HITEC City';
  String _locationAddress =
      'HITEC City - Kondapur Main Road, HITEC City, Ward 107 Madhapur, Greater Hyderabad Municipal Corporation, Telangana, 500081, India';
  String _selectedLabel = 'Home'; // 'Home', 'Work', 'Other'

  // Real-time interactive map state
  Offset _mapPanOffset = Offset.zero;
  double _mapZoom = 1.0;
  double _startZoom = 1.0;
  bool _isDraggingMap = false;

  final TextEditingController _mapSearchController = TextEditingController();
  final TextEditingController _houseController = TextEditingController();
  final TextEditingController _streetController = TextEditingController(text: 'Deepthisree Nagar');
  final TextEditingController _areaController = TextEditingController(text: 'Deepthisree Nagar');
  final TextEditingController _landmarkController = TextEditingController();
  final TextEditingController _cityController = TextEditingController(text: 'Hyderabad');
  final TextEditingController _stateController = TextEditingController(text: 'Telangana');
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
    _isAddingNewAddress = widget.initialAddingNewAddress;

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
    _streetController.dispose();
    _areaController.dispose();
    _landmarkController.dispose();
    _cityController.dispose();
    _stateController.dispose();
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
    if (_currentStep == 2 && _isAddingNewAddress && _savedAddresses.isNotEmpty) {
      setState(() => _isAddingNewAddress = false);
      return;
    }
    if (_currentStep > 1) {
      setState(() => _currentStep--);
    } else {
      Navigator.of(context).pop();
    }
  }

  void _zoomIn() {
    setState(() {
      _mapZoom = (_mapZoom + 0.25).clamp(0.6, 3.5);
    });
  }

  void _zoomOut() {
    setState(() {
      _mapZoom = (_mapZoom - 0.25).clamp(0.6, 3.5);
    });
  }

  void _updateLocationFromPanOffset() {
    final dx = _mapPanOffset.dx;
    final dy = _mapPanOffset.dy;

    if (dx < -120) {
      _locationTitle = 'Deepthisree Nagar';
      _locationAddress = 'Deepthisree Nagar, Madinaguda, Miyapur, Hyderabad, Telangana, 500049, India';
      _streetController.text = 'Deepthisree Nagar';
      _areaController.text = 'Madinaguda';
      _pincodeController.text = '500049';
    } else if (dx < -40 && dy < 20) {
      _locationTitle = 'Kondapur';
      _locationAddress = 'Raghavendra Colony, Kondapur Main Road, Hyderabad, Telangana, 500084, India';
      _streetController.text = 'Raghavendra Colony, Kondapur Main Road';
      _areaController.text = 'Kondapur';
      _pincodeController.text = '500084';
    } else if (dx > 40 && dy < -20) {
      _locationTitle = 'Jubilee Hills';
      _locationAddress = 'Road No. 36, Jubilee Hills, Hyderabad, Telangana, 500033, India';
      _streetController.text = 'Road No. 36';
      _areaController.text = 'Jubilee Hills';
      _pincodeController.text = '500033';
    } else if (dx > 40) {
      _locationTitle = 'Madhapur';
      _locationAddress = 'Near Ayyappa Society, 100 Feet Road, Madhapur, Hyderabad, Telangana, 500081, India';
      _streetController.text = '100 Feet Road, Madhapur';
      _areaController.text = 'Madhapur';
      _pincodeController.text = '500081';
    } else if (dy > 40 && dx < -30) {
      _locationTitle = 'Financial District';
      _locationAddress = 'ISB Road, Financial District, Nanakramguda, Hyderabad, Telangana, 500032, India';
      _streetController.text = 'ISB Road';
      _areaController.text = 'Financial District';
      _pincodeController.text = '500032';
    } else if (dy > 40) {
      _locationTitle = 'Gachibowli';
      _locationAddress = 'DLF Cyber City, Gachibowli, Hyderabad, Telangana, 500032, India';
      _streetController.text = 'DLF Cyber City';
      _areaController.text = 'Gachibowli';
      _pincodeController.text = '500032';
    } else {
      _locationTitle = 'HITEC City';
      _locationAddress = 'HITEC City - Kondapur Main Road, HITEC City, Ward 107 Madhapur, Greater Hyderabad Municipal Corporation, Telangana, 500081, India';
      _streetController.text = 'HITEC City - Kondapur Main Road';
      _areaController.text = 'HITEC City';
      _pincodeController.text = '500081';
    }
  }

  void _finalizeLocationFromPanOffset() {
    _updateLocationFromPanOffset();
  }

  void _onSearchLocationChanged(String query) {
    final q = query.trim().toLowerCase();
    setState(() {
      if (q.contains('madhapur')) {
        _locationTitle = 'Madhapur';
        _locationAddress = 'Near Ayyappa Society, 100 Feet Road, Madhapur, Hyderabad, Telangana, 500081, India';
        _streetController.text = '100 Feet Road, Madhapur';
        _areaController.text = 'Madhapur';
        _cityController.text = 'Hyderabad';
        _stateController.text = 'Telangana';
        _pincodeController.text = '500081';
        _mapPanOffset = const Offset(80, 0);
      } else if (q.contains('kondapur')) {
        _locationTitle = 'Kondapur';
        _locationAddress = 'Raghavendra Colony, Kondapur Main Road, Hyderabad, Telangana, 500084, India';
        _streetController.text = 'Raghavendra Colony, Kondapur Main Road';
        _areaController.text = 'Kondapur';
        _cityController.text = 'Hyderabad';
        _stateController.text = 'Telangana';
        _pincodeController.text = '500084';
        _mapPanOffset = const Offset(-80, -20);
      } else if (q.contains('gachibowli')) {
        _locationTitle = 'Gachibowli';
        _locationAddress = 'DLF Cyber City, Gachibowli, Hyderabad, Telangana, 500032, India';
        _streetController.text = 'DLF Cyber City';
        _areaController.text = 'Gachibowli';
        _cityController.text = 'Hyderabad';
        _stateController.text = 'Telangana';
        _pincodeController.text = '500032';
        _mapPanOffset = const Offset(0, 80);
      } else if (q.contains('jubilee')) {
        _locationTitle = 'Jubilee Hills';
        _locationAddress = 'Road No. 36, Jubilee Hills, Hyderabad, Telangana, 500033, India';
        _streetController.text = 'Road No. 36';
        _areaController.text = 'Jubilee Hills';
        _cityController.text = 'Hyderabad';
        _stateController.text = 'Telangana';
        _pincodeController.text = '500033';
        _mapPanOffset = const Offset(80, -60);
      } else if (q.isNotEmpty) {
        _locationTitle = query.trim();
        _locationAddress = '$query, Ward 107 Madhapur, Greater Hyderabad Municipal Corporation, Telangana, 500081, India';
        _streetController.text = query.trim();
        _areaController.text = query.trim();
      } else {
        _locationTitle = 'HITEC City';
        _locationAddress = 'HITEC City - Kondapur Main Road, HITEC City, Ward 107 Madhapur, Greater Hyderabad Municipal Corporation, Telangana, 500081, India';
        _streetController.text = 'Deepthisree Nagar';
        _areaController.text = 'Deepthisree Nagar';
        _cityController.text = 'Hyderabad';
        _stateController.text = 'Telangana';
        _pincodeController.text = '500081';
        _mapPanOffset = Offset.zero;
      }
    });
  }

  void _resetToCurrentLocation() {
    _mapSearchController.clear();
    setState(() {
      _mapPanOffset = Offset.zero;
      _mapZoom = 1.0;
      _locationTitle = 'HITEC City';
      _locationAddress =
          'HITEC City - Kondapur Main Road, HITEC City, Ward 107 Madhapur, Greater Hyderabad Municipal Corporation, Telangana, 500081, India';
      _streetController.text = 'Deepthisree Nagar';
      _areaController.text = 'Deepthisree Nagar';
      _cityController.text = 'Hyderabad';
      _stateController.text = 'Telangana';
      _pincodeController.text = '500081';
    });
  }

  void _saveAndSelectCurrentLocation() {
    final house = _houseController.text.trim().isNotEmpty
        ? _houseController.text.trim()
        : 'Flat 302, Manjeera Trinity';
    final area = _areaController.text.trim();
    final baseStreet = _streetController.text.trim().isNotEmpty
        ? _streetController.text.trim()
        : _locationTitle;
    final street = area.isNotEmpty && !baseStreet.contains(area)
        ? '$baseStreet, $area'
        : baseStreet;
    final landmark = _landmarkController.text.trim();
    final city = _cityController.text.trim().isNotEmpty ? _cityController.text.trim() : 'Hyderabad';
    final state = _stateController.text.trim().isNotEmpty ? _stateController.text.trim() : 'Telangana';
    final pincode = _pincodeController.text.trim().isNotEmpty ? _pincodeController.text.trim() : '500081';

    final newAddress = CustomerAddress(
      id: 'addr_${DateTime.now().millisecondsSinceEpoch}',
      label: _selectedLabel,
      house: house,
      street: street,
      landmark: landmark.isNotEmpty ? landmark : null,
      city: city,
      state: state,
      pincode: pincode,
      isDefault: true,
    );

    setState(() {
      _savedAddresses.insert(0, newAddress);
      _selectedAddress = newAddress;
      _isAddingNewAddress = false;
      _currentStep = 3;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Selected $_selectedLabel ($street) for service delivery'),
        backgroundColor: const Color(0xFF059669),
        behavior: SnackBarBehavior.floating,
      ),
    );
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

    String? createdBookingId;
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
      if (bookingProvider.bookings.isNotEmpty) {
        createdBookingId = bookingProvider.bookings.first.id;
      }
    } catch (_) {}

    if (mounted) {
      setState(() => _isSubmitting = false);
      _showBookingSuccessModal(createdBookingId);
    }
  }

  void _showBookingSuccessModal([String? confirmedId]) {
    final bookingId = confirmedId ?? 'BK-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';

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

                    // 2. Stepper Card
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
  // STEP 2: ADDRESS DETAILS
  // --------------------------------------------------------------------------
  Widget _buildStep2AddressDetails() {
    if (_isAddingNewAddress) {
      return _buildAddNewAddressView();
    }
    return _buildSavedAddressListView();
  }

  // View 1: Add a New Address with Interactive Map Picker (Matches User Screenshot)
  Widget _buildAddNewAddressView() {
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
          // 1. Header Row with Pin icon matching web screenshot
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
          const SizedBox(height: 14),

          // 2. Section Heading: "Add a new address" + optional "Saved addresses"
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Add a new address',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.2,
                ),
              ),
              if (_savedAddresses.isNotEmpty)
                TextButton.icon(
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    visualDensity: VisualDensity.compact,
                  ),
                  onPressed: () => setState(() => _isAddingNewAddress = false),
                  icon: const Icon(Icons.arrow_back_rounded, size: 14, color: Color(0xFF4F46E5)),
                  label: const Text(
                    'Saved addresses',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF4F46E5),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),

          // 3. Map Section Label
          const Text(
            'Pin your location',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),

          // 4. Map Container (height 200 matching mobile viewport with real-time pan & zoom)
          Container(
            height: 200,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              color: const Color(0xFFF2EFE9),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                // Stylized Interactive Real-Time Map Canvas with pan & scroll gestures
                Positioned.fill(
                  child: Listener(
                    onPointerSignal: (pointerSignal) {
                      if (pointerSignal is PointerScrollEvent) {
                        if (pointerSignal.scrollDelta.dy < 0) {
                          _zoomIn();
                        } else if (pointerSignal.scrollDelta.dy > 0) {
                          _zoomOut();
                        }
                      }
                    },
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onScaleStart: (details) {
                        _startZoom = _mapZoom;
                        setState(() {
                          _isDraggingMap = true;
                        });
                      },
                      onScaleUpdate: (details) {
                        setState(() {
                          _mapPanOffset += details.focalPointDelta;
                          if (details.scale != 1.0) {
                            _mapZoom = (_startZoom * details.scale).clamp(0.6, 3.5);
                          }
                          _updateLocationFromPanOffset();
                        });
                      },
                      onScaleEnd: (details) {
                        setState(() {
                          _isDraggingMap = false;
                          _finalizeLocationFromPanOffset();
                        });
                      },
                      onDoubleTap: _zoomIn,
                      child: CustomPaint(
                        painter: _MapCanvasPainter(
                          panOffset: _mapPanOffset,
                          zoom: _mapZoom,
                        ),
                      ),
                    ),
                  ),
                ),

                // Top Search Bar Overlay
                Positioned(
                  top: 8,
                  left: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.search_rounded, size: 16, color: Color(0xFF64748B)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: TextField(
                            controller: _mapSearchController,
                            onChanged: _onSearchLocationChanged,
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF1E1B2E)),
                            decoration: const InputDecoration(
                              hintText: 'Search for area, street or landmark...',
                              hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        ),
                        if (_mapSearchController.text.isNotEmpty)
                          GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: _resetToCurrentLocation,
                            child: const Icon(Icons.close_rounded, size: 14, color: Color(0xFF94A3B8)),
                          ),
                      ],
                    ),
                  ),
                ),

                // Center Teardrop Pin Marker with Lift Animation on Drag
                Center(
                  child: IgnorePointer(
                    child: _MapCenterPin(isDragging: _isDraggingMap),
                  ),
                ),

                // Zoom Controls (+ and - buttons)
                Positioned(
                  bottom: 46,
                  right: 8,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.12),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _zoomIn,
                          child: Container(
                            width: 28,
                            height: 28,
                            alignment: Alignment.center,
                            child: const Icon(Icons.add_rounded, size: 16, color: Color(0xFF1E293B)),
                          ),
                        ),
                        Container(width: 18, height: 1, color: const Color(0xFFE2E8F0)),
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _zoomOut,
                          child: Container(
                            width: 28,
                            height: 28,
                            alignment: Alignment.center,
                            child: const Icon(Icons.remove_rounded, size: 16, color: Color(0xFF1E293B)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Bottom-Right Crosshair / Locate Me Button
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _resetToCurrentLocation,
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.my_location_rounded,
                          size: 15,
                          color: Color(0xFF4F46E5),
                        ),
                      ),
                    ),
                  ),
                ),

                // Bottom-Left OSM Attribution
                Positioned(
                  bottom: 0,
                  left: 0,
                  child: IgnorePointer(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.85),
                        borderRadius: const BorderRadius.only(topRight: Radius.circular(5)),
                      ),
                      child: const Text(
                        '© OpenStreetMap contributors',
                        style: TextStyle(
                          fontSize: 8.5,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Service Location Container matching web
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(Icons.location_on_outlined, color: Color(0xFF4F46E5), size: 18),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'SERVICE LOCATION',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _locationTitle,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _locationAddress,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF64748B),
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Helper Text matching screenshot
          const Text(
            'Drag the map or search. We\'ll fill in the details below. You can still edit them.',
            style: TextStyle(
              fontSize: 11,
              color: Color(0xFF64748B),
              height: 1.35,
            ),
          ),
          const SizedBox(height: 16),

          // 1. Save as Selector matching screenshot
          _buildSaveAsSelector(),
          const SizedBox(height: 14),

          // 2. House / flat no.
          _buildAddressField(
            label: 'House / flat no.',
            controller: _houseController,
            hintText: 'Flat 302, Manjeera Trinity',
          ),
          const SizedBox(height: 14),

          // 3. Street / road
          _buildAddressField(
            label: 'Street / road',
            controller: _streetController,
          ),
          const SizedBox(height: 14),

          // 4. Area / locality (optional)
          _buildAddressField(
            label: 'Area / locality (optional)',
            controller: _areaController,
          ),
          const SizedBox(height: 14),

          // 5. Landmark (optional)
          _buildAddressField(
            label: 'Landmark (optional)',
            controller: _landmarkController,
            hintText: 'e.g. Near Metro Station',
          ),
          const SizedBox(height: 14),

          // 6. City
          _buildAddressField(
            label: 'City',
            controller: _cityController,
          ),
          const SizedBox(height: 14),

          // 7. State
          _buildAddressField(
            label: 'State',
            controller: _stateController,
          ),
          const SizedBox(height: 14),

          // 8. Pincode & Serviceability Status
          _buildAddressField(
            label: 'Pincode',
            controller: _pincodeController,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF059669)),
                SizedBox(width: 6),
                Text(
                  'We serve Hyderabad',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF059669),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Action Buttons: Cancel on left, Save & select on right matching screenshot
          Row(
            children: [
              Expanded(
                flex: 2,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0F172A),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onPressed: () {
                    if (_savedAddresses.isNotEmpty) {
                      setState(() => _isAddingNewAddress = false);
                    } else {
                      _handleBack();
                    }
                  },
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 3,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4F46E5),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                  ),
                  onPressed: _saveAndSelectCurrentLocation,
                  child: const Text(
                    'Save & select',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Address Form Helpers
  // --------------------------------------------------------------------------
  Widget _buildSaveAsSelector() {
    final options = [
      {'label': 'Home', 'icon': Icons.home_outlined},
      {'label': 'Work', 'icon': Icons.business_center_outlined},
      {'label': 'Other', 'icon': Icons.location_on_outlined},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Save as',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: options.map((opt) {
            final label = opt['label'] as String;
            final icon = opt['icon'] as IconData;
            final isSelected = _selectedLabel == label;

            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _selectedLabel = label),
                child: Container(
                  margin: EdgeInsets.only(right: opt != options.last ? 8 : 0),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        icon,
                        size: 16,
                        color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF64748B),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildAddressField({
    required String label,
    required TextEditingController controller,
    String? hintText,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Color(0xFF1E293B),
            ),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: const TextStyle(
                fontSize: 12.5,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.normal,
              ),
              border: InputBorder.none,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
      ],
    );
  }

  // View 2: List of Saved Addresses
  Widget _buildSavedAddressListView() {
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

          // Add a new address trigger banner
          GestureDetector(
            onTap: () => setState(() => _isAddingNewAddress = true),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F8FE),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFC7D2FE), style: BorderStyle.solid),
              ),
              child: const Row(
                children: [
                  Icon(Icons.add_location_alt_outlined, color: Color(0xFF4F46E5), size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Add a new address',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          'Pin location on map or search landmark',
                          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: Color(0xFF4F46E5), size: 18),
                ],
              ),
            ),
          ),
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
    if (_currentStep == 2 && _isAddingNewAddress) {
      return const SizedBox.shrink();
    }

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

// Center Pin Marker with lift effect and ground shadow matching screenshot
class _MapCenterPin extends StatelessWidget {
  final bool isDragging;

  const _MapCenterPin({this.isDragging = false});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      transform: Matrix4.translationValues(0, isDragging ? -10 : 0, 0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isDragging) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Text(
                'Release to set location',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 4),
          ],
          CustomPaint(
            size: const Size(34, 44),
            painter: _TeardropPinPainter(),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: isDragging ? 8 : 12,
            height: isDragging ? 3 : 4,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: isDragging ? 0.15 : 0.22),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }
}

class _TeardropPinPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path();
    final w = size.width;
    final h = size.height;
    final radius = w / 2;

    path.moveTo(w / 2, h);
    path.cubicTo(w * 0.15, h * 0.65, 0, radius * 1.1, 0, radius);
    path.arcToPoint(
      Offset(w, radius),
      radius: Radius.circular(radius),
      clockwise: true,
    );
    path.cubicTo(w, radius * 1.1, w * 0.85, h * 0.65, w / 2, h);
    path.close();

    // Pin body fill (deep purple #4F46E5)
    final pinPaint = Paint()
      ..color = const Color(0xFF4F46E5)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, pinPaint);

    // Inner white circle dot
    final innerCirclePaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(w / 2, radius * 0.95), radius * 0.38, innerCirclePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// Custom Painter for Map preview background on Step 2 (OpenStreetMap style with real-time Pan & Zoom)
class _MapCanvasPainter extends CustomPainter {
  final Offset panOffset;
  final double zoom;

  _MapCanvasPainter({
    required this.panOffset,
    required this.zoom,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Clip to container bounds
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width, size.height));

    // 2. Base background
    final bgPaint = Paint()..color = const Color(0xFFF2EFE9);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    // 3. Apply Zoom and Pan around center
    final center = Offset(size.width / 2, size.height / 2);
    canvas.translate(center.dx, center.dy);
    canvas.scale(zoom);
    canvas.translate(-center.dx + panOffset.dx, -center.dy + panOffset.dy);

    // Extended bounding area for infinite feel
    final left = -size.width * 1.5;
    final top = -size.height * 1.5;
    final right = size.width * 2.5;
    final bottom = size.height * 2.5;

    // 4. Repeated city blocks
    final blockPaint = Paint()..color = const Color(0xFFFAF8F5);
    final parkPaint = Paint()..color = const Color(0xFFCCE6BC);
    final waterPaint = Paint()..color = const Color(0xFFAAD3DF);

    // Grid of blocks and parks
    for (double x = left; x < right; x += 140) {
      for (double y = top; y < bottom; y += 100) {
        final isPark = (x.toInt() * 7 + y.toInt() * 13).abs() % 7 == 0;
        final isWater = (x.toInt() * 3 + y.toInt() * 17).abs() % 11 == 0;

        if (isWater) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(Rect.fromLTWH(x + 10, y + 10, 110, 75), const Radius.circular(8)),
            waterPaint,
          );
        } else if (isPark) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(Rect.fromLTWH(x + 8, y + 8, 115, 80), const Radius.circular(10)),
            parkPaint,
          );
        } else {
          canvas.drawRRect(
            RRect.fromRectAndRadius(Rect.fromLTWH(x + 10, y + 10, 110, 75), const Radius.circular(6)),
            blockPaint,
          );
        }
      }
    }

    // 5. Minor Residential Grid Streets
    final minorStreetPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;

    for (double x = left; x < right; x += 140) {
      canvas.drawLine(Offset(x, top), Offset(x, bottom), minorStreetPaint);
    }
    for (double y = top; y < bottom; y += 100) {
      canvas.drawLine(Offset(left, y), Offset(right, y), minorStreetPaint);
    }

    // 6. Secondary Avenues (Border then fill)
    final avenueBorder = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 7
      ..style = PaintingStyle.stroke;
    final avenueFill = Paint()
      ..color = Colors.white
      ..strokeWidth = 5
      ..style = PaintingStyle.stroke;

    final avePath = Path();
    avePath.moveTo(left, size.height * 0.48);
    avePath.cubicTo(
      size.width * 0.3,
      size.height * 0.52,
      size.width * 0.6,
      size.height * 0.44,
      right,
      size.height * 0.5,
    );
    canvas.drawPath(avePath, avenueBorder);
    canvas.drawPath(avePath, avenueFill);

    // 7. Primary Highway (Yellow / Orange #FEF08A with #EAB308 border)
    final highwayBorder = Paint()
      ..color = const Color(0xFFEAB308)
      ..strokeWidth = 9
      ..style = PaintingStyle.stroke;
    final highwayFill = Paint()
      ..color = const Color(0xFFFEF08A)
      ..strokeWidth = 7
      ..style = PaintingStyle.stroke;

    final hwPath = Path();
    hwPath.moveTo(left, size.height * 0.32);
    hwPath.cubicTo(
      size.width * 0.35,
      size.height * 0.38,
      size.width * 0.65,
      size.height * 0.55,
      right,
      size.height * 0.42,
    );
    canvas.drawPath(hwPath, highwayBorder);
    canvas.drawPath(hwPath, highwayFill);

    // 8. Diagonal Arterial Road (connecting Kondapur & Madhapur)
    final arterialBorder = Paint()
      ..color = const Color(0xFF94A3B8)
      ..strokeWidth = 8
      ..style = PaintingStyle.stroke;
    final arterialFill = Paint()
      ..color = Colors.white
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke;

    final artPath = Path();
    artPath.moveTo(size.width * 0.35, top);
    artPath.cubicTo(
      size.width * 0.45,
      size.height * 0.45,
      size.width * 0.55,
      size.height * 0.65,
      size.width * 0.52,
      bottom,
    );
    canvas.drawPath(artPath, arterialBorder);
    canvas.drawPath(artPath, arterialFill);

    // 9. Area labels on map canvas
    _drawAreaLabel(canvas, 'Kondapur', Offset(size.width * 0.15, size.height * 0.25));
    _drawAreaLabel(canvas, 'HITEC City', Offset(size.width * 0.5, size.height * 0.5));
    _drawAreaLabel(canvas, 'Madhapur', Offset(size.width * 0.8, size.height * 0.65));
    _drawAreaLabel(canvas, 'Gachibowli', Offset(size.width * 0.45, size.height * 0.85));
    _drawAreaLabel(canvas, 'Jubilee Hills', Offset(size.width * 0.85, size.height * 0.2));

    canvas.restore();
  }

  void _drawAreaLabel(Canvas canvas, String text, Offset position) {
    final textSpan = TextSpan(
      text: text,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        color: Color(0xFF64748B),
        letterSpacing: 0.5,
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(position.dx - textPainter.width / 2, position.dy - textPainter.height / 2),
    );
  }

  @override
  bool shouldRepaint(covariant _MapCanvasPainter oldDelegate) {
    return oldDelegate.panOffset != panOffset || oldDelegate.zoom != zoom;
  }
}

