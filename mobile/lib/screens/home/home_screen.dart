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
import '../../providers/cart_provider.dart';
import '../../providers/booking_provider.dart';
import '../../providers/notification_provider.dart';
import '../../providers/address_provider.dart';
import '../catalog/categories_screen.dart';
import '../catalog/services_screen.dart';
import '../catalog/service_details_screen.dart';
import '../bookings/bookings_screen.dart';
import '../bookings/booking_tracking_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/saved_addresses_screen.dart';
import '../referrals/referrals_screen.dart';

class _HeroSlideData {
  final String tag;
  final String title;
  final String description;
  final String buttonText;
  final String imagePath;
  final String categorySlug;
  final List<Color> gradientColors;
  final Color buttonColor;
  final Color tagColor;
  final Color tagBgColor;
  final Color tagBorderColor;

  const _HeroSlideData({
    required this.tag,
    required this.title,
    required this.description,
    required this.buttonText,
    required this.imagePath,
    required this.categorySlug,
    required this.gradientColors,
    required this.buttonColor,
    required this.tagColor,
    this.tagBgColor = Colors.white,
    required this.tagBorderColor,
  });
}

class _GuestHeroSlide {
  final String tag;
  final String title;
  final String description;
  final String buttonText;
  final String imagePath;
  final String categorySlug;

  const _GuestHeroSlide({
    required this.tag,
    required this.title,
    required this.description,
    required this.buttonText,
    required this.imagePath,
    required this.categorySlug,
  });
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _copiedCoupon = false;
  final Set<String> _favoriteServiceIds = {};
  bool _isLocationPickerOpen = false;
  bool _isCityPickerOpen = false;
  String _selectedCity = 'Hyderabad';

  late final PageController _heroPageController;
  late final PageController _guestPageController;
  late final TextEditingController _searchController;
  Timer? _heroTimer;
  Timer? _guestHeroTimer;
  Timer? _typingTimer;
  Timer? _typingPauseTimer;
  int _heroPageIndex = 0;
  int _guestPageIndex = 0;
  bool _isGuestAutoplayPaused = false;
  String _animatedHint = 'Search AC repair|';
  int _phraseIndex = 0;
  int _charIndex = 0;
  bool _isTypingForward = true;

  static const List<_GuestHeroSlide> _guestHeroSlides = [
    _GuestHeroSlide(
      tag: 'Home services',
      title: 'Quality Services at Your\nDoorstep',
      description: 'Easy, reliable and clean run of home services.',
      buttonText: 'Explore services',
      imagePath: 'assets/images/quality-service.jpg',
      categorySlug: 'services',
    ),
    _GuestHeroSlide(
      tag: 'Appliance repair',
      title: 'Appliance repair at your doorstep',
      description: 'Get your washing machine, fridge or AC working without hassle',
      buttonText: 'Explore services',
      imagePath: 'assets/images/appliance-repair.webp',
      categorySlug: 'appliance-repair-service',
    ),
    _GuestHeroSlide(
      tag: 'Electrical & Plumbing',
      title: 'Safe, certified home repairs',
      description: 'Quick fixes, safety checks, and emergency home care',
      buttonText: 'Explore services',
      imagePath: 'assets/images/electrical.jpg',
      categorySlug: 'electrical-plumbing',
    ),
  ];

