import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/category_model.dart';
import '../../core/models/service_model.dart';
import '../../core/models/booking_model.dart';
import '../../core/models/address_model.dart';
import '../../core/utils/icon_3d.dart';
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
  final String title;
  final String categoryId;
  final String categorySlug;
  final String imagePath;

  const _HeroSlideData({
    required this.title,
    required this.categoryId,
    required this.categorySlug,
    required this.imagePath,
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

  late final PageController _heroPageController;
  late final TextEditingController _searchController;
  Timer? _heroTimer;
  Timer? _typingTimer;
  Timer? _typingPauseTimer;
  int _heroPageIndex = 0;
  String _animatedHint = 'Search AC repair|';
  int _phraseIndex = 0;
  int _charIndex = 0;
  bool _isTypingForward = true;

  static const List<_HeroSlideData> _heroSlides = [
    _HeroSlideData(
      title: 'Painting & Waterproofing',
      categoryId: 'cat_painting',
      categorySlug: 'painting-waterproofing',
      imagePath: 'assets/images/painting-category.webp',
    ),
    _HeroSlideData(
      title: 'Home Cleaning',
      categoryId: 'cat_cleaning',
      categorySlug: 'home-cleaning',
      imagePath: 'assets/images/home-cleaning.webp',
    ),
    _HeroSlideData(
      title: 'Appliance Repair & Service',
      categoryId: 'cat_appliances',
      categorySlug: 'appliance-repair-service',
      imagePath: 'assets/images/appliance-repair.webp',
    ),
    _HeroSlideData(
      title: 'Electrical & Plumbing',
      categoryId: 'cat_electrical',
      categorySlug: 'electrical-plumbing',
      imagePath: 'assets/images/electrical.jpg',
    ),
    _HeroSlideData(
      title: 'Salon & Spa',
      categoryId: 'cat_salon',
      categorySlug: 'salon-spa',
      imagePath: 'assets/images/Home-spa-women-banner.jpg',
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
    _typingTimer?.cancel();
    _typingPauseTimer?.cancel();
    _heroPageController.dispose();
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
      shadowColor: Colors.black.withOpacity(0.12),
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
            // Sticky Top Header (Deliver to • Add address + Notification Bell)
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
            ),
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

                      // 2. GREETING SECTION (Good morning/afternoon/evening pill + Welcome header + subtitle)
                      _buildGreetingSection(context),

                const SizedBox(height: 16),

                // 3. HERO CATEGORY CAROUSEL CARD (Photo + Indicators + Category Title)
                _buildHeroCard(context),

                const SizedBox(height: 14),

                // 4. SEARCH BAR (Search input + Mic + Orange search button)
                _buildSearchBar(context),

                const SizedBox(height: 18),

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

                // 3. UPCOMING BOOKING SECTION (when active bookings exist) OR WELCOME TO HOMECAREX! (New Customer Card)
                if (activeBookings.isNotEmpty)
                  _buildUpcomingSection(context, activeBookings.first)
                else
                  _buildWelcomeCustomerCard(context),

                const SizedBox(height: 24),

                // 4. BROWSE CATEGORIES (2x2 Grid matching Image 2)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Browse categories',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const CategoriesScreen()),
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
                ),

                const SizedBox(height: 12),

                // 2x2 Category Grid
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _buildCategoryGrid(catalog.categories),
                ),

                const SizedBox(height: 24),

                // 5. SERVICES FOR YOU (Recommended Services matching Image 2 & 3)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Services for you',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1E1B2E),
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // Horizontal scrolling list of service cards
                SizedBox(
                  height: 250,
                  child: catalog.services.isEmpty
                      ? const Center(child: CircularProgressIndicator(color: AppColors.brand))
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          scrollDirection: Axis.horizontal,
                          itemCount: catalog.services.length.clamp(0, 8),
                          itemBuilder: (context, index) {
                            final service = catalog.services[index];
                            final inCart = cart.hasItem(service.id);

                            return _buildServiceCard(context, service, inCart, cart);
                          },
                        ),
                ),

                const SizedBox(height: 24),

                // 6. OFFERS FOR YOU (Coupon card matching Image 3)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Offers for you',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1E1B2E),
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFEEF2FE), Color(0xFFEDF0FB)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFD9E1FA)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF1E1B2E).withValues(alpha: 0.05),
                          blurRadius: 18,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Left Text & Code Box
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                '20% off',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1E1B2E),
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                '20% off up to ₹500 on orders above ₹799.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF475569),
                                  height: 1.3,
                                ),
                              ),
                              const SizedBox(height: 14),

                              // Code tag + Orange Copy button
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: const Color(0xFFCBD5E1),
                                        style: BorderStyle.solid,
                                      ),
                                    ),
                                    child: const Text(
                                      'FESTIVE20',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.8,
                                        color: Color(0xFF1E1B2E),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  GestureDetector(
                                    onTap: () => _copyCouponCode('FESTIVE20'),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFF8A3D),
                                        borderRadius: BorderRadius.circular(16),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFFFF8A3D).withValues(alpha: 0.35),
                                            blurRadius: 8,
                                            offset: const Offset(0, 3),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(
                                            _copiedCoupon ? Icons.check_rounded : Icons.copy_rounded,
                                            size: 13,
                                            color: Colors.white,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            _copiedCoupon ? 'Copied' : 'Copy',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Right 3D Gift Box Icon
                        Image.asset(
                          'assets/icons/3d/gift.png',
                          width: 58,
                          height: 58,
                          errorBuilder: (_, __, ___) => const Text('🎁', style: TextStyle(fontSize: 44)),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

                  // Location Picker Dropdown Menu Overlay
                  if (_isLocationPickerOpen) ...[
                    Positioned.fill(
                      child: GestureDetector(
                        onTap: () => setState(() => _isLocationPickerOpen = false),
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          color: Colors.black.withOpacity(0.08),
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

  // 2x2 Category Grid matching Image 2
  Widget _buildCategoryGrid(List<CategoryModel> categories) {
    final List<Map<String, String>> defaultCategories = [
      {
        'name': 'Home Cleaning',
        'slug': 'home-cleaning',
        'image': 'assets/images/home-cleaning.webp',
        'count': '5 services',
      },
      {
        'name': 'Appliance Repair & Service',
        'slug': 'appliance-repair-service',
        'image': 'assets/images/appliance-repair.webp',
        'count': '5 services',
      },
      {
        'name': 'Salon & Spa',
        'slug': 'salon-spa',
        'image': 'assets/images/Home-spa-women-banner.jpg',
        'count': '5 services',
      },
      {
        'name': 'Electrical & Plumbing',
        'slug': 'electrical-plumbing',
        'image': 'assets/images/electrical.jpg',
        'count': '5 services',
      },
    ];

    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.95,
      ),
      itemCount: 4,
      itemBuilder: (context, index) {
        final def = defaultCategories[index];
        final cat = categories.length > index ? categories[index] : null;
        final name = cat != null && cat.name.isNotEmpty ? cat.name : def['name']!;
        final slug = cat != null && cat.slug.isNotEmpty ? cat.slug : def['slug']!;
        final countText = cat != null && cat.servicesCount > 0 ? '${cat.servicesCount} services' : def['count']!;
        final assetPath = def['image']!;

        return GestureDetector(
          onTap: () => _openCategory(context, slug),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.08),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
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
                    assetPath,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: const Color(0xFFEEECFB),
                      child: const Center(
                        child: Icon(Icons.home_repair_service_rounded, color: AppColors.brand, size: 36),
                      ),
                    ),
                  ),

                  // Dark Gradient Overlay
                  Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.transparent, Color(0xCC141224)],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.35, 1.0],
                      ),
                    ),
                  ),

                  // Circular arrow button in top-right
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.arrow_outward_rounded,
                          size: 15,
                          color: AppColors.brand,
                        ),
                      ),
                    ),
                  ),

                  // Title & count at bottom
                  Positioned(
                    bottom: 12,
                    left: 12,
                    right: 12,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          countText,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.85),
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
      },
    );
  }

  // Recommended Service Card matching Image 2 & 3
  Widget _buildServiceCard(
    BuildContext context,
    ServiceModel service,
    bool inCart,
    CartProvider cart,
  ) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ServiceDetailsScreen(service: service)),
        );
      },
      child: Container(
        width: 178,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1E1B2E).withValues(alpha: 0.06),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Service Photo
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: 112,
                width: double.infinity,
                child: service.imageUrl != null && service.imageUrl!.isNotEmpty
                    ? Image.network(
                        service.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _serviceFallbackImage(service),
                      )
                    : _serviceFallbackImage(service),
              ),
            ),

            const SizedBox(height: 10),

            // Service Title
            Text(
              service.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E1B2E),
              ),
            ),

            const SizedBox(height: 4),

            // Rating & Duration row
            Row(
              children: [
                const Icon(Icons.star_rounded, size: 14, color: Color(0xFFF59E0B)),
                const SizedBox(width: 2),
                Text(
                  service.rating.toStringAsFixed(1),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
                const SizedBox(width: 6),
                const Text('·', style: TextStyle(color: Color(0xFF94A3B8))),
                const SizedBox(width: 6),
                Text(
                  '${(service.durationMinutes / 60).toStringAsFixed(service.durationMinutes % 60 == 0 ? 0 : 1)} hrs',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),

            const Spacer(),

            // Price & Book Button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '₹${service.price.toInt()}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    if (inCart) {
                      cart.removeItem(service.id);
                    } else {
                      cart.addItem(service);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: inCart ? const Color(0xFFEF4444) : const Color(0xFFFF8A3D),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: (inCart ? const Color(0xFFEF4444) : const Color(0xFFFF8A3D))
                              .withValues(alpha: 0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Text(
                      inCart ? 'Remove' : 'Book',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
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

  Widget _serviceFallbackImage(ServiceModel s) {
    final asset = ServiceImageResolver.resolve(s.slug, s.name);

    return Image.asset(
      asset,
      fit: BoxFit.cover,
      alignment: ServiceImageResolver.resolveFocus(s.slug, s.name),
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFFEEECFB),
        child: Center(
          child: Image.asset(
            Icon3DResolver.resolve([s.name, s.slug]),
            width: 40,
            height: 40,
            errorBuilder: (_, __, ___) => const Icon(Icons.build_rounded, color: AppColors.brand),
          ),
        ),
      ),
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
    final currentSlide = _heroSlides[_heroPageIndex];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Photo Carousel Container
          Container(
            height: 185,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.12),
                  blurRadius: 22,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(26),
              child: Stack(
                children: [
                  PageView.builder(
                    controller: _heroPageController,
                    itemCount: _heroSlides.length,
                    onPageChanged: (idx) {
                      setState(() => _heroPageIndex = idx);
                    },
                    itemBuilder: (context, index) {
                      final slide = _heroSlides[index];
                      return GestureDetector(
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ServicesScreen(
                                initialCategory: slide.categoryId,
                              ),
                            ),
                          );
                        },
                        child: Image.asset(
                          slide.imagePath,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          errorBuilder: (_, __, ___) => Container(
                            color: const Color(0xFFEEECFB),
                            child: const Center(
                              child: Icon(
                                Icons.image_outlined,
                                size: 40,
                                color: AppColors.brand,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),

                  // Indicator dots on the bottom right of the photo (matching web phone preview!)
                  Positioned(
                    bottom: 12,
                    right: 14,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(_heroSlides.length, (i) {
                        final isActive = i == _heroPageIndex;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          margin: const EdgeInsets.symmetric(horizontal: 2.5),
                          height: 6,
                          width: isActive ? 24 : 6,
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

          const SizedBox(height: 12),

          // 2. Category Title Strip below photo
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ServicesScreen(
                    initialCategory: currentSlide.categoryId,
                  ),
                ),
              );
            },
            child: Text(
              currentSlide.title,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E1B2E),
                letterSpacing: -0.4,
              ),
            ),
          ),
        ],
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
