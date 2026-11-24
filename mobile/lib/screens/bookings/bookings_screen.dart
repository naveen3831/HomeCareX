import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/booking_model.dart';
import '../../core/utils/service_image_resolver.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../catalog/services_screen.dart';
import '../auth/login_screen.dart';
import 'booking_tracking_screen.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  String _activeTab = 'upcoming'; // 'upcoming', 'live', 'overdue', 'completed', 'cancelled'
  String _searchQuery = '';
  late final TextEditingController _searchController;
  String _sortBy = 'soonest'; // 'soonest', 'latest', 'amount_desc', 'amount_asc'

  final List<Map<String, String>> _tabs = const [
    {'id': 'upcoming', 'label': 'Upcoming'},
    {'id': 'live', 'label': 'Live'},
    {'id': 'overdue', 'label': 'Overdue'},
    {'id': 'completed', 'label': 'Completed'},
    {'id': 'cancelled', 'label': 'Cancelled'},
  ];

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final auth = context.read<AuthProvider>();
        if (auth.isAuthenticated) {
          context.read<BookingProvider>().fetchBookings();
        }
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matchesTab(BookingModel b, String tab) {
    final status = b.status.toLowerCase().trim();
    final now = DateTime.now();

    switch (tab) {
      case 'upcoming':
        return status == 'pending_payment' ||
            status == 'confirmed' ||
            status == 'created' ||
            status == 'pending' ||
            status == 'searching_for_partner' ||
            status == 'assigned' ||
            (b.scheduledAt.isAfter(now) && status != 'completed' && status != 'cancelled' && status != 'refunded');

      case 'live':
        return status == 'in_progress' || status == 'en_route' || status == 'arrived';

      case 'overdue':
        return b.scheduledAt.isBefore(now) &&
            status != 'completed' &&
            status != 'cancelled' &&
            status != 'refunded' &&
            status != 'in_progress' &&
            status != 'en_route' &&
            status != 'arrived';

      case 'completed':
        return status == 'completed' || status == 'rated';

      case 'cancelled':
        return status == 'cancelled' ||
            status == 'refunded' ||
            status == 'cancelled_by_customer' ||
            status == 'cancelled_by_partner' ||
            status == 'cancelled_by_admin' ||
            status == 'no_show';

      default:
        return true;
    }
  }

  List<BookingModel> _getFilteredBookings(List<BookingModel> all) {
    var filtered = all.where((b) {
      final matchesTab = _matchesTab(b, _activeTab);
      final q = _searchQuery.trim().toLowerCase();
      final matchesQuery = q.isEmpty ||
          b.serviceTitle.toLowerCase().contains(q) ||
          b.id.toLowerCase().contains(q) ||
          b.address.toLowerCase().contains(q);
      return matchesTab && matchesQuery;
    }).toList();

    if (_sortBy == 'soonest') {
      filtered.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    } else if (_sortBy == 'latest') {
      filtered.sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
    } else if (_sortBy == 'amount_desc') {
      filtered.sort((a, b) => b.amount.compareTo(a.amount));
    } else if (_sortBy == 'amount_asc') {
      filtered.sort((a, b) => a.amount.compareTo(b.amount));
    }

    return filtered;
  }

  String _getEmptyTitle() {
    switch (_activeTab) {
      case 'upcoming':
        return 'No upcoming bookings';
      case 'live':
        return 'Nothing happening right now';
      case 'overdue':
        return 'Nothing overdue';
      case 'completed':
        return 'No completed bookings';
      case 'cancelled':
        return 'No cancelled bookings';
      default:
        return 'No bookings found';
    }
  }

  String _getEmptySubtitle() {
    switch (_activeTab) {
      case 'upcoming':
        return "Services you've scheduled will show up here.";
      case 'live':
        return 'When a partner is on the way or working, you can follow it live here.';
      case 'overdue':
        return 'Bookings whose scheduled time has passed will show up here.';
      case 'completed':
        return 'Finished services will show up here.';
      case 'cancelled':
        return 'Cancelled bookings and their refunds will show up here.';
      default:
        return 'Try adjusting your search or filters.';
    }
  }

  void _openFilterModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Sort Bookings',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setModalState(() => _sortBy = 'soonest');
                          setState(() => _sortBy = 'soonest');
                        },
                        child: const Text('Reset', style: TextStyle(color: AppColors.brand)),
                      ),
                    ],
                  ),
                  const Divider(),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 10,
                    children: [
                      _buildSortChip('Soonest First', _sortBy == 'soonest', () {
                        setModalState(() => _sortBy = 'soonest');
                        setState(() => _sortBy = 'soonest');
                      }),
                      _buildSortChip('Latest First', _sortBy == 'latest', () {
                        setModalState(() => _sortBy = 'latest');
                        setState(() => _sortBy = 'latest');
                      }),
                      _buildSortChip('Amount: High to Low', _sortBy == 'amount_desc', () {
                        setModalState(() => _sortBy = 'amount_desc');
                        setState(() => _sortBy = 'amount_desc');
                      }),
                      _buildSortChip('Amount: Low to High', _sortBy == 'amount_asc', () {
                        setModalState(() => _sortBy = 'amount_asc');
                        setState(() => _sortBy = 'amount_asc');
                      }),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.brand,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                      ),
                      child: const Text('Apply', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSortChip(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.brand : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF1E1B2E),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isAuthenticated) {
      return LoginScreen(
        returnUrl: '/customer/bookings',
        onBackToHome: () {
          if (Navigator.canPop(context)) {
            Navigator.pop(context);
          }
        },
      );
    }

    final isGuest = !auth.isAuthenticated;
    final canPop = Navigator.canPop(context);
    final showBackButton = !isGuest && canPop;

    final bookingProv = context.watch<BookingProvider>();
    final filteredBookings = _getFilteredBookings(bookingProv.bookings);
    final hasActiveFilter = _sortBy != 'soonest';

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Sticky Top Header (My Bookings)
            Container(
              color: const Color(0xFFFAFAFC),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              alignment: Alignment.centerLeft,
              child: showBackButton
                  ? GestureDetector(
                      onTap: () {
                        if (Navigator.canPop(context)) {
                          Navigator.pop(context);
                        }
                      },
                      child: const Padding(
                        padding: EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.arrow_back_rounded,
                              size: 22,
                              color: Color(0xFF1E1B2E),
                            ),
                            SizedBox(width: 8),
                            Text(
                              'My Bookings',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1E1B2E),
                                letterSpacing: -0.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : const Text(
                      'My Bookings',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E1B2E),
                        letterSpacing: -0.4,
                      ),
                    ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => context.read<BookingProvider>().fetchBookings(),
                color: AppColors.brand,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Subtitle
                      const Text(
                        'Manage and track your service bookings',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w400,
                  ),
                ),

                const SizedBox(height: 14),

                // 2. FULL-WIDTH PURPLE CTA BANNER: + Book a service >
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ServicesScreen()),
                    );
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4338CA),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF4338CA).withValues(alpha: 0.25),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.add_rounded, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Book a service',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        Icon(Icons.chevron_right_rounded, color: Colors.white, size: 22),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // 3. SEARCH & FILTER ROW
                Row(
                  children: [
                    // Search Pill Input
                    Expanded(
                      child: Container(
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF1E1B2E).withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 14),
                            const Icon(
                              Icons.search_rounded,
                              size: 20,
                              color: Color(0xFF94A3B8),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                onChanged: (val) => setState(() => _searchQuery = val),
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF1E1B2E),
                                ),
                                decoration: const InputDecoration(
                                  hintText: 'Search by service or booking ID...',
                                  hintStyle: TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF94A3B8),
                                    fontWeight: FontWeight.w400,
                                  ),
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  disabledBorder: InputBorder.none,
                                  errorBorder: InputBorder.none,
                                  filled: false,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                            if (_searchQuery.isNotEmpty)
                              GestureDetector(
                                onTap: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 10),
                                  child: Icon(Icons.close_rounded, size: 18, color: Color(0xFF94A3B8)),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(width: 10),

                    // Filter Button
                    GestureDetector(
                      onTap: () => _openFilterModal(context),
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: hasActiveFilter ? const Color(0xFFEEECFB) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: hasActiveFilter ? AppColors.brand : const Color(0xFFE2E8F0),
                            width: hasActiveFilter ? 1.5 : 1.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF1E1B2E).withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Icon(
                            Icons.tune_rounded,
                            size: 20,
                            color: hasActiveFilter ? AppColors.brand : const Color(0xFF1E1B2E),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 14),

                // 4. HORIZONTAL STATUS PILLS TABS
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _tabs.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final tab = _tabs[index];
                      final isSelected = _activeTab == tab['id'];

                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _activeTab = tab['id']!;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF4338CA) : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? const Color(0xFF4338CA) : const Color(0xFFE2E8F0),
                              width: 1.0,
                            ),
                            boxShadow: [
                              if (isSelected)
                                BoxShadow(
                                  color: const Color(0xFF4338CA).withValues(alpha: 0.25),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                )
                              else
                                BoxShadow(
                                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.02),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              tab['label']!,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                color: isSelected ? Colors.white : const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 20),

                // 5. CONTENT: EMPTY STATE OR BOOKING CARDS
                if (bookingProv.isLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator(color: AppColors.brand)),
                  )
                else if (filteredBookings.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Soft open tray/inbox icon
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.03),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.inbox_outlined,
                                size: 26,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ),

                          const SizedBox(height: 16),

                          Text(
                            _getEmptyTitle(),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),

                          const SizedBox(height: 6),

                          Text(
                            _getEmptySubtitle(),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF64748B),
                            ),
                          ),

                          const SizedBox(height: 18),

                          OutlinedButton(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const ServicesScreen()),
                              );
                            },
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF1E1B2E),
                              side: const BorderSide(color: Color(0xFFD1D5DB)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
                            ),
                            child: const Text(
                              'Book a service',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredBookings.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final b = filteredBookings[index];
                      return _buildBookingCard(b);
                    },
                  ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBookingCard(BookingModel b) {
    final imagePath = ServiceImageResolver.resolve('', b.serviceTitle);
    final focus = ServiceImageResolver.resolveFocus('', b.serviceTitle);
    final bookingCode = '#HCX-${b.id.length >= 4 ? b.id.substring(b.id.length - 4).toUpperCase() : b.id.toUpperCase()}';

    Color badgeBg;
    Color badgeText;
    final st = b.status.toLowerCase();
    if (st.contains('confirm') || st.contains('created')) {
      badgeBg = const Color(0xFFDCFCE7);
      badgeText = const Color(0xFF15803D);
    } else if (st.contains('progress') || st.contains('route') || st.contains('arrived')) {
      badgeBg = const Color(0xFFEFF6FF);
      badgeText = const Color(0xFF1D4ED8);
    } else if (st.contains('cancel') || st.contains('refund')) {
      badgeBg = const Color(0xFFFEE2E2);
      badgeText = const Color(0xFFB91C1C);
    } else if (st.contains('payment')) {
      badgeBg = const Color(0xFFFFF7ED);
      badgeText = const Color(0xFFC2410C);
    } else {
      badgeBg = const Color(0xFFEEECFB);
      badgeText = AppColors.brand;
    }

    final dateStr = '${b.scheduledAt.day} ${_monthName(b.scheduledAt.month)} ${b.scheduledAt.year}';
    final timeStr = '${b.scheduledAt.hour > 12 ? b.scheduledAt.hour - 12 : (b.scheduledAt.hour == 0 ? 12 : b.scheduledAt.hour)}:${b.scheduledAt.minute.toString().padLeft(2, '0')} ${b.scheduledAt.hour >= 12 ? 'PM' : 'AM'}';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Thumbnail + Title + Status Badge + Booking Code
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Image.asset(
                    imagePath,
                    fit: BoxFit.cover,
                    alignment: focus,
                    errorBuilder: (_, __, ___) => Container(
                      color: const Color(0xFFEEECFB),
                      child: const Center(
                        child: Icon(Icons.home_repair_service_rounded, color: AppColors.brand, size: 24),
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: badgeBg,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            b.status.replaceAll('_', ' ').toUpperCase(),
                            style: TextStyle(
                              color: badgeText,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Text(
                          bookingCode,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF94A3B8),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 5),

                    Text(
                      b.serviceTitle,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E1B2E),
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // 2x2 Info Grid in light rounded box
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F9FC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_today_rounded, size: 13, color: Color(0xFF94A3B8)),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              dateStr,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E1B2E)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF94A3B8)),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              timeStr,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E1B2E)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.account_balance_wallet_outlined, size: 14, color: Color(0xFF94A3B8)),
                          const SizedBox(width: 5),
                          Text(
                            '₹${b.amount.toInt()}',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E1B2E)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF94A3B8)),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              b.partnerName ?? 'Partner Assigned',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E1B2E)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Bottom Action Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  b.address,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => BookingTrackingScreen(booking: b)),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6.5),
                  decoration: BoxDecoration(
                    color: AppColors.brand,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.navigation_rounded, size: 13, color: Colors.white),
                      SizedBox(width: 4),
                      Text(
                        'Track',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
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
    );
  }

  String _monthName(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (month >= 1 && month <= 12) return months[month - 1];
    return '';
  }
}