  static const List<_HeroSlideData> _heroSlides = [
    _HeroSlideData(
      tag: 'Verified Professionals',
      title: 'Home Cleaning\nServices',
      description: 'Deep cleaning for a healthier and happier home.',
      buttonText: 'Book Now',
      imagePath: 'assets/images/sofa-clean.png',
      categorySlug: 'home-cleaning',
      gradientColors: [Color(0xFFEDF2F8), Color(0xFFEEF3F8), Color(0xFFF4F7FB)],
      buttonColor: Color(0xFF2563EB),
      tagColor: Color(0xFF1D4ED8),
      tagBgColor: Colors.white,
      tagBorderColor: Color(0xFFDBEAFE),
    ),
    _HeroSlideData(
      tag: '30-Day Warranty',
      title: 'Appliance Repair\nServices',
      description: 'Expert technician at your doorstep within 60 minutes.',
      buttonText: 'Book Now',
      imagePath: 'assets/images/appliance-repair.webp',
      categorySlug: 'appliance-repair-service',
      gradientColors: [Color(0xFFEFF6FF), Color(0xFFF0F9FF), Color(0xFFE0E7FF)],
      buttonColor: Color(0xFF2563EB),
      tagColor: Color(0xFF1D4ED8),
      tagBgColor: Colors.white,
      tagBorderColor: Color(0xFFDBEAFE),
    ),
    _HeroSlideData(
      tag: 'Certified Experts',
      title: 'Electrical &\nPlumbing Care',
      description: 'Quick fixes, safety checks, and emergency home care.',
      buttonText: 'Book Now',
      imagePath: 'assets/images/electrical.jpg',
      categorySlug: 'electrical-plumbing',
      gradientColors: [Color(0xFFFFFBEB), Color(0xFFFFF7ED), Color(0xFFFEF3C7)],
      buttonColor: Color(0xFFF97316),
      tagColor: Color(0xFFB45309),
      tagBgColor: Colors.white,
      tagBorderColor: Color(0xFFFEF3C7),
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
    _heroPageController = PageController();
    _guestPageController = PageController();
    _searchController = TextEditingController();

    _heroTimer = Timer.periodic(const Duration(milliseconds: 5000), (timer) {
      if (!mounted) return;
      if (_heroPageController.hasClients) {
        final next = (_heroPageIndex + 1) % _heroSlides.length;
        _heroPageController.animateToPage(
          next,
          duration: const Duration(milliseconds: 550),
          curve: Curves.easeInOutCubic,
        );
      }
    });

    _guestHeroTimer = Timer.periodic(const Duration(milliseconds: 4500), (timer) {
      if (!mounted) return;
      if (!_isGuestAutoplayPaused && _guestPageController.hasClients) {
        final next = (_guestPageIndex + 1) % _guestHeroSlides.length;
        _guestPageController.animateToPage(
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
    _heroTimer?.cancel();
    _guestHeroTimer?.cancel();
    _typingTimer?.cancel();
    _typingPauseTimer?.cancel();
    _heroPageController.dispose();
    _guestPageController.dispose();
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
    final cart = context.watch<CartProvider>();
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

                      if (isAuthenticated) ...[
                        // 2. GREETING SECTION (Good morning/afternoon/evening pill + Welcome header + subtitle)
                        _buildGreetingSection(context),

                        const SizedBox(height: 16),

                        // 3. HERO CATEGORY CAROUSEL CARD (Photo + Indicators + Category Title)
                        _buildHeroCard(context),

                        const SizedBox(height: 14),

                        // 4. SEARCH BAR (Search input + Mic + Orange search button)
                        _buildSearchBar(context),

                        const SizedBox(height: 18),
                      ] else ...[
                        // 2. GUEST GREETING SECTION (Good Afternoon, Welcome to HomeCareX...)
                        _buildGuestGreetingSection(context),

                        const SizedBox(height: 14),

                        // 3. TOP GUEST HERO BANNER (Quality Services at Your Doorstep, explore, control bar)
                        _buildGuestHeroCarousel(context),

                        const SizedBox(height: 14),

                        // 4. SERVICE CAROUSEL CARD (Verified Professionals / Home Cleaning, dots)
                        _buildHeroCard(context),

                        const SizedBox(height: 14),

                        // 5. SEARCH BAR (Search input + Mic + Orange search button)
                        _buildSearchBar(context),

                        const SizedBox(height: 18),
                      ],

                if (isAuthenticated) ...[
                  // 5. QUICK ACTIONS ROW (Book again, Track order, Refer & earn, Get support)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
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
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Expanded(
                            child: _buildQuickActionItem(
                              label: 'Book again',
                              icon: Icons.refresh_rounded,
                              color: const Color(0xFF94A3B8),
                              bgGradient: null,
                              bgColor: const Color(0xFFF1F5F9),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const ServicesScreen()),
                                );
                              },
                            ),
                          ),
                          Expanded(
                            child: _buildQuickActionItem(
                              label: 'Track order',
                              icon: Icons.navigation_rounded,
                              color: const Color(0xFF94A3B8),
                              bgGradient: null,
                              bgColor: const Color(0xFFF1F5F9),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const BookingsScreen()),
                                );
                              },
                            ),
                          ),
                          Expanded(
                            child: _buildQuickActionItem(
                              label: 'Refer & earn',
                              icon: Icons.card_giftcard_rounded,
                              color: Colors.white,
                              bgGradient: const LinearGradient(
                                colors: [Color(0xFFF472B6), Color(0xFFDB2777)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              bgColor: const Color(0xFFDB2777),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const ReferralsScreen(),
                                  ),
                                );
                              },
                            ),
                          ),
                          Expanded(
                            child: _buildQuickActionItem(
                              label: 'Get support',
                              icon: Icons.headset_mic_rounded,
                              color: Colors.white,
                              bgGradient: const LinearGradient(
                                colors: [Color(0xFF34D399), Color(0xFF059669)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              bgColor: const Color(0xFF059669),
                              onTap: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Help Center: support@homecarex.com'),
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // UPCOMING BOOKING SECTION (when active bookings exist) OR WELCOME TO HOMECAREX! (New Customer Card)
                  if (activeBookings.isNotEmpty)
                    _buildUpcomingSection(context, activeBookings.first)
                  else
                    _buildWelcomeCustomerCard(context),

                  const SizedBox(height: 20),
                ],

                // 6. SERVICE CATEGORIES (4x2 GRID)
                _buildServiceCategoriesSection(context),

                const SizedBox(height: 18),

                // 7. PROMO / DISCOUNT BANNER (Flat 20% OFF / Use Code: HOME20)
                _buildPromoDiscountBanner(context),

                const SizedBox(height: 22),

                // 8. POPULAR SERVICES (Horizontal Carousel)
                _buildPopularServicesSection(context, catalog, cart),

                const SizedBox(height: 32),
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

  // Quick Action Icon Cell
  Widget _buildQuickActionItem({
    required String label,
    required IconData icon,
    required Color color,
    required Gradient? bgGradient,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: bgGradient,
              color: bgGradient == null ? bgColor : null,
              shape: BoxShape.circle,
              boxShadow: bgGradient != null
                  ? [
                      BoxShadow(
                        color: bgColor.withValues(alpha: 0.35),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: Icon(icon, color: color, size: 22),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFF1E1B2E),
            ),
          ),
        ],
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

  Widget _buildWelcomeCustomerCard(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: AppColors.brand.withValues(alpha: 0.25),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1E1B2E).withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          children: [
            // Party Popper Icon
            Image.asset(
              'assets/icons/3d/party.png',
              width: 68,
              height: 68,
              errorBuilder: (_, __, ___) => const Text('🎉', style: TextStyle(fontSize: 48)),
            ),
            const SizedBox(height: 10),
            const Text(
              'Welcome to HomeCareX!',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E1B2E),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              "You haven't booked a service yet. Pick a category below to get started.",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.35,
              ),
            ),
            const SizedBox(height: 18),

            // 3 Category shortcut tiles
            Row(
              children: [
                Expanded(
                  child: _buildWelcomeCategoryTile(
                    label: 'Home Cleaning',
                    iconPath: 'assets/icons/3d/broom.png',
                    fallbackEmoji: '🧹',
                    bgColor: const Color(0xFFEEECFB),
                    onTap: () => _openCategory(context, 'home-cleaning'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildWelcomeCategoryTile(
                    label: 'Appliance Repair',
                    iconPath: 'assets/icons/3d/wrench.png',
                    fallbackEmoji: '🔧',
                    bgColor: const Color(0xFFFFF3EB),
                    onTap: () => _openCategory(context, 'appliance-repair-service'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildWelcomeCategoryTile(
                    label: 'Salon & Spa',
                    iconPath: 'assets/icons/3d/massage.png',
                    fallbackEmoji: '💆',
                    bgColor: const Color(0xFFE4F4EC),
                    onTap: () => _openCategory(context, 'salon-spa'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Big Purple "Browse all categories" button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CategoriesScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Browse all categories',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Welcome Category Shortcut Tile
  Widget _buildWelcomeCategoryTile({
    required String label,
    required String iconPath,
    required String fallbackEmoji,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Image.asset(
              iconPath,
              width: 36,
              height: 36,
              errorBuilder: (_, __, ___) => Text(fallbackEmoji, style: const TextStyle(fontSize: 26)),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E1B2E),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // 1. SERVICE CATEGORIES (4x2 GRID MATCHING MOCKUP & WEB DESIGN)
  // ===========================================================================
  Widget _buildServiceCategoriesSection(BuildContext context) {
    final List<Map<String, dynamic>> categories = [
      {
        'id': 'home-cleaning',
        'name': 'Home Cleaning',
        'icon': Icons.cleaning_services_outlined,
        'color': const Color(0xFF3B82F6),
        'slug': 'home-cleaning',
      },
      {
        'id': 'appliance-repair',
        'name': 'Appliance Repair',
        'icon': Icons.kitchen_outlined,
        'color': const Color(0xFF0EA5E9),
        'slug': 'appliance-repair-service',
      },
      {
        'id': 'salon-spa',
        'name': 'Salon & Spa',
        'icon': Icons.spa_outlined,
        'color': const Color(0xFFEC4899),
        'slug': 'salon-spa',
      },
      {
        'id': 'electrical-plumbing',
        'name': 'Electrical & Plumbing',
        'icon': Icons.build_outlined,
        'color': const Color(0xFFF97316),
        'slug': 'electrical-plumbing',
      },
      {
        'id': 'painting-waterproofing',
        'name': 'Painting & Waterproofing',
        'icon': Icons.format_paint_outlined,
        'color': const Color(0xFF10B981),
        'slug': 'painting-waterproofing',
      },
      {
        'id': 'pest-control',
        'name': 'Pest Control',
        'icon': Icons.pest_control_outlined,
        'color': const Color(0xFFEF4444),
        'slug': 'pest-control',
      },
      {
        'id': 'carpentry-assembly',
        'name': 'Carpentry & Assembly',
        'icon': Icons.chair_outlined,
        'color': const Color(0xFF8B5CF6),
        'slug': 'carpentry-assembly',
      },
      {
        'id': 'more-services',
        'name': 'More Services',
        'icon': Icons.grid_view_rounded,
        'color': const Color(0xFF2563EB),
        'slug': 'more-services',
      },
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: "Service Categories" + "View All →"
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Service Categories',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
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
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'View All',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2563EB),
                      ),
                    ),
                    SizedBox(width: 3),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 13,
                      color: Color(0xFF2563EB),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // 4x2 Grid of Category Tiles
          GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              childAspectRatio: 0.88,
            ),
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final cat = categories[index];
              final name = cat['name'] as String;
              final icon = cat['icon'] as IconData;
              final iconColor = cat['color'] as Color;
              final slug = cat['slug'] as String;

              return GestureDetector(
                onTap: () {
                  if (slug == 'more-services') {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CategoriesScreen()),
                    );
                  } else {
                    _openCategory(context, slug);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        height: 32,
                        child: Center(
                          child: Icon(icon, color: iconColor, size: 24),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E293B),
                          height: 1.15,
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
    );
  }

  // ===========================================================================
  // 2. PROMO / DISCOUNT BANNER (FLAT 20% OFF / USE CODE: HOME20)
  // ===========================================================================
  Widget _buildPromoDiscountBanner(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFEFF6FF), Color(0xFFF0F7FF), Color(0xFFE0F2FE)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFBFDBFE).withValues(alpha: 0.6)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF2563EB).withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            // Blue Rounded Square % Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.percent_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Text content
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Flat 20% OFF',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'On Your First Booking',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),

            // Coupon code pill button: Use Code: HOME20
            GestureDetector(
              onTap: () => _copyCouponCode('HOME20'),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFF2563EB),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.08),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  _copiedCoupon ? 'Copied! ✓' : 'Use Code: HOME20',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2563EB),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // 3. POPULAR SERVICES (HORIZONTAL CAROUSEL MATCHING WEB DESIGN)
  // ===========================================================================
  Widget _buildPopularServicesSection(
    BuildContext context,
    CatalogProvider catalog,
    CartProvider cart,
  ) {
    final List<Map<String, dynamic>> popularItems = [
      {
        'id': 'ac-service',
        'title': 'AC Service',
        'rating': 4.8,
        'reviewsCount': '2.1K',
        'price': 499,
        'image': 'assets/images/home-maintenance.webp',
        'slug': 'ac-service-gas-refill',
      },
      {
        'id': 'home-cleaning',
        'title': 'Home Cleaning',
        'rating': 4.7,
        'reviewsCount': '3.4K',
        'price': 299,
        'image': 'assets/images/home-cleaning.webp',
        'slug': 'deep-home-cleaning',
      },
      {
        'id': 'washing-machine-repair',
        'title': 'Washing Machine Repair',
        'rating': 4.6,
        'reviewsCount': '1.8K',
        'price': 399,
        'image': 'assets/images/washing-machine-repair.webp',
        'slug': 'washing-machine-repair',
      },
      {
        'id': 'salon-at-home',
        'title': 'Salon at Home',
        'rating': 4.8,
        'reviewsCount': '1.2K',
        'price': 399,
        'image': 'assets/images/Home-spa-women.webp',
        'slug': 'salon-spa',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header: "Popular Services" + "View All →"
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              RichText(
                text: const TextSpan(
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: Color(0xFF0F172A),
                  ),
                  children: [
                    TextSpan(text: 'Popular '),
                    TextSpan(
                      text: 'Services',
                      style: TextStyle(
                        color: Color(0xFFFF7A1A),
                      ),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ServicesScreen()),
                  );
                },
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'View All',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2563EB),
                      ),
                    ),
                    SizedBox(width: 3),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 13,
                      color: Color(0xFF2563EB),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Horizontal Scroll List
        SizedBox(
          height: 225,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: popularItems.length,
            itemBuilder: (context, index) {
              final item = popularItems[index];
              final id = item['id'] as String;
              final title = item['title'] as String;
              final rating = item['rating'] as double;
              final reviewsCount = item['reviewsCount'] as String;
              final price = item['price'] as int;
              final imagePath = item['image'] as String;
              final slug = item['slug'] as String;
              final isFav = _favoriteServiceIds.contains(id);

              final catalogService = catalog.services.where((s) => s.slug == slug || s.id == id).firstOrNull;

              return Container(
                width: 162,
                margin: EdgeInsets.only(right: index == popularItems.length - 1 ? 0 : 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: GestureDetector(
                    onTap: () {
                      if (catalogService != null) {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ServiceDetailsScreen(service: catalogService),
                          ),
                        );
                      } else {
                        _openCategory(context, slug);
                      }
                    },
                    behavior: HitTestBehavior.opaque,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Thumbnail image + Heart Button
                        Stack(
                          children: [
                            SizedBox(
                              height: 108,
                              width: double.infinity,
                              child: Image.asset(
                                imagePath,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: const Color(0xFFF1F5F9),
                                  child: const Icon(
                                    Icons.handyman_rounded,
                                    color: Color(0xFF94A3B8),
                                    size: 32,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: GestureDetector(
                                onTap: () {
                                  setState(() {
                                    if (_favoriteServiceIds.contains(id)) {
                                      _favoriteServiceIds.remove(id);
                                    } else {
                                      _favoriteServiceIds.add(id);
                                    }
                                  });
                                },
                                child: Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.92),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.08),
                                        blurRadius: 4,
                                        offset: const Offset(0, 1),
                                      ),
                                    ],
                                  ),
                                  child: Center(
                                    child: Icon(
                                      isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                      size: 15,
                                      color: isFav ? const Color(0xFFF43F5E) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),

                        // Card body
                        Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 4),

                              // Rating Row
                              Row(
                                children: [
                                  const Icon(
                                    Icons.star_rounded,
                                    size: 14,
                                    color: Color(0xFFFBBF24),
                                  ),
                                  const SizedBox(width: 2),
                                  Text(
                                    rating.toStringAsFixed(1),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    '($reviewsCount)',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),

                              const SizedBox(height: 8),

                              // Divider line
                              Container(
                                height: 1,
                                color: const Color(0xFFF1F5F9),
                              ),

                              const SizedBox(height: 6),

                              // Price & Action Arrow Row
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '₹$price',
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  Container(
                                    width: 24,
                                    height: 24,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFEFF6FF),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Center(
                                      child: Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 13,
                                        color: Color(0xFF2563EB),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
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
      ],
    );
  }

  Widget _buildGreetingSection(BuildContext context) {
    final greeting = _greetingForNow();
    final firstName = _getUserFirstName(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Live greeting badge: • Good morning / afternoon / evening
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

          // Welcome, TATUKULA
          Text(
            'Welcome, $firstName',
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

  Widget _buildHeroCard(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Hero Card Container
          Container(
            height: 165,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: const Color(0xFFE2E8F0),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: PageView.builder(
                controller: _heroPageController,
                itemCount: _heroSlides.length,
                onPageChanged: (idx) {
                  setState(() => _heroPageIndex = idx);
                },
                itemBuilder: (context, index) {
                  final slide = _heroSlides[index];
                  return GestureDetector(
                    onTap: () => _openCategory(context, slide.categorySlug),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: slide.gradientColors,
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                      ),
                      child: Stack(
                        children: [
                          // Right Image with left soft gradient fade
                          Positioned(
                            top: 0,
                            bottom: 0,
                            right: 0,
                            width: 162,
                            child: ShaderMask(
                              shaderCallback: (bounds) {
                                return const LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black,
                                  ],
                                  stops: [0.0, 0.22],
                                ).createShader(bounds);
                              },
                              blendMode: BlendMode.dstIn,
                              child: Image.asset(
                                slide.imagePath,
                                fit: BoxFit.cover,
                                alignment: Alignment.bottomRight,
                                errorBuilder: (_, __, ___) => const SizedBox(),
                              ),
                            ),
                          ),

                          // Left Vector Content
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Badge: 🛡️ Verified Professionals
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: slide.tagBgColor.withValues(alpha: 0.95),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: slide.tagBorderColor.withValues(alpha: 0.8),
                                      width: 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.03),
                                        blurRadius: 4,
                                        offset: const Offset(0, 1),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.verified_user_outlined,
                                        size: 11,
                                        color: slide.tagColor,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        slide.tag,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: slide.tagColor,
                                          letterSpacing: -0.1,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 7),

                                // Headline: Home Cleaning Services
                                Text(
                                  slide.title,
                                  style: const TextStyle(
                                    fontSize: 17.5,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                    height: 1.15,
                                    letterSpacing: -0.3,
                                  ),
                                  maxLines: 2,
                                ),
                                const SizedBox(height: 3.5),

                                // Subtitle: Deep cleaning for a healthier and happier home.
                                SizedBox(
                                  width: 160,
                                  child: Text(
                                    slide.description,
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF475569),
                                      height: 1.25,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),

                                const Spacer(),

                                // Button: Book Now ->
                                GestureDetector(
                                  onTap: () => _openCategory(context, slide.categorySlug),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6.5),
                                    decoration: BoxDecoration(
                                      color: slide.buttonColor,
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: [
                                        BoxShadow(
                                          color: slide.buttonColor.withValues(alpha: 0.35),
                                          blurRadius: 6,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          slide.buttonText,
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Icon(
                                          Icons.arrow_forward_rounded,
                                          size: 13,
                                          color: Colors.white,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          const SizedBox(height: 8),

          // 2. Centered Carousel Indicator Dots below card
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_heroSlides.length, (idx) {
              final isActive = idx == _heroPageIndex;
              return GestureDetector(
                onTap: () {
                  _heroPageController.animateToPage(
                    idx,
                    duration: const Duration(milliseconds: 350),
                    curve: Curves.easeInOut,
                  );
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 2.5),
                  height: 5,
                  width: isActive ? 22 : 5,
                  decoration: BoxDecoration(
                    color: isActive
                        ? const Color(0xFF2563EB)
                        : const Color(0xFFBFDBFE),
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

  // ---------------------------------------------------------------------------
  // GUEST GREETING SECTION (Good Afternoon, Welcome to HomeCareX...)
  // ---------------------------------------------------------------------------
  Widget _buildGuestGreetingSection(BuildContext context) {
    final greeting = _greetingForNow();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$greeting,',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 2),
          RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 23,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
                color: Color(0xFF0F172A),
              ),
              children: [
                TextSpan(text: 'Welcome to '),
                TextSpan(
                  text: 'HomeCareX',
                  style: TextStyle(
                    color: Color(0xFF2563EB),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Book trusted professionals for your home needs.',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Color(0xFF64748B),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }



  // ---------------------------------------------------------------------------
  // GUEST TOP HERO BANNER (Quality Services at Your Doorstep, control bar)
  // ---------------------------------------------------------------------------
  Widget _buildGuestHeroCarousel(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        height: 215,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.18),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // PageView of hero slides
              PageView.builder(
                controller: _guestPageController,
                itemCount: _guestHeroSlides.length,
                onPageChanged: (idx) {
                  setState(() => _guestPageIndex = idx);
                },
                itemBuilder: (context, index) {
                  final slide = _guestHeroSlides[index];
                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      // Photo
                      Image.asset(
                        slide.imagePath,
                        fit: BoxFit.cover,
                        alignment: Alignment.topCenter,
                        errorBuilder: (_, __, ___) => Container(
                          color: const Color(0xFF1E293B),
                          child: const Center(
                            child: Icon(Icons.handyman_rounded, color: Colors.white, size: 48),
                          ),
                        ),
                      ),

                      // Dark readability gradients
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [
                              Colors.black.withValues(alpha: 0.8),
                              Colors.black.withValues(alpha: 0.45),
                              Colors.transparent,
                            ],
                            stops: const [0.0, 0.58, 1.0],
                          ),
                        ),
                      ),
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.65),
                              Colors.transparent,
                            ],
                            stops: const [0.0, 0.38],
                          ),
                        ),
                      ),

                      // Slide text & CTA
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 42),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Category Tag Badge
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.35),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.3),
                                    ),
                                  ),
                                  child: Text(
                                    slide.tag,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),

                                // Title
                                Text(
                                  slide.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    height: 1.2,
                                    letterSpacing: -0.3,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 3),

                                // Subtitle
                                Text(
                                  slide.description,
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.9),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                    height: 1.3,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),

                            // Orange Explore services button
                            GestureDetector(
                              onTap: () {
                                if (slide.categorySlug == 'services') {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => const ServicesScreen()),
                                  );
                                } else {
                                  _openCategory(context, slide.categorySlug);
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF8A3D),
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFFFF8A3D).withValues(alpha: 0.4),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      slide.buttonText,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.arrow_forward_rounded,
                                      size: 14,
                                      color: Colors.white,
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
                },
              ),

              // Bottom control bar (progress segments + pause/play + prev/next chevrons)
              Positioned(
                bottom: 10,
                left: 16,
                right: 16,
                child: Row(
                  children: [
                    // Progress line indicators
                    Expanded(
                      child: Row(
                        children: List.generate(_guestHeroSlides.length, (i) {
                          final isActive = i == _guestPageIndex;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () {
                                _guestPageController.animateToPage(
                                  i,
                                  duration: const Duration(milliseconds: 350),
                                  curve: Curves.easeInOut,
                                );
                              },
                              child: Container(
                                height: 4,
                                margin: const EdgeInsets.symmetric(horizontal: 2),
                                decoration: BoxDecoration(
                                  color: isActive
                                      ? const Color(0xFFFF8A3D)
                                      : Colors.white.withValues(alpha: 0.35),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(width: 10),

                    // Pause / Play button
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _isGuestAutoplayPaused = !_isGuestAutoplayPaused;
                        });
                      },
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Icon(
                            _isGuestAutoplayPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),

                    // Prev chevron <
                    GestureDetector(
                      onTap: () {
                        final prev = (_guestPageIndex - 1 + _guestHeroSlides.length) % _guestHeroSlides.length;
                        _guestPageController.animateToPage(
                          prev,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                      },
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.chevron_left_rounded,
                            size: 16,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),

                    // Next chevron >
                    GestureDetector(
                      onTap: () {
                        final next = (_guestPageIndex + 1) % _guestHeroSlides.length;
                        _guestPageController.animateToPage(
                          next,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                      },
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.chevron_right_rounded,
                            size: 16,
                            color: Colors.white,
                          ),
                        ),
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

  void _openCategory(BuildContext context, String slug) {
    final catalog = Provider.of<CatalogProvider>(context, listen: false);
    final match = catalog.categories.where((c) => c.slug == slug || c.id == slug).firstOrNull;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ServicesScreen(initialCategory: match?.id ?? slug),
      ),
    );
  }
}
