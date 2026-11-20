import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/service_model.dart';
import '../../core/utils/service_image_resolver.dart';
import '../../providers/catalog_provider.dart';
import '../bookings/book_service_flow_screen.dart';

class ServiceDetailsScreen extends StatefulWidget {
  final ServiceModel service;

  const ServiceDetailsScreen({super.key, required this.service});

  @override
  State<ServiceDetailsScreen> createState() => _ServiceDetailsScreenState();
}

class _ServiceDetailsScreenState extends State<ServiceDetailsScreen> {
  late PageController _pageController;
  late ScrollController _scrollController;
  int _activePhotoIndex = 0;
  String _activeSection = 'overview';
  bool _isDescriptionExpanded = false;
  final Set<String> _expandedFaqs = {'faq-1'};

  // GlobalKeys for scrolling to sections
  final GlobalKey _overviewKey = GlobalKey();
  final GlobalKey _includedKey = GlobalKey();
  final GlobalKey _addOnsKey = GlobalKey();
  final GlobalKey _faqsKey = GlobalKey();
  final GlobalKey _reviewsKey = GlobalKey();

  late List<String> _photos;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _scrollController = ScrollController();
    _photos = ServiceImageResolver.resolveGallery(widget.service.slug, widget.service.name);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToSection(GlobalKey key, String sectionId) {
    setState(() => _activeSection = sectionId);
    final context = key.currentContext;
    if (context != null) {
      Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  String _getCategoryName(BuildContext context) {
    final catProvider = context.watch<CatalogProvider>();
    final cat = catProvider.categories.where((c) => c.id == widget.service.categoryId || c.slug == widget.service.categoryId).firstOrNull;
    if (cat != null && cat.name.isNotEmpty) return cat.name;

    final n = widget.service.name.toLowerCase();
    final s = widget.service.slug.toLowerCase();
    if (s.contains('ac-') || s.contains('appliance') || n.contains('repair') || n.contains('oven') || n.contains('washing')) {
      return 'Appliance Repair & Service';
    }
    if (s.contains('clean') || n.contains('clean')) return 'Home Cleaning';
    if (s.contains('salon') || s.contains('spa') || n.contains('massage') || n.contains('haircut')) return 'Salon & Spa';
    if (s.contains('electr') || s.contains('plumb')) return 'Electrical & Plumbing';
    if (s.contains('paint')) return 'Painting & Waterproofing';
    if (s.contains('pest')) return 'Pest Control';
    if (s.contains('carpent')) return 'Carpentry';
    return 'Home Service';
  }

  String _formatDuration(int minutes) {
    if (minutes <= 0) return '1 hr';
    if (minutes < 60) return '$minutes mins';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m > 0 ? '$h hr $m mins' : '$h hr${h > 1 ? 's' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.service;
    final categoryName = _getCategoryName(context);
    final focus = ServiceImageResolver.resolveFocus(s.slug, s.name);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: Column(
          children: [
            // 1. TOP APP BAR: ← Service details
            _buildTopAppBar(context),

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                controller: _scrollController,
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),

                    // 2. HERO GALLERY (Carousel, Zoom button, Chevrons, 1/4 badge)
                    _buildHeroGallery(focus),

                    // 3. THUMBNAILS ROW
                    if (_photos.length > 1) ...[
                      const SizedBox(height: 10),
                      _buildThumbnailsRow(),
                    ],

                    const SizedBox(height: 16),

                    // 4. MOBILE INFO BLOCK (Category pill, Share, Title, Rating/Reviews/Duration, Availability badge)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _buildMobileInfo(categoryName),
                    ),

                    const SizedBox(height: 20),

                    // 5. IN-PAGE SECTION NAVIGATION TABS (Overview, Included, Add-ons, FAQs, Reviews)
                    _buildSectionNav(),

                    const SizedBox(height: 20),

                    // 6. SECTION: ABOUT THIS SERVICE (Overview)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildAboutSection(),
                          const SizedBox(height: 24),

                          // 7. SECTION: WHAT'S INCLUDED
                          _buildInclusionSection(),
                          const SizedBox(height: 24),

                          // 8. SECTION: OPTIONAL ADD-ONS
                          _buildAddOnsSection(),
                          const SizedBox(height: 24),

                          // 9. SECTION: FAQS
                          _buildFaqSection(),
                          const SizedBox(height: 24),

                          // 10. SECTION: REVIEWS
                          _buildReviewsSection(),
                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 11. STICKY BOTTOM BAR: Starting at ₹599 + Book now
            _buildStickyBottomBar(context),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // TOP APP BAR (← Service details)
  // --------------------------------------------------------------------------
  Widget _buildTopAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: Color(0xFF1E1B2E),
                ),
                SizedBox(width: 8),
                Text(
                  'Service details',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HERO GALLERY (Carousel)
  // --------------------------------------------------------------------------
  Widget _buildHeroGallery(Alignment focus) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      height: 260,
      decoration: BoxDecoration(
        color: const Color(0xFFE9EBFF),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF11104F).withValues(alpha: 0.12),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          children: [
            // Slide PageView
            PageView.builder(
              controller: _pageController,
              itemCount: _photos.length,
              onPageChanged: (i) => setState(() => _activePhotoIndex = i),
              itemBuilder: (ctx, i) {
                final photo = _photos[i];
                return GestureDetector(
                  onTap: () => _openLightbox(i),
                  child: Image.asset(
                    photo,
                    fit: BoxFit.cover,
                    alignment: focus,
                    errorBuilder: (_, __, ___) => Container(
                      color: const Color(0xFFEEECFB),
                      child: const Center(
                        child: Icon(Icons.build_rounded, size: 54, color: AppColors.brand),
                      ),
                    ),
                  ),
                );
              },
            ),

            // Top-Right Zoom / Fullscreen Button
            Positioned(
              top: 12,
              right: 12,
              child: GestureDetector(
                onTap: () => _openLightbox(_activePhotoIndex),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
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
                      Icons.fullscreen_rounded,
                      size: 22,
                      color: Color(0xFF1E1B2E),
                    ),
                  ),
                ),
              ),
            ),

            // Left Chevron (Previous)
            if (_activePhotoIndex > 0)
              Positioned(
                left: 12,
                top: 0,
                bottom: 0,
                child: Center(
                  child: GestureDetector(
                    onTap: () {
                      _pageController.previousPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.9),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.chevron_left_rounded,
                        size: 24,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                  ),
                ),
              ),

            // Right Chevron (Next)
            if (_activePhotoIndex < _photos.length - 1)
              Positioned(
                right: 12,
                top: 0,
                bottom: 0,
                child: Center(
                  child: GestureDetector(
                    onTap: () {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.9),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.chevron_right_rounded,
                        size: 24,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                  ),
                ),
              ),

            // Counter Badge at Bottom-Left: 1/4
            Positioned(
              bottom: 12,
              left: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  '${_activePhotoIndex + 1}/${_photos.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // THUMBNAILS ROW
  // --------------------------------------------------------------------------
  Widget _buildThumbnailsRow() {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: _photos.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (ctx, i) {
          final isSelected = i == _activePhotoIndex;
          return GestureDetector(
            onTap: () {
              _pageController.animateToPage(
                i,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 72,
              height: 52,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isSelected ? const Color(0xFF4338CA) : Colors.transparent,
                  width: 2.2,
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Opacity(
                  opacity: isSelected ? 1.0 : 0.6,
                  child: Image.asset(
                    _photos[i],
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // MOBILE INFO BLOCK
  // --------------------------------------------------------------------------
  Widget _buildMobileInfo(String categoryName) {
    final s = widget.service;
    final ratingCountFormatted = s.reviewsCount > 100
        ? s.reviewsCount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')
        : '3,210';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category pill & Share button row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFEEECFB),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                categoryName,
                style: const TextStyle(
                  color: Color(0xFF4338CA),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: 'Check out ${s.name} on HomeCareX!'));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Service link copied to clipboard!')),
                );
              },
              child: Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.share_outlined,
                  size: 18,
                  color: Color(0xFF1E1B2E),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // Service Title
        Text(
          s.name,
          style: const TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w800,
            color: Color(0xFF1E1B2E),
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 6),

        // Rating, Reviews & Duration Row
        Row(
          children: [
            const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 18),
            const SizedBox(width: 4),
            Text(
              s.rating.toStringAsFixed(1),
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E1B2E),
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => _scrollToSection(_reviewsKey, 'reviews'),
              child: Text(
                '· $ratingCountFormatted reviews',
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text('·', style: TextStyle(color: Color(0xFF94A3B8))),
            const SizedBox(width: 8),
            const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF64748B)),
            const SizedBox(width: 4),
            Text(
              _formatDuration(s.durationMinutes),
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Availability Badge (Slots open this week)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: const Color(0xFFEAF7F0),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFBBE5CB), width: 1.2),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF16A34A),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Slots open this week',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF14532D),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // SECTION NAV TABS (Overview, Included, Add-ons, FAQs, Reviews)
  // --------------------------------------------------------------------------
  Widget _buildSectionNav() {
    final sections = [
      {'id': 'overview', 'label': 'Overview', 'key': _overviewKey},
      {'id': 'included', 'label': 'Included', 'key': _includedKey},
      {'id': 'add-ons', 'label': 'Add-ons', 'key': _addOnsKey},
      {'id': 'faqs', 'label': 'FAQs', 'key': _faqsKey},
      {'id': 'reviews', 'label': 'Reviews', 'key': _reviewsKey},
    ];

    return Container(
      height: 40,
      margin: const EdgeInsets.symmetric(horizontal: 12),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: sections.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          final item = sections[i];
          final isActive = _activeSection == item['id'];
          return GestureDetector(
            onTap: () => _scrollToSection(item['key'] as GlobalKey, item['id'] as String),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFF4338CA) : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isActive ? const Color(0xFF4338CA) : const Color(0xFFE2E8F0),
                ),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: const Color(0xFF4338CA).withValues(alpha: 0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Text(
                item['label'] as String,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isActive ? Colors.white : const Color(0xFF64748B),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 1. ABOUT THIS SERVICE SECTION (Overview)
  // --------------------------------------------------------------------------
  Widget _buildAboutSection() {
    final desc = widget.service.description.isNotEmpty
        ? widget.service.description
        : 'Complete multi-point diagnostic check, jet pump indoor and outdoor unit cleaning, refrigerant gas level measurement, and optimal cooling test by verified experts.';

    return Container(
      key: _overviewKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'About this service',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            desc,
            maxLines: _isDescriptionExpanded ? null : 3,
            overflow: _isDescriptionExpanded ? null : TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              height: 1.55,
              color: Color(0xFF475569),
            ),
          ),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () => setState(() => _isDescriptionExpanded = !_isDescriptionExpanded),
            child: Text(
              _isDescriptionExpanded ? 'Show less' : 'Read more',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF4338CA),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 2. WHAT'S INCLUDED SECTION
  // --------------------------------------------------------------------------
  Widget _buildInclusionSection() {
    final inclusions = widget.service.inclusions.isNotEmpty
        ? widget.service.inclusions
        : [
            'Complete AC gas level check and leak detection',
            'Deep coil inspection and jet pump cleaning',
            'Refrigerant gas top-up with digital manifold gauge',
            'Post-service cooling efficiency temperature check',
            '30-day HomeCareX service guarantee',
          ];

    final exclusions = [
      'Compressor replacement or major electrical motor repair',
      'Piping and cabling over 3 meters',
    ];

    return Container(
      key: _includedKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "What's included",
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 12),

          // You get (Card)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF1FAF5),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFBBE5CB), width: 1.2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'You get',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF14532D),
                  ),
                ),
                const SizedBox(height: 10),
                ...inclusions.map(
                  (item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: Color(0xFFD3F0DF),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.check_rounded, size: 14, color: Color(0xFF15803D)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            item,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF1E1B2E),
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Not covered (Card)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Not covered',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 10),
                ...exclusions.map(
                  (item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF1F5F9),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close_rounded, size: 14, color: Color(0xFF94A3B8)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            item,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF64748B),
                              height: 1.4,
                            ),
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
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 3. OPTIONAL ADD-ONS SECTION
  // --------------------------------------------------------------------------
  Widget _buildAddOnsSection() {
    final addOns = [
      {'name': 'Anti-bacterial filter coating', 'price': 199},
      {'name': 'Condenser foam wash & sanitize', 'price': 299},
      {'name': 'Remote controller & thermostat check', 'price': 99},
    ];

    return Container(
      key: _addOnsKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Optional add-ons',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Extras you can add while booking.',
            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: addOns.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
              itemBuilder: (ctx, i) {
                final item = addOns[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEECFB),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.add_rounded, size: 18, color: Color(0xFF4338CA)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          item['name'] as String,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                      ),
                      Text(
                        '+₹${item['price']}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF4338CA),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 4. FAQS SECTION
  // --------------------------------------------------------------------------
  Widget _buildFaqSection() {
    final faqs = [
      {
        'id': 'faq-1',
        'q': 'How long does AC service & gas refill take?',
        'a': 'Usually 60 to 90 minutes depending on the unit condition and refrigerant pressure.',
      },
      {
        'id': 'faq-2',
        'q': 'What refrigerant gas is used?',
        'a': '100% genuine R32 or R410A refrigerant gas verified with manufacturer grade pressure testing.',
      },
      {
        'id': 'faq-3',
        'q': 'Is there any warranty on the service?',
        'a': 'Yes, you get a 30-day HomeCareX post-service guarantee covering leaks and cooling performance.',
      },
      {
        'id': 'faq-4',
        'q': 'Can I reschedule or cancel?',
        'a': 'Yes, free rescheduling or cancellation is allowed up to 2 hours before the scheduled slot.',
      },
    ];

    return Container(
      key: _faqsKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Questions people ask',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: faqs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, i) {
              final item = faqs[i];
              final id = item['id']!;
              final isOpen = _expandedFaqs.contains(id);

              return Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isOpen ? const Color(0xFF4338CA).withValues(alpha: 0.3) : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Column(
                  children: [
                    InkWell(
                      onTap: () {
                        setState(() {
                          if (isOpen) {
                            _expandedFaqs.remove(id);
                          } else {
                            _expandedFaqs.add(id);
                          }
                        });
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                item['q']!,
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1E1B2E),
                                ),
                              ),
                            ),
                            Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                color: isOpen ? const Color(0xFF4338CA) : const Color(0xFFEEECFB),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                isOpen ? Icons.remove_rounded : Icons.add_rounded,
                                size: 18,
                                color: isOpen ? Colors.white : const Color(0xFF4338CA),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (isOpen)
                      Padding(
                        padding: const EdgeInsets.only(left: 16, right: 16, bottom: 14),
                        child: Text(
                          item['a']!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF64748B),
                            height: 1.5,
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 5. REVIEWS SECTION
  // --------------------------------------------------------------------------
  Widget _buildReviewsSection() {
    final reviews = [
      {
        'name': 'Rajesh Sharma',
        'date': '2 days ago',
        'rating': 5.0,
        'comment': 'Prompt arrival and very polite technician. Cooling restored completely within an hour!',
      },
      {
        'name': 'Priya Menon',
        'date': '1 week ago',
        'rating': 5.0,
        'comment': 'Professional service. Showed the gas pressure before and after refill. Highly recommended!',
      },
      {
        'name': 'Vikram Rao',
        'date': '2 weeks ago',
        'rating': 4.5,
        'comment': 'Good service overall, cleaned both outdoor and indoor units neatly.',
      },
    ];

    return Container(
      key: _reviewsKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Customer Reviews',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 12),

          // Rating summary card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.service.rating.toStringAsFixed(1),
                      style: const TextStyle(
                        fontSize: 42,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                    const Row(
                      children: [
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 18),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 18),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 18),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 18),
                        Icon(Icons.star_half_rounded, color: Color(0xFFF59E0B), size: 18),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text('Based on 3,210 verified reviews', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Review list
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: reviews.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) {
              final r = reviews[i];
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFF1F5F9)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          r['name'] as String,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                        ),
                        Text(
                          r['date'] as String,
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11.5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Row(
                      children: [
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                        Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      r['comment'] as String,
                      style: const TextStyle(color: Color(0xFF475569), fontSize: 12.5, height: 1.4),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STICKY BOTTOM BAR (Starting at ₹599 + Book now)
  // --------------------------------------------------------------------------
  Widget _buildStickyBottomBar(BuildContext context) {
    final s = widget.service;
    final priceVal = s.price.toInt();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.1),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Starting at + Price
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Starting at',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 1),
              Text(
                '₹$priceVal',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E1B2E),
                ),
              ),
            ],
          ),

          // Book now Button
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookServiceFlowScreen(service: s),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4338CA),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              elevation: 0,
            ),
            child: const Text(
              'Book now',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // FULLSCREEN LIGHTBOX
  // --------------------------------------------------------------------------
  void _openLightbox(int initialIndex) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.95),
      builder: (ctx) {
        int currentIndex = initialIndex;
        final pageCtrl = PageController(initialPage: initialIndex);

        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return Scaffold(
              backgroundColor: Colors.transparent,
              body: Stack(
                children: [
                  // Fullscreen PageView
                  PageView.builder(
                    controller: pageCtrl,
                    itemCount: _photos.length,
                    onPageChanged: (i) => setDialogState(() => currentIndex = i),
                    itemBuilder: (c, idx) {
                      return InteractiveViewer(
                        minScale: 1.0,
                        maxScale: 3.5,
                        child: Center(
                          child: Image.asset(
                            _photos[idx],
                            fit: BoxFit.contain,
                          ),
                        ),
                      );
                    },
                  ),

                  // Top header with title and close button
                  Positioned(
                    top: 10,
                    left: 20,
                    right: 20,
                    child: SafeArea(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${currentIndex + 1} / ${_photos.length}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => Navigator.pop(dialogCtx),
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.25),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
