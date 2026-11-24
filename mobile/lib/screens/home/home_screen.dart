import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/booking_model.dart';
import '../../core/models/address_model.dart';
import '../../core/utils/bell_3d_icon.dart';
import '../../core/utils/service_image_resolver.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/booking_provider.dart';
import '../../providers/notification_provider.dart';
import '../../providers/address_provider.dart';
import '../catalog/categories_screen.dart';
import '../catalog/services_screen.dart';
import '../bookings/bookings_screen.dart';
import '../bookings/booking_tracking_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/saved_addresses_screen.dart';
import '../referrals/referrals_screen.dart';

class _CustomerHeroSlide {
  final String title;
  final String imagePath;
  final String slug;

  const _CustomerHeroSlide({
    required this.title,
    required this.imagePath,
    required this.slug,
  });
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _copiedCoupon = false;
  bool _isLocationPickerOpen = false;
  bool _isCityPickerOpen = false;
  String _selectedCity = 'Hyderabad';

  late final PageController _customerHeroPageController;
  late final TextEditingController _searchController;
  Timer? _customerHeroTimer;
  Timer? _typingTimer;
  Timer? _typingPauseTimer;
  int _customerHeroIndex = 0;
  String _animatedHint = 'Search AC repair|';
  int _phraseIndex = 0;
  int _charIndex = 0;
  bool _isTypingForward = true;

  static const List<_CustomerHeroSlide> _customerHeroSlides = [
    _CustomerHeroSlide(
      title: 'Appliance Repair & Service',
      imagePath: 'assets/images/quality-service.jpg',
      slug: 'appliance-repair-service',
    ),
    _CustomerHeroSlide(
      title: 'Home Cleaning',
      imagePath: 'assets/images/home-cleaning.jpg',
      slug: 'home-cleaning',
    ),
    _CustomerHeroSlide(
      title: 'Salon & Spa',
      imagePath: 'assets/images/Home-spa-women.webp',
      slug: 'salon-spa',
    ),
    _CustomerHeroSlide(
      title: 'Electrical & Plumbing',
      imagePath: 'assets/images/electrical.jpg',
      slug: 'electrical-plumbing',
    ),
    _CustomerHeroSlide(
      title: 'Painting & Waterproofing',
      imagePath: 'assets/images/painting-category.webp',
      slug: 'painting-waterproofing',
    ),
    _CustomerHeroSlide(
      title: 'Pest Control',
      imagePath: 'assets/images/pest-control-clean.webp',
      slug: 'pest-control',
    ),
  ];

  static const List<String> _typingPhrases = [
    'AC repair',
    'Deep home cleaning',
    'Painting',
    'Plumber near me',
    'Pest control',
    'Haircut at home',
  ];

