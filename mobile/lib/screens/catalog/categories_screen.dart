import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/category_model.dart';
import '../../core/models/service_model.dart';
import '../../core/utils/service_image_resolver.dart';
import '../../providers/catalog_provider.dart';
import 'service_details_screen.dart';
import 'services_screen.dart';

class _CategoryTheme {
  final String imagePath;
  final Color badgeBg;
  final Color badgeBorder;
  final Color iconColor;
  final IconData icon;

  const _CategoryTheme({
    required this.imagePath,
    required this.badgeBg,
    required this.badgeBorder,
    required this.iconColor,
    required this.icon,
  });
}

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  static const List<String> _preferredOrder = [
    'appliance-repair-service',
    'appliance-repair',
    'salon-spa',
    'home-cleaning',
    'electrical-plumbing',
    'painting-waterproofing',
    'painting',
    'pest-control',
    'carpentry-furniture-assembly',
    'carpentry',
  ];

  static int _getPriority(String slug) {
    final s = slug.toLowerCase();
    final idx = _preferredOrder.indexWhere((p) => p == s || s.contains(p) || p.contains(s));
    return idx == -1 ? 999 : idx;
  }

  static _CategoryTheme _getCategoryTheme(String slug, String name) {
    final s = slug.toLowerCase();
    final n = name.toLowerCase();

    if (s.contains('appliance') || n.contains('appliance')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/appliance-repair.webp',
        badgeBg: Color(0xFFEFF6FF),
        badgeBorder: Color(0xFFDBEAFE),
        iconColor: Color(0xFF2563EB),
        icon: Icons.build_rounded,
      );
    }
    if (s.contains('salon') || s.contains('spa') || n.contains('salon') || n.contains('spa')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/Home-spa-women-banner.jpg',
        badgeBg: Color(0xFFFAF5FF),
        badgeBorder: Color(0xFFF3E8FF),
        iconColor: Color(0xFF9333EA),
        icon: Icons.spa_rounded,
      );
    }
    if (s.contains('clean') || n.contains('clean')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/home-cleaning.webp',
        badgeBg: Color(0xFFECFDF5),
        badgeBorder: Color(0xFFD1FAE5),
        iconColor: Color(0xFF059669),
        icon: Icons.cleaning_services_rounded,
      );
    }
    if (s.contains('electrical') || s.contains('plumb') || n.contains('electrical') || n.contains('plumb')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/electrical.jpg',
        badgeBg: Color(0xFFFFFBEB),
        badgeBorder: Color(0xFFFEF3C7),
        iconColor: Color(0xFFD97706),
        icon: Icons.bolt_rounded,
      );
    }
    if (s.contains('paint') || n.contains('paint') || s.contains('waterproof')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/painting-category.webp',
        badgeBg: Color(0xFFFFF1F2),
        badgeBorder: Color(0xFFFFE4E6),
        iconColor: Color(0xFFE11D48),
        icon: Icons.format_paint_rounded,
      );
    }
    if (s.contains('pest') || n.contains('pest')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/pest-control-clean.webp',
        badgeBg: Color(0xFFF0FDFA),
        badgeBorder: Color(0xFFCCFBF1),
        iconColor: Color(0xFF0D9488),
        icon: Icons.pest_control_rounded,
      );
    }
    if (s.contains('carpent') || n.contains('carpent') || s.contains('furniture')) {
      return const _CategoryTheme(
        imagePath: 'assets/images/furniture-assembly.jpg',
        badgeBg: Color(0xFFFFF7ED),
        badgeBorder: Color(0xFFFFEDD5),
        iconColor: Color(0xFFEA580C),
        icon: Icons.handyman_rounded,
      );
    }
    return const _CategoryTheme(
      imagePath: 'assets/images/home-cleaning.webp',
      badgeBg: Color(0xFFEEECFB),
      badgeBorder: Color(0xFFE0E7FF),
      iconColor: Color(0xFF4338CA),
      icon: Icons.auto_awesome_rounded,
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _openCategory(CategoryModel cat) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ServicesScreen(initialCategory: cat.id),
      ),
    );
  }

  String _formatDuration(int minutes) {
    if (minutes < 60) return '$minutes min';
    final hrs = minutes ~/ 60;
    final rem = minutes % 60;
    if (rem == 0) return '$hrs hr';
    return '$hrs hr $rem min';
  }

  void _showContactSupportSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Contact Support',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1B2E),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(ctx),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Our customer support team is available 24/7 to assist you.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 18),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEECFB),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.email_outlined, color: AppColors.brand, size: 20),
                ),
                title: const Text('Email Support', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                subtitle: const Text('support@homecarex.com', style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Email support: support@homecarex.com')),
                  );
                },
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.phone_in_talk_outlined, color: Color(0xFF059669), size: 20),
                ),
                title: const Text('Toll Free Helpline', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                subtitle: const Text('1800-419-4663 (24x7)', style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Helpline: 1800-419-4663')),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final rawCategories = catalog.categories;

    // Deduplicate and sort by preferred mockup order
    final seen = <String>{};
    final deduplicated = <CategoryModel>[];
    for (final c in rawCategories) {
      if (c.id.isNotEmpty && !seen.contains(c.id)) {
        seen.add(c.id);
        deduplicated.add(c);
      }
    }

    deduplicated.sort((a, b) {
      final pA = _getPriority(a.slug);
      final pB = _getPriority(b.slug);
      return pA.compareTo(pB);
    });

    final q = _searchQuery.trim().toLowerCase();
    final categories = deduplicated.where((c) {
      if (q.isEmpty) return true;
      return c.name.toLowerCase().contains(q) || c.description.toLowerCase().contains(q);
    }).toList();

    final mostBookedServices = List<ServiceModel>.from(catalog.services)
      ..sort((a, b) => b.reviewsCount.compareTo(a.reviewsCount));

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => catalog.fetchCatalog(),
          color: AppColors.brand,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. TOP APP BAR: ← Categories
                GestureDetector(
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
                          size: 20,
                          color: Color(0xFF1E1B2E),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Categories',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // 2. HERO HEADLINE & SUBTITLE
                const Text(
                  'What do you need done today?',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E1B2E),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Explore our wide range of home services',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF6B7280),
                  ),
                ),

                const SizedBox(height: 16),

                // 3. PILL SEARCH BAR (Search categories, e.g. cleaning)
                Container(
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFD9DCF7)),
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
                        color: Color(0xFF9CA3AF),
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
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            errorBorder: InputBorder.none,
                            filled: false,
                            fillColor: Colors.transparent,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                            hintText: 'Search categories, e.g. cleaning',
                            hintStyle: TextStyle(
                              fontSize: 13.5,
                              color: Color(0xFF9CA3AF),
                              fontWeight: FontWeight.w400,
                            ),
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
                            padding: EdgeInsets.symmetric(horizontal: 12),
                            child: Icon(
                              Icons.close_rounded,
                              size: 18,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // 4. 2-COLUMN CATEGORIES GRID
                if (categories.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Column(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: const BoxDecoration(
                              color: Color(0xFFEEECFB),
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.search_off_rounded,
                                size: 28,
                                color: AppColors.brand,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No categories match "$_searchQuery"',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Try a different keyword or browse all services.',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton(
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.brand,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                            ),
                            child: const Text('Clear search'),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  GridView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    shrinkWrap: true,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.02,
                    ),
                    itemCount: categories.length,
                    itemBuilder: (context, index) {
                      final cat = categories[index];
                      final theme = _getCategoryTheme(cat.slug, cat.name);

                      return GestureDetector(
                        onTap: () => _openCategory(cat),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFF1F5F9)),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Top Photo with Floating Badge
                                Expanded(
                                  flex: 11,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      Image.asset(
                                        theme.imagePath,
                                        fit: BoxFit.cover,
                                        cacheWidth: 500,
                                        errorBuilder: (_, __, ___) => Container(
                                          color: const Color(0xFFEEECFB),
                                          child: const Center(
                                            child: Icon(
                                              Icons.home_repair_service_rounded,
                                              color: AppColors.brand,
                                              size: 32,
                                            ),
                                          ),
                                        ),
                                      ),

                                      // Floating Themed Badge at Bottom-Left of Photo
                                      Positioned(
                                        left: 8,
                                        bottom: 8,
                                        child: Container(
                                          width: 30,
                                          height: 30,
                                          decoration: BoxDecoration(
                                            color: theme.badgeBg,
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: theme.badgeBorder, width: 1.2),
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
                                              theme.icon,
                                              size: 15,
                                              color: theme.iconColor,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Bottom Content Bar: Title + Right Chevron
                                Container(
                                  color: Colors.white,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          cat.name,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF1E1B2E),
                                            height: 1.2,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      const Icon(
                                        Icons.chevron_right_rounded,
                                        size: 16,
                                        color: Color(0xFF94A3B8),
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

                // 5. MOST BOOKED SERVICES SECTION
                if (q.isEmpty && mostBookedServices.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  const Text(
                    'Most booked services',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1B2E),
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 204,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      clipBehavior: Clip.none,
                      itemCount: mostBookedServices.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (context, index) {
                        final s = mostBookedServices[index];
                        final imagePath = ServiceImageResolver.resolve(s.slug, s.name);
                        final focusAlign = ServiceImageResolver.resolveFocus(s.slug, s.name);

                        return GestureDetector(
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ServiceDetailsScreen(service: s),
                              ),
                            );
                          },
                          child: Container(
                            width: 195,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                                  blurRadius: 10,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            padding: const EdgeInsets.all(8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(16),
                                  child: SizedBox(
                                    height: 110,
                                    width: double.infinity,
                                    child: Image.asset(
                                      imagePath,
                                      fit: BoxFit.cover,
                                      cacheWidth: 450,
                                      alignment: focusAlign,
                                      errorBuilder: (_, __, ___) => Container(
                                        color: const Color(0xFFEEECFB),
                                        child: const Center(
                                          child: Icon(
                                            Icons.home_repair_service_rounded,
                                            color: AppColors.brand,
                                            size: 28,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  child: Text(
                                    s.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF1E1B2E),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.star_rounded,
                                        size: 15,
                                        color: Color(0xFFF59E0B),
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        '${s.rating.toStringAsFixed(1)} (${NumberFormat('#,##,###').format(s.reviewsCount)})',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  child: Row(
                                    children: [
                                      Text(
                                        '₹${NumberFormat('#,##,###').format(s.price.toInt())}',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF1E1B2E),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        _formatDuration(s.durationMinutes),
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFF64748B),
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
                ],

                // 6. SUPPORT ESCAPE HATCH: Can't find what you need?
                if (q.isEmpty) ...[
                  const SizedBox(height: 20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3730A3), Color(0xFF4338CA), Color(0xFF6558E8)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF4338CA).withValues(alpha: 0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                              ),
                              child: const Center(
                                child: Icon(Icons.headset_mic_rounded, color: Colors.white, size: 22),
                              ),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Can't find what you need?",
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14.5,
                                    ),
                                  ),
                                  SizedBox(height: 3),
                                  Text(
                                    "Tell us and we'll arrange a verified professional.",
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 11.5,
                                      height: 1.25,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 44,
                          child: ElevatedButton(
                            onPressed: () => _showContactSupportSheet(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF97316),
                              foregroundColor: const Color(0xFF3A1A00),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Contact support',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF3A1A00),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