  @override
  void initState() {
    super.initState();
    _customerHeroPageController = PageController();
    _searchController = TextEditingController();

    _customerHeroTimer = Timer.periodic(const Duration(milliseconds: 5000), (timer) {
      if (!mounted) return;
      if (_customerHeroPageController.hasClients) {
        final next = (_customerHeroIndex + 1) % _customerHeroSlides.length;
        _customerHeroPageController.animateToPage(
          next,
          duration: const Duration(milliseconds: 550),
          curve: Curves.easeInOutCubic,
        );
      }
    });

    _startTypingAnimation();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<BookingProvider>().fetchBookings();
        try {
          context.read<NotificationProvider>().fetchNotifications();
          context.read<AddressProvider>().fetchAddresses();
        } catch (_) {}
      }
    });
  }

  @override
  void dispose() {
    _customerHeroTimer?.cancel();
    _typingTimer?.cancel();
    _typingPauseTimer?.cancel();
    _customerHeroPageController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _startTypingAnimation() {
    _typingTimer?.cancel();
    _typingTimer = Timer.periodic(const Duration(milliseconds: 110), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_searchController.text.isNotEmpty) return;

      final currentPhrase = _typingPhrases[_phraseIndex];
      if (_isTypingForward) {
        if (_charIndex < currentPhrase.length) {
          _charIndex++;
          setState(() {
            _animatedHint = 'Search ${currentPhrase.substring(0, _charIndex)}|';
          });
        } else {
          _isTypingForward = false;
          _typingTimer?.cancel();
          _typingPauseTimer?.cancel();
          _typingPauseTimer = Timer(const Duration(milliseconds: 1600), () {
            if (mounted) _startTypingAnimation();
          });
        }
      } else {
        if (_charIndex > 0) {
          _charIndex--;
          setState(() {
            _animatedHint = 'Search ${currentPhrase.substring(0, _charIndex)}|';
          });
        } else {
          _isTypingForward = true;
          _phraseIndex = (_phraseIndex + 1) % _typingPhrases.length;
          _typingTimer?.cancel();
          _typingPauseTimer?.cancel();
          _typingPauseTimer = Timer(const Duration(milliseconds: 300), () {
            if (mounted) _startTypingAnimation();
          });
        }
      }
    });
  }

  String _greetingForNow() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  String _getUserFirstName(BuildContext context) {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final name = auth.user?.name.trim();
      if (name != null && name.isNotEmpty) {
        return name.split(' ').first.toUpperCase();
      }
    } catch (_) {}
    return 'TATUKULA';
  }


  void _submitSearch(String query) {
    String q = query.trim();
    if (q.isEmpty) {
      q = _typingPhrases[_phraseIndex];
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ServicesScreen(initialQuery: q),
      ),
    );
  }

  void _copyCouponCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    setState(() => _copiedCoupon = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Coupon code "$code" copied to clipboard!'),
        backgroundColor: const Color(0xFFFF8A3D),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copiedCoupon = false);
    });
  }

  Future<void> tryFetchNotifications(BuildContext context) async {
    try {
      await context.read<NotificationProvider>().fetchNotifications();
    } catch (_) {}
  }

  Future<void> tryFetchAddresses(BuildContext context) async {
    try {
      await context.read<AddressProvider>().fetchAddresses();
    } catch (_) {}
  }

  Widget _buildGuestHeader(BuildContext context) {
    return Container(
      color: const Color(0xFFFAFAFC),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // HomeCareX Brand Logo
          Image.asset(
            'assets/images/logo.png',
            height: 28,
            fit: BoxFit.contain,
            semanticLabel: 'HOMECAREX',
            errorBuilder: (_, __, ___) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFF9548), Color(0xFFFF7A1A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.home_rounded,
                      size: 20,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                RichText(
                  text: const TextSpan(
                    children: [
                      TextSpan(
                        text: 'HOMECARE',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      TextSpan(
                        text: 'X',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Location pill in center/right: 📍 Hyderabad ˇ
          GestureDetector(
            onTap: () {
              setState(() {
                _isCityPickerOpen = !_isCityPickerOpen;
              });
            },
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.location_on_rounded,
                    size: 14,
                    color: Color(0xFFEF4444),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _selectedCity,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF334155),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 16,
                    color: Color(0xFF64748B),
                  ),
                ],
              ),
            ),
          ),

          // Bell Icon (badge count: 0 for guest mode)
          NotificationBellButton(
            count: 0,
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

  Widget _buildCityPickerDropdown(BuildContext context) {
    const cities = [
      {'name': 'Hyderabad', 'state': 'Telangana'},
      {'name': 'Bengaluru', 'state': 'Karnataka'},
      {'name': 'Mumbai', 'state': 'Maharashtra'},
      {'name': 'Delhi NCR', 'state': 'Delhi'},
      {'name': 'Chennai', 'state': 'Tamil Nadu'},
      {'name': 'Pune', 'state': 'Maharashtra'},
    ];

    return Material(
      color: Colors.transparent,
      elevation: 10,
      shadowColor: Colors.black.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.location_city_rounded, size: 18, color: AppColors.brand),
                      SizedBox(width: 6),
                      Text(
                        'Select Service City',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _isCityPickerOpen = false),
                    child: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: cities.length,
              itemBuilder: (context, index) {
                final c = cities[index];
                final isSelected = c['name'] == _selectedCity;
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    setState(() {
                      _selectedCity = c['name']!;
                      _isCityPickerOpen = false;
                    });
                  },
                  child: Container(
                    color: isSelected ? const Color(0xFFEEF2FF) : Colors.transparent,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                              size: 16,
                              color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c['name']!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                    color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF1E293B),
                                  ),
                                ),
                                Text(
                                  c['state']!,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Available',
                            style: TextStyle(fontSize: 10, color: Color(0xFF10B981), fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopLocationHeader(
    BuildContext context, {
    CustomerAddress? selectedAddress,
    BookingModel? latestBooking,
    int activeCount = 0,
    int unreadNotificationsCount = 0,
    bool isPickerOpen = false,
    VoidCallback? onTogglePicker,
  }) {
    final badgeCount = unreadNotificationsCount;
    final label = selectedAddress != null
        ? selectedAddress.label
        : (latestBooking != null ? 'Home' : 'Add address');
    final addressLine = selectedAddress != null
        ? selectedAddress.fullAddressLine
        : (latestBooking != null && latestBooking.address.trim().isNotEmpty
            ? latestBooking.address
            : 'Select where we should...');

    return Container(
      color: const Color(0xFFFAFAFC),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Location Picker
          Expanded(
            child: GestureDetector(
              onTap: onTogglePicker,
              behavior: HitTestBehavior.opaque,
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
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
                        Row(
                          children: [
                            const Text(
                              'Deliver to ',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                            Text(
                              '• $label',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.brand,
                              ),
                            ),
                            const SizedBox(width: 2),
                            Icon(
                              isPickerOpen
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
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

          // 3D Clay Notification Bell with Red Badge matching web header (media_1795416363267_caff530d.png)
          NotificationBellButton(
            count: badgeCount,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const NotificationsScreen(),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAddressPickerDropdown(BuildContext context) {
    AddressProvider? addressProvider;
    try {
      addressProvider = context.watch<AddressProvider>();
    } catch (_) {}

    final addresses = addressProvider?.addresses ?? [];
    final current = addressProvider?.selectedAddress;

    return Material(
      color: Colors.transparent,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. + Add new address
            GestureDetector(
              onTap: () {
                setState(() => _isLocationPickerOpen = false);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const SavedAddressesScreen(),
                  ),
                );
              },
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: Color(0xFFF3F4F6), width: 1.5),
                  ),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.add_rounded, size: 20, color: AppColors.brand),
                    SizedBox(width: 8),
                    Text(
                      'Add new address',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.brand,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 2. Saved addresses title
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Text(
                'Saved addresses',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF6B7280),
                ),
              ),
            ),

            // 3. Saved addresses list
            if (addresses.isEmpty)
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Text(
                  'No saved addresses yet.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                ),
              )
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 260),
                child: ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: 8),
                  itemCount: addresses.length,
                  separatorBuilder: (_, __) => const Divider(
                    height: 1,
                    thickness: 1,
                    color: Color(0xFFF3F4F6),
                    indent: 48,
                    endIndent: 16,
                  ),
                  itemBuilder: (ctx, index) {
                    final addr = addresses[index];
                    final isSelected = addr.id == current?.id;
                    return GestureDetector(
                      onTap: () {
                        addressProvider?.selectAddress(addr.id);
                        setState(() => _isLocationPickerOpen = false);
                      },
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        color: isSelected ? const Color(0xFFF6F5FE) : Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              _iconForAddressLabel(addr.label),
                              size: 20,
                              color: isSelected ? AppColors.brand : const Color(0xFF111827),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    addr.label,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF111827),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    addr.fullAddressLine,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF6B7280),
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected) ...[
                              const SizedBox(width: 8),
                              const Icon(
                                Icons.check_rounded,
                                size: 18,
                                color: AppColors.brand,
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  IconData _iconForAddressLabel(String label) {
    final l = label.toLowerCase();
    if (l.contains('home')) return Icons.home_outlined;
    if (l.contains('office') || l.contains('work')) return Icons.work_outline_rounded;
    return Icons.location_on_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isAuthenticated = auth.isAuthenticated;
    final catalog = context.watch<CatalogProvider>();
    final bookingProvider = context.watch<BookingProvider>();
    final activeBookings = bookingProvider.activeBookings;
    final latestBooking = activeBookings.isNotEmpty ? activeBookings.first : null;

    int unreadNotifications = 0;
    try {
      final notifProvider = context.watch<NotificationProvider>();
      unreadNotifications = notifProvider.unreadCount;
    } catch (_) {}

    CustomerAddress? selectedAddress;
    try {
      selectedAddress = context.watch<AddressProvider>().selectedAddress;
    } catch (_) {}

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Sticky Top Header (Guest HomeCareX logo vs Deliver to • Add address)
            if (isAuthenticated)
              _buildTopLocationHeader(
                context,
                selectedAddress: selectedAddress,
                latestBooking: latestBooking,
                activeCount: activeBookings.length,
                unreadNotificationsCount: unreadNotifications,
                isPickerOpen: _isLocationPickerOpen,
                onTogglePicker: () {
                  setState(() {
                    _isLocationPickerOpen = !_isLocationPickerOpen;
                  });
                },
              )
            else
              _buildGuestHeader(context),
            Expanded(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  RefreshIndicator(
                    onRefresh: () async {
                      try {
                        await Future.wait([
                          catalog.fetchCatalog(),
                          context.read<BookingProvider>().fetchBookings(),
                          tryFetchNotifications(context),
                          tryFetchAddresses(context),
                        ]);
                      } catch (e) {
                        debugPrint('[HomeScreen] Refresh error: $e');
                      }
                    },
                    color: AppColors.brand,
                    child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 12),

                      // 1. GREETING SECTION (Live badge + Welcome, TATUKULA or Welcome to HomeCareX + subtitle)
                      _buildGreetingSection(context, isAuthenticated: isAuthenticated),

                      const SizedBox(height: 16),

                      // 2. CATEGORY HERO BANNER CAROUSEL (Appliance Repair & Service photo + dots + title)
                      _buildCustomerHeroBanner(context),

                      const SizedBox(height: 14),

                      // 3. SEARCH BAR (Search input + Mic + Orange search button)
                      _buildSearchBar(context),

                      const SizedBox(height: 20),

                      // 4. ACTIVE BOOKING SECTION (ONLY when authenticated and active bookings exist!)
                      if (isAuthenticated && activeBookings.isNotEmpty) ...[
                        _buildUpcomingSection(context, activeBookings.first),
                        const SizedBox(height: 18),
                      ],

                      // 5. BROWSE CATEGORIES (2x2 Photographic Grid matching reference)
                      _buildCustomerBrowseCategoriesSection(context),

                      const SizedBox(height: 20),

                      // 6. SERVICES FOR YOU (Horizontal Scrolling Service Cards matching reference)
                      _buildCustomerServicesForYouSection(context, catalog),

                      const SizedBox(height: 22),

                      // 7. OFFERS FOR YOU (Discount & Referral Carousel Cards)
                      _buildCustomerOffersSection(context),

                      const SizedBox(height: 36),
              ],
            ),
          ),
        ),

                  // Location Picker Dropdown Menu Overlay (when authenticated)
                  if (isAuthenticated && _isLocationPickerOpen) ...[
                    Positioned.fill(
                      child: GestureDetector(
                        onTap: () => setState(() => _isLocationPickerOpen = false),
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          color: Colors.black.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 4,
                      left: 16,
                      right: 16,
                      child: _buildAddressPickerDropdown(context),
                    ),
                  ],

                  // City Picker Dropdown Menu Overlay (when guest)
                  if (!isAuthenticated && _isCityPickerOpen) ...[
                    Positioned.fill(
                      child: GestureDetector(
                        onTap: () => setState(() => _isCityPickerOpen = false),
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          color: Colors.black.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 4,
                      left: 16,
                      right: 16,
                      child: _buildCityPickerDropdown(context),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }


  String _formatScheduledDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final day = dt.day;
    final month = months[(dt.month - 1).clamp(0, 11)];
    final hour = dt.hour;
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';
    final h12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return '$day $month, $h12:$minute $period';
  }

  String _formatStatusBadge(String status, String? partnerName) {
    final s = status.toLowerCase().trim();
    if (s == 'in_progress' || s == 'ongoing') return 'In Progress';
    if (s == 'completed') return 'Completed';
    if (s == 'cancelled') return 'Cancelled';
    if (partnerName != null && partnerName.isNotEmpty && partnerName.toLowerCase() != 'unassigned') {
      return 'Partner Assigned';
    }
    if (s == 'confirmed' || s == 'assigned') return 'Partner Assigned';
    return 'Pending';
  }

  Widget _buildUpcomingSection(BuildContext context, BookingModel booking) {
    final imagePath = ServiceImageResolver.resolve('', booking.serviceTitle);
    final focus = ServiceImageResolver.resolveFocus('', booking.serviceTitle);
    final formattedDate = _formatScheduledDate(booking.scheduledAt);
    final statusBadge = _formatStatusBadge(booking.status, booking.partnerName);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Upcoming',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const BookingsScreen()),
                  );
                },
                child: const Text(
                  'View all',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.brand,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookingTrackingScreen(booking: booking),
                ),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFF1F5F9)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1E1B2E).withValues(alpha: 0.05),
                    blurRadius: 18,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Service Image Thumbnail
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: SizedBox(
                      width: 54,
                      height: 54,
                      child: Image.asset(
                        imagePath,
                        fit: BoxFit.cover,
                        alignment: focus,
                        errorBuilder: (_, __, ___) => Container(
                          color: const Color(0xFFEEECFB),
                          child: const Icon(
                            Icons.handyman_rounded,
                            color: AppColors.brand,
                            size: 28,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Title, Schedule Date/Time, Location
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          booking.serviceTitle,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E293B),
                            height: 1.25,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          formattedDate,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            const Icon(
                              Icons.location_on_rounded,
                              size: 13,
                              color: Color(0xFF94A3B8),
                            ),
                            const SizedBox(width: 2),
                            Expanded(
                              child: Text(
                                booking.address.isNotEmpty
                                    ? booking.address
                                    : 'Select address',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF94A3B8),
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Badge & Price
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEECFB),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          statusBadge,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.brand,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '₹${booking.amount.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATED CUSTOMER HOME SECTIONS (matching localhost:3000/customer)
  // ---------------------------------------------------------------------------

  Widget _buildGreetingSection(BuildContext context, {required bool isAuthenticated}) {
    final greeting = _greetingForNow();
    final firstName = _getUserFirstName(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Live greeting badge: • Good afternoon / evening / morning
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFD9DCF7)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.03),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: Color(0xFF10B981), // Live Emerald
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 7),
                Text(
                  greeting,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Welcome, TATUKULA or Welcome to HomeCareX
          Text(
            isAuthenticated ? 'Welcome, $firstName' : 'Welcome to HomeCareX',
            style: const TextStyle(
              fontSize: 27,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1E1B2E),
              letterSpacing: -0.6,
            ),
          ),
          const SizedBox(height: 4),

          // Subtitle
          const Text(
            'Trusted professionals at your door. Transparent prices, no surprises.',
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF6B7280),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerHeroBanner(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Carousel photo box
          SizedBox(
            height: 180,
            child: PageView.builder(
              controller: _customerHeroPageController,
              itemCount: _customerHeroSlides.length,
              onPageChanged: (index) {
                setState(() {
                  _customerHeroIndex = index;
                });
              },
              itemBuilder: (context, index) {
                final slide = _customerHeroSlides[index];
                return GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ServicesScreen(initialCategory: slide.slug),
                      ),
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF1E1B2E).withValues(alpha: 0.10),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(26),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.asset(
                            slide.imagePath,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: const Color(0xFFEEECFB),
                              child: const Center(
                                child: Icon(Icons.handyman_rounded, color: AppColors.brand, size: 48),
                              ),
                            ),
                          ),
                          // Subtle dark gradient overlay at bottom
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 60,
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withValues(alpha: 0.40),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          // Indicator dots at bottom right of photo matching web reference
                          Positioned(
                            bottom: 12,
                            right: 14,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: List.generate(_customerHeroSlides.length, (dotIdx) {
                                final isActive = dotIdx == _customerHeroIndex;
                                return AnimatedContainer(
                                  duration: const Duration(milliseconds: 250),
                                  margin: const EdgeInsets.only(left: 5),
                                  width: isActive ? 22 : 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? Colors.white
                                        : Colors.white.withValues(alpha: 0.55),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                );
                              }),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),

          // Category name below photo
          GestureDetector(
            onTap: () {
              final currentSlide = _customerHeroSlides[_customerHeroIndex];
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ServicesScreen(initialCategory: currentSlide.slug),
                ),
              );
            },
            child: Text(
              _customerHeroSlides[_customerHeroIndex].title,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E1B2E),
                letterSpacing: -0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerBrowseCategoriesSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Browse categories',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.3,
                ),
              ),
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CategoriesScreen()),
                  );
                },
                behavior: HitTestBehavior.opaque,
                child: const Text(
                  'View all',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.brand,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.15,
            children: [
              _buildCustomerCategoryCard(
                title: 'Salon & Spa',
                subtitle: '6 services',
                imagePath: 'assets/images/Home-spa-women.webp',
                slug: 'salon-spa',
              ),
              _buildCustomerCategoryCard(
                title: 'Appliance Repair &\nService',
                subtitle: '6 services',
                imagePath: 'assets/images/quality-service.jpg',
                slug: 'appliance-repair-service',
              ),
              _buildCustomerCategoryCard(
                title: 'Home Cleaning',
                subtitle: '5 services',
                imagePath: 'assets/images/home-cleaning.jpg',
                slug: 'home-cleaning',
              ),
              _buildCustomerCategoryCard(
                title: 'Electrical & Plumbing',
                subtitle: '6 services',
                imagePath: 'assets/images/electrical.jpg',
                slug: 'electrical-plumbing',
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCustomerCategoryCard({
    required String title,
    required String subtitle,
    required String imagePath,
    required String slug,
  }) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ServicesScreen(initialCategory: slug),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1E1B2E).withValues(alpha: 0.08),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Photo
              Image.asset(
                imagePath,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: const Color(0xFFEEECFB),
                  child: const Center(
                    child: Icon(Icons.home_repair_service_rounded, color: AppColors.brand, size: 36),
                  ),
                ),
              ),

              // Gradient Overlay (dark at bottom for high legibility)
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      const Color(0xFF141224).withValues(alpha: 0.45),
                      const Color(0xFF141224).withValues(alpha: 0.88),
                    ],
                    stops: const [0.35, 0.65, 1.0],
                  ),
                ),
              ),

              // Top right white circle with arrow icon
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.12),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.arrow_forward_rounded,
                      size: 14,
                      color: AppColors.brand,
                    ),
                  ),
                ),
              ),

              // Bottom-left title and subtitle
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        height: 1.2,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCustomerServicesForYouSection(BuildContext context, CatalogProvider catalog) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Services for you',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
              letterSpacing: -0.3,
            ),
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              _buildCustomerServiceCard(
                context: context,
                title: 'AC Service & Gas Refill',
                imagePath: 'assets/images/quality-service.jpg',
                categorySlug: 'appliance-repair-service',
                rating: '4.8',
                duration: '45 mins',
                price: 499,
              ),
              _buildCustomerServiceCard(
                context: context,
                title: 'Deep Home Cleaning',
                imagePath: 'assets/images/home-cleaning.jpg',
                categorySlug: 'home-cleaning',
                rating: '4.9',
                duration: '120 mins',
                price: 899,
              ),
              _buildCustomerServiceCard(
                context: context,
                title: 'At-Home Spa for Women',
                imagePath: 'assets/images/Home-spa-women.webp',
                categorySlug: 'salon-spa',
                rating: '4.9',
                duration: '75 mins',
                price: 699,
              ),
              _buildCustomerServiceCard(
                context: context,
                title: 'Electrician Visit & Repair',
                imagePath: 'assets/images/electrical.jpg',
                categorySlug: 'electrical-plumbing',
                rating: '4.7',
                duration: '45 mins',
                price: 199,
              ),
              _buildCustomerServiceCard(
                context: context,
                title: 'Tap Leak Repair & Fix',
                imagePath: 'assets/images/plumbing-1200.webp',
                categorySlug: 'electrical-plumbing',
                rating: '4.8',
                duration: '45 mins',
                price: 249,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCustomerServiceCard({
    required BuildContext context,
    required String title,
    required String imagePath,
    required String categorySlug,
    required String rating,
    required String duration,
    required int price,
  }) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ServicesScreen(initialCategory: categorySlug),
          ),
        );
      },
      child: Container(
        width: 188,
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1E1B2E).withValues(alpha: 0.06),
              blurRadius: 18,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: 110,
                width: double.infinity,
                child: Image.asset(
                  imagePath,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: const Color(0xFFEEECFB),
                    child: const Center(
                      child: Icon(Icons.handyman_rounded, color: AppColors.brand, size: 30),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(
                  Icons.star_rounded,
                  size: 14,
                  color: Color(0xFFF59E0B),
                ),
                const SizedBox(width: 3),
                Text(
                  rating,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const Text(
                  ' · ',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Icon(
                  Icons.access_time_rounded,
                  size: 12,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 3),
                Expanded(
                  child: Text(
                    duration,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '₹$price',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Text(
                    'Book',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomerOffersSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Offers for you',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
              letterSpacing: -0.3,
            ),
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              // Offer 1: Flat 20% OFF
              GestureDetector(
                onTap: () => _copyCouponCode('HOME20'),
                child: Container(
                  width: 260,
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFEEECFB), Color(0xFFF5F3FF)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFDDD6FE)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4338CA).withValues(alpha: 0.06),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
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
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.brand,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'HOME20',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          Icon(
                            _copiedCoupon ? Icons.check_circle_rounded : Icons.copy_rounded,
                            size: 18,
                            color: AppColors.brand,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Flat 20% OFF',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'On Your First Booking',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _copiedCoupon ? 'Copied! ✓' : 'Use Code: HOME20',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.brand,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Offer 2: Refer a friend, earn ₹50
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ReferralsScreen()),
                  );
                },
                child: Container(
                  width: 260,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFB45309).withValues(alpha: 0.06),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
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
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'REFERRAL',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.card_giftcard_rounded,
                            size: 18,
                            color: Color(0xFFB45309),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Refer a friend, earn ₹50',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Both get wallet credit on 1st order',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: const Color(0xFFD9DCF7)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4338CA).withValues(alpha: 0.08),
              blurRadius: 18,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            const SizedBox(width: 14),
            const Icon(
              Icons.search_rounded,
              color: Color(0xFF9CA3AF),
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _searchController,
                textInputAction: TextInputAction.search,
                onSubmitted: (val) => _submitSearch(val),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF1E1B2E),
                ),
                decoration: InputDecoration(
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  filled: false,
                  fillColor: Colors.transparent,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                  hintText: _searchController.text.isEmpty ? _animatedHint : null,
                  hintStyle: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF9CA3AF),
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
            ),
            // Voice Mic button
            GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Voice Search: Speak now (e.g., "AC repair")'),
                    duration: Duration(seconds: 2),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              child: Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  color: Color(0xFFEEECFB),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(
                    Icons.mic_rounded,
                    color: AppColors.brand,
                    size: 19,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 6),
            // Vibrant Orange Search Button
            GestureDetector(
              onTap: () => _submitSearch(_searchController.text),
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFFF8A3D),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFF8A3D).withValues(alpha: 0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.search_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 7),
          ],
        ),
      ),
    );
  }
}
