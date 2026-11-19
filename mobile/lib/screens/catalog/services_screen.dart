import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/category_model.dart';
import '../../core/models/service_model.dart';
import '../../core/utils/service_image_resolver.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/cart_provider.dart';
import '../cart/cart_screen.dart';
import 'categories_screen.dart';
import 'service_details_screen.dart';

class _CurvedUnderlinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF4338CA)
      ..strokeWidth = 3.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    path.moveTo(2, 2);
    path.quadraticBezierTo(size.width * 0.5, 9, size.width - 2, 3);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class ServicesScreen extends StatefulWidget {
  final String? initialCategory;
  final String? initialQuery;
  final int initialPage;

  const ServicesScreen({
    super.key,
    this.initialCategory,
    this.initialQuery,
    this.initialPage = 1,
  });

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  late String _searchQuery;
  late String? _selectedCategory;
  late final TextEditingController _searchController;
  late final ScrollController _scrollController;

  late int _currentPage;
  static const int _pageSize = 12;

  double? _minRating;
  double? _minPrice;
  double? _maxPrice;
  int? _maxDuration;
  String? _availability;
  String _sortBy = 'recommended'; // 'recommended', 'popular', 'rating', 'price_asc', 'price_desc', 'newest'

  int get _activeFilterCount {
    int count = 0;
    if (_selectedCategory != null && _selectedCategory != 'all') count++;
    if (_minRating != null) count++;
    if (_minPrice != null || _maxPrice != null) count++;
    if (_maxDuration != null) count++;
    if (_availability != null && _availability != 'any') count++;
    if (_sortBy != 'recommended') count++;
    return count;
  }

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage;
    _searchQuery = widget.initialQuery ?? '';
    _selectedCategory = widget.initialCategory;
    _searchController = TextEditingController(text: _searchQuery);
    _scrollController = ScrollController();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  String _getServiceImage(ServiceModel s) {
    return ServiceImageResolver.resolve(s.slug, s.name);
  }

  String? _getBadgeForService(ServiceModel s) {
    if (s.rating >= 4.8) return 'Top rated';
    if (s.rating >= 4.6) return 'Popular';
    return null;
  }

  String? _getAvailabilityLabel(ServiceModel s) {
    final a = s.availability?.toLowerCase();
    if (a == 'today') return 'Available today';
    if (a == 'tomorrow') return 'By tomorrow';
    final slug = s.slug.toLowerCase();
    if (slug.contains('plumbing') || slug.contains('tap-leak') || slug.contains('ac-service') || slug.contains('ro-water')) {
      return 'Available today';
    }
    return null;
  }

  IconData _getCategoryIcon(String slug) {
    final s = slug.toLowerCase();
    if (s.contains('clean')) return Icons.cleaning_services_rounded;
    if (s.contains('salon') || s.contains('spa')) return Icons.spa_rounded;
    if (s.contains('appliance')) return Icons.build_rounded;
    if (s.contains('electr') || s.contains('plumb')) return Icons.bolt_rounded;
    if (s.contains('paint')) return Icons.format_paint_rounded;
    if (s.contains('pest')) return Icons.pest_control_rounded;
    if (s.contains('carpent')) return Icons.handyman_rounded;
    return Icons.category_rounded;
  }

  bool _matchesCategory(ServiceModel s, String? selectedCat, List<CategoryModel> categories) {
    if (selectedCat == null || selectedCat == 'all') return true;
    if (s.categoryId == selectedCat || s.slug == selectedCat) return true;

    final matchingCat = categories.where((c) => c.id == selectedCat || c.slug == selectedCat).firstOrNull;
    if (matchingCat != null) {
      if (s.categoryId == matchingCat.id || s.categoryId == matchingCat.slug) return true;
      // If service explicitly belongs to another known category, don't cross-match by keyword
      if (s.categoryId.isNotEmpty && categories.any((c) => c.id == s.categoryId && c.id != matchingCat.id)) {
        return false;
      }
      final catSlug = matchingCat.slug.toLowerCase();
      final sName = s.name.toLowerCase();
      final sSlug = s.slug.toLowerCase();
      if (catSlug.contains('clean') && (sName.contains('clean') || sSlug.contains('clean'))) return true;
      if (catSlug.contains('appliance') && (sSlug.contains('ac-') || sSlug.contains('purifier') || sSlug.contains('washing') || sSlug.contains('refrigerator') || sSlug.contains('microwave'))) return true;
      if (catSlug.contains('salon') && (sSlug.contains('spa') || sSlug.contains('massage') || sSlug.contains('haircut') || sSlug.contains('bridal'))) return true;
      if (catSlug.contains('electrical') && (sSlug.contains('electric') || sSlug.contains('plumb') || sSlug.contains('fan') || sSlug.contains('geyser') || sSlug.contains('tank'))) return true;
      if (catSlug.contains('paint') && (sSlug.contains('paint') || sSlug.contains('waterproof') || sSlug.contains('texture'))) return true;
      if (catSlug.contains('pest') && (sSlug.contains('pest') || sSlug.contains('termite') || sSlug.contains('fogging') || sSlug.contains('bed-bug'))) return true;
      if (catSlug.contains('carpent') && (sSlug.contains('furniture') || sSlug.contains('door-lock') || sSlug.contains('wardrobe') || sSlug.contains('shelf'))) return true;
    }
    return false;
  }

  void _openFilterModal(BuildContext context) {
    final catalog = context.read<CatalogProvider>();
    final categories = catalog.categories;
    final allServices = catalog.services;

    String tempSort = _sortBy;
    String? tempCategory = _selectedCategory;
    double? tempMinRating = _minRating;
    double? tempMinPrice = _minPrice;
    double? tempMaxPrice = _maxPrice;
    String? tempAvailability = _availability;
    int? tempMaxDuration = _maxDuration;

    int computeAppliedCount() {
      int count = 0;
      if (tempCategory != null && tempCategory != 'all') count++;
      if (tempMinRating != null) count++;
      if (tempMinPrice != null || tempMaxPrice != null) count++;
      if (tempMaxDuration != null) count++;
      if (tempAvailability != null && tempAvailability != 'any') count++;
      if (tempSort != 'recommended') count++;
      return count;
    }

    int computeMatchCount() {
      final q = _searchQuery.trim().toLowerCase();
      return allServices.where((s) {
        final matchesSearch = q.isEmpty ||
            s.name.toLowerCase().contains(q) ||
            s.description.toLowerCase().contains(q);
        final matchesCat = _matchesCategory(s, tempCategory, categories);
        final matchesRating = tempMinRating == null || s.rating >= tempMinRating!;
        final matchesMinPrice = tempMinPrice == null || s.price >= tempMinPrice!;
        final matchesMaxPrice = tempMaxPrice == null || s.price <= tempMaxPrice!;
        final matchesDuration = tempMaxDuration == null || s.durationMinutes <= tempMaxDuration!;
        final matchesAvail = tempAvailability == null ||
            tempAvailability == 'any' ||
            (s.availability?.toLowerCase() == tempAvailability?.toLowerCase()) ||
            (tempAvailability == 'tomorrow' && (s.availability == 'today' || s.availability == 'tomorrow'));
        return matchesSearch && matchesCat && matchesRating && matchesMinPrice && matchesMaxPrice && matchesDuration && matchesAvail;
      }).length;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final appliedCount = computeAppliedCount();
            final matchCount = computeMatchCount();

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.85,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // 1. TOP HEADER: Filters & Close
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 16, 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Filters',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E1B2E),
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '$appliedCount applied',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => Navigator.pop(ctx),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFFF1F5F9),
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.close_rounded,
                                size: 18,
                                color: Color(0xFF1E1B2E),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Divider(height: 1, color: Color(0xFFF1F5F9)),

                  // 2. SCROLLABLE FILTER SECTIONS
                  Flexible(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // A. SORT BY
                          const Text(
                            'Sort by',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPillChip(
                                label: 'Featured',
                                isSelected: tempSort == 'recommended',
                                onTap: () => setModalState(() => tempSort = 'recommended'),
                              ),
                              _buildPillChip(
                                label: 'Popular',
                                isSelected: tempSort == 'popular',
                                onTap: () => setModalState(() => tempSort = 'popular'),
                              ),
                              _buildPillChip(
                                label: 'Top rated',
                                isSelected: tempSort == 'rating',
                                onTap: () => setModalState(() => tempSort = 'rating'),
                              ),
                              _buildPillChip(
                                label: 'Price: low to high',
                                isSelected: tempSort == 'price_asc',
                                onTap: () => setModalState(() => tempSort = 'price_asc'),
                              ),
                              _buildPillChip(
                                label: 'Price: high to low',
                                isSelected: tempSort == 'price_desc',
                                onTap: () => setModalState(() => tempSort = 'price_desc'),
                              ),
                              _buildPillChip(
                                label: 'Newest',
                                isSelected: tempSort == 'newest',
                                onTap: () => setModalState(() => tempSort = 'newest'),
                              ),
                            ],
                          ),

                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),

                          // B. CATEGORY
                          const Text(
                            'Category',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPillChip(
                                label: 'All',
                                isSelected: tempCategory == null || tempCategory == 'all',
                                onTap: () => setModalState(() => tempCategory = null),
                              ),
                              ...categories.map((c) {
                                final isSelected = tempCategory == c.id || tempCategory == c.slug;
                                return _buildPillChip(
                                  label: c.name,
                                  isSelected: isSelected,
                                  onTap: () => setModalState(() {
                                    if (isSelected) {
                                      tempCategory = null;
                                    } else {
                                      tempCategory = c.id;
                                    }
                                  }),
                                );
                              }),
                            ],
                          ),

                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),

                          // C. PRICE
                          const Text(
                            'Price',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPillChip(
                                label: 'Any price',
                                isSelected: tempMinPrice == null && tempMaxPrice == null,
                                onTap: () => setModalState(() {
                                  tempMinPrice = null;
                                  tempMaxPrice = null;
                                }),
                              ),
                              _buildPillChip(
                                label: 'Under ₹500',
                                isSelected: tempMinPrice == null && tempMaxPrice == 500,
                                onTap: () => setModalState(() {
                                  tempMinPrice = null;
                                  tempMaxPrice = 500;
                                }),
                              ),
                              _buildPillChip(
                                label: '₹500 – ₹1,000',
                                isSelected: tempMinPrice == 500 && tempMaxPrice == 1000,
                                onTap: () => setModalState(() {
                                  tempMinPrice = 500;
                                  tempMaxPrice = 1000;
                                }),
                              ),
                              _buildPillChip(
                                label: '₹1,000 – ₹2,500',
                                isSelected: tempMinPrice == 1000 && tempMaxPrice == 2500,
                                onTap: () => setModalState(() {
                                  tempMinPrice = 1000;
                                  tempMaxPrice = 2500;
                                }),
                              ),
                              _buildPillChip(
                                label: '₹2,500 and above',
                                isSelected: tempMinPrice == 2500 && tempMaxPrice == null,
                                onTap: () => setModalState(() {
                                  tempMinPrice = 2500;
                                  tempMaxPrice = null;
                                }),
                              ),
                            ],
                          ),

                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),

                          // D. RATING
                          const Text(
                            'Rating',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPillChip(
                                label: 'Any rating',
                                isSelected: tempMinRating == null,
                                onTap: () => setModalState(() => tempMinRating = null),
                              ),
                              _buildPillChip(
                                label: '4.5+',
                                leading: const Icon(Icons.star_rounded, size: 14, color: Color(0xFFF59E0B)),
                                isSelected: tempMinRating == 4.5,
                                onTap: () => setModalState(() => tempMinRating = 4.5),
                              ),
                              _buildPillChip(
                                label: '4.0+',
                                leading: const Icon(Icons.star_rounded, size: 14, color: Color(0xFFF59E0B)),
                                isSelected: tempMinRating == 4.0,
                                onTap: () => setModalState(() => tempMinRating = 4.0),
                              ),
                              _buildPillChip(
                                label: '3.0+',
                                leading: const Icon(Icons.star_rounded, size: 14, color: Color(0xFFF59E0B)),
                                isSelected: tempMinRating == 3.0,
                                onTap: () => setModalState(() => tempMinRating = 3.0),
                              ),
                            ],
                          ),

                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),

                          // E. AVAILABILITY
                          const Text(
                            'Availability',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPillChip(
                                label: 'Any time',
                                isSelected: tempAvailability == null || tempAvailability == 'any',
                                onTap: () => setModalState(() => tempAvailability = null),
                              ),
                              _buildPillChip(
                                label: 'Available today',
                                isSelected: tempAvailability == 'today',
                                onTap: () => setModalState(() => tempAvailability = 'today'),
                              ),
                              _buildPillChip(
                                label: 'By tomorrow',
                                isSelected: tempAvailability == 'tomorrow',
                                onTap: () => setModalState(() => tempAvailability = 'tomorrow'),
                              ),
                            ],
                          ),

                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),

                          // F. DURATION
                          const Text(
                            'Duration',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPillChip(
                                label: 'Any duration',
                                isSelected: tempMaxDuration == null,
                                onTap: () => setModalState(() => tempMaxDuration = null),
                              ),
                              _buildPillChip(
                                label: 'Up to 30 min',
                                isSelected: tempMaxDuration == 30,
                                onTap: () => setModalState(() => tempMaxDuration = 30),
                              ),
                              _buildPillChip(
                                label: 'Up to 1 hour',
                                isSelected: tempMaxDuration == 60,
                                onTap: () => setModalState(() => tempMaxDuration = 60),
                              ),
                              _buildPillChip(
                                label: 'Up to 2 hours',
                                isSelected: tempMaxDuration == 120,
                                onTap: () => setModalState(() => tempMaxDuration = 120),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),

                  // 3. STICKY BOTTOM FOOTER
                  Container(
                    padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).padding.bottom + 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          offset: const Offset(0, -3),
                          blurRadius: 10,
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        // "Clear all" button
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            setModalState(() {
                              tempSort = 'recommended';
                              tempCategory = null;
                              tempMinRating = null;
                              tempMinPrice = null;
                              tempMaxPrice = null;
                              tempAvailability = null;
                              tempMaxDuration = null;
                            });
                          },
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                            child: Text(
                              'Clear all',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(width: 12),

                        // Primary Action Button: "Show X services"
                        Expanded(
                          child: SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: () {
                                setState(() {
                                  _sortBy = tempSort;
                                  _selectedCategory = tempCategory;
                                  _minRating = tempMinRating;
                                  _minPrice = tempMinPrice;
                                  _maxPrice = tempMaxPrice;
                                  _availability = tempAvailability;
                                  _maxDuration = tempMaxDuration;
                                  _currentPage = 1;
                                });
                                Navigator.pop(ctx);
                                _scrollToTop();
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF4338CA),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24),
                                ),
                              ),
                              child: Text(
                                matchCount == 0
                                    ? 'No matching services'
                                    : 'Show $matchCount service${matchCount > 1 ? 's' : ''}',
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
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

  Widget _buildPillChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    Widget? leading,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEEECFB) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF4338CA) : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (leading != null) ...[
              leading,
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? const Color(0xFF4338CA) : const Color(0xFF1E1B2E),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final cart = context.watch<CartProvider>();
    final categories = catalog.categories;

    // Filter services based on search, category, and active filters
    final q = _searchQuery.trim().toLowerCase();
    var filteredServices = catalog.services.where((s) {
      final matchesSearch = q.isEmpty ||
          s.name.toLowerCase().contains(q) ||
          s.description.toLowerCase().contains(q);
      final matchesCat = _matchesCategory(s, _selectedCategory, categories);
      final matchesRating = _minRating == null || s.rating >= _minRating!;
      final matchesMinPrice = _minPrice == null || s.price >= _minPrice!;
      final matchesMaxPrice = _maxPrice == null || s.price <= _maxPrice!;
      final matchesDuration = _maxDuration == null || s.durationMinutes <= _maxDuration!;
      final matchesAvail = _availability == null ||
          _availability == 'any' ||
          (s.availability?.toLowerCase() == _availability?.toLowerCase()) ||
          (_availability == 'tomorrow' && (s.availability == 'today' || s.availability == 'tomorrow'));
      return matchesSearch && matchesCat && matchesRating && matchesMinPrice && matchesMaxPrice && matchesDuration && matchesAvail;
    }).toList();

    // Sort services
    if (_sortBy == 'price_asc') {
      filteredServices.sort((a, b) => a.price.compareTo(b.price));
    } else if (_sortBy == 'price_desc') {
      filteredServices.sort((a, b) => b.price.compareTo(a.price));
    } else if (_sortBy == 'rating') {
      filteredServices.sort((a, b) => b.rating.compareTo(a.rating));
    } else if (_sortBy == 'popular') {
      filteredServices.sort((a, b) => b.reviewsCount.compareTo(a.reviewsCount));
    }

    final totalPages = (filteredServices.isEmpty)
        ? 1
        : ((filteredServices.length + _pageSize - 1) ~/ _pageSize);

    if (_currentPage > totalPages) {
      _currentPage = totalPages;
    }
    if (_currentPage < 1) {
      _currentPage = 1;
    }

    final startIndex = (_currentPage - 1) * _pageSize;
    final endIndex = (startIndex + _pageSize < filteredServices.length)
        ? startIndex + _pageSize
        : filteredServices.length;

    final pagedServices = (filteredServices.isNotEmpty && startIndex < filteredServices.length)
        ? filteredServices.sublist(startIndex, endIndex)
        : <ServiceModel>[];

    final hasActiveFilter = _activeFilterCount > 0;

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await catalog.fetchCatalog();
            setState(() {
              _currentPage = 1;
            });
          },
          color: AppColors.brand,
          child: SingleChildScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. TOP APP BAR: ← Services
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
                          'Services',
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

                // 2. HERO HEADLINE: Everything your home needs (with curved doodle)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Everything your',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E1B2E),
                        letterSpacing: -0.6,
                        height: 1.15,
                      ),
                    ),
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        const Text(
                          'home needs',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF4338CA),
                            letterSpacing: -0.6,
                            height: 1.15,
                          ),
                        ),
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: -4,
                          child: CustomPaint(
                            size: const Size(double.infinity, 8),
                            painter: _CurvedUnderlinePainter(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Browse and book trusted home services near you.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // 3. SEARCH BAR & FILTER BUTTON
                Row(
                  children: [
                    // Search Pill
                    Expanded(
                      child: Container(
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
                              color: Color(0xFF9CA3AF),
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                onChanged: (val) => setState(() {
                                  _searchQuery = val;
                                  _currentPage = 1;
                                }),
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
                                  hintText: 'Search for a service, e.g. AC...',
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
                                  setState(() {
                                    _searchQuery = '';
                                    _currentPage = 1;
                                  });
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 10),
                                  child: Icon(Icons.close_rounded, size: 18, color: Color(0xFF9CA3AF)),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(width: 10),

                    // Filter Button
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _openFilterModal(context),
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: hasActiveFilter ? const Color(0xFFEEECFB) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: hasActiveFilter ? AppColors.brand : const Color(0xFFD9DCF7),
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
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Icon(
                              Icons.tune_rounded,
                              size: 20,
                              color: hasActiveFilter ? AppColors.brand : const Color(0xFF1E1B2E),
                            ),
                            if (hasActiveFilter)
                              Positioned(
                                top: 7,
                                right: 7,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: const BoxDecoration(
                                    color: AppColors.brand,
                                    shape: BoxShape.circle,
                                  ),
                                  constraints: const BoxConstraints(
                                    minWidth: 15,
                                    minHeight: 15,
                                  ),
                                  child: Center(
                                    child: Text(
                                      '$_activeFilterCount',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 8.5,
                                        fontWeight: FontWeight.w700,
                                        height: 1.0,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // 4. CATEGORIES SECTION HEADER
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Categories',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const CategoriesScreen()),
                        );
                      },
                      child: const Row(
                        children: [
                          Text(
                            'View All',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.brand,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.brand),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // HORIZONTAL CATEGORIES STRIP
                SizedBox(
                  height: 86,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    children: [
                      _buildCategoryTile(
                        id: null,
                        title: 'All Services',
                        icon: Icons.grid_view_rounded,
                        isSelected: _selectedCategory == null,
                      ),
                      ...categories.map((c) => _buildCategoryTile(
                        id: c.id,
                        title: c.name,
                        icon: _getCategoryIcon(c.slug),
                        isSelected: _selectedCategory == c.id || _selectedCategory == c.slug,
                      )),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // 5. SERVICES LIST / GRID
                if (filteredServices.isEmpty)
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
                          const Text(
                            'No services match your filters',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Try a different keyword or reset filters.',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton(
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchQuery = '';
                                _selectedCategory = null;
                                _minRating = null;
                                _minPrice = null;
                                _maxPrice = null;
                                _maxDuration = null;
                                _availability = null;
                                _sortBy = 'recommended';
                                _currentPage = 1;
                              });
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.brand,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                            ),
                            child: const Text('Reset all filters'),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ListView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    shrinkWrap: true,
                    itemCount: pagedServices.length,
                    itemBuilder: (context, index) {
                      final service = pagedServices[index];
                      final imagePath = _getServiceImage(service);
                      final badge = _getBadgeForService(service);
                      final availabilityLabel = _getAvailabilityLabel(service);
                      final cat = categories.where((c) => c.id == service.categoryId).firstOrNull;
                      final catName = cat?.name ?? 'Home Service';

                      return GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ServiceDetailsScreen(service: service),
                            ),
                          );
                        },
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFF1F5F9)),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF1E1B2E).withValues(alpha: 0.05),
                                blurRadius: 14,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          padding: const EdgeInsets.all(8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Top Photo with Badges - 16:10 aspect ratio matching web responsive
                              AspectRatio(
                                aspectRatio: 16 / 10,
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(14),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      Image.asset(
                                        imagePath,
                                        cacheWidth: 600,
                                        fit: BoxFit.cover,
                                        alignment: ServiceImageResolver.resolveFocus(service.slug, service.name),
                                        errorBuilder: (_, __, ___) => Container(
                                          color: const Color(0xFFEEECFB),
                                          child: const Center(
                                            child: Icon(
                                              Icons.home_repair_service_rounded,
                                              size: 36,
                                              color: AppColors.brand,
                                            ),
                                          ),
                                        ),
                                      ),

                                      // Subtle gradient overlay
                                      DecoratedBox(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.bottomCenter,
                                            end: Alignment.topCenter,
                                            colors: [
                                              Colors.black.withValues(alpha: 0.18),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),

                                      // Top-Left Rating/Popular Badge
                                      if (badge != null)
                                        Positioned(
                                          top: 8,
                                          left: 8,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withValues(alpha: 0.95),
                                              borderRadius: BorderRadius.circular(12),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.black.withValues(alpha: 0.08),
                                                  blurRadius: 4,
                                                  offset: const Offset(0, 1),
                                                ),
                                              ],
                                            ),
                                            child: Text(
                                              badge,
                                              style: const TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFFB45309),
                                              ),
                                            ),
                                          ),
                                        ),

                                      // Bottom-Left Availability Badge (e.g. • Available today)
                                      if (availabilityLabel != null)
                                        Positioned(
                                          bottom: 8,
                                          left: 8,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                            decoration: BoxDecoration(
                                              color: const Color(0xE6166534), // dark green #166534 / 90%
                                              borderRadius: BorderRadius.circular(12),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.black.withValues(alpha: 0.12),
                                                  blurRadius: 4,
                                                  offset: const Offset(0, 1),
                                                ),
                                              ],
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Container(
                                                  width: 6,
                                                  height: 6,
                                                  decoration: const BoxDecoration(
                                                    color: Color(0xFF86EFAC), // light green #86EFAC
                                                    shape: BoxShape.circle,
                                                  ),
                                                ),
                                                const SizedBox(width: 5),
                                                Text(
                                                  availabilityLabel,
                                                  style: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w600,
                                                    color: Colors.white,
                                                    letterSpacing: 0.1,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),

                                      // Bottom-Right Arrow Action Circle
                                      Positioned(
                                        bottom: 8,
                                        right: 8,
                                        child: Container(
                                          width: 30,
                                          height: 30,
                                          decoration: BoxDecoration(
                                            color: Colors.white.withValues(alpha: 0.95),
                                            shape: BoxShape.circle,
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withValues(alpha: 0.08),
                                                blurRadius: 4,
                                                offset: const Offset(0, 1),
                                              ),
                                            ],
                                          ),
                                          child: const Center(
                                            child: Icon(
                                              Icons.north_east_rounded,
                                              size: 15,
                                              color: AppColors.brand,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),

                              // Bottom Content Strip
                              Padding(
                                padding: const EdgeInsets.fromLTRB(6, 10, 6, 6),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                      Text(
                                        service.name,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF1E1B2E),
                                          letterSpacing: -0.3,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        catName,
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: Color(0xFF6B7280),
                                        ),
                                      ),
                                      const SizedBox(height: 8),

                                      // Rating & Duration Row
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.star_rounded,
                                            color: Color(0xFFF59E0B),
                                            size: 15,
                                          ),
                                          const SizedBox(width: 3),
                                          Text(
                                            '${service.rating} (${service.reviewsCount})',
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF1E1B2E),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          const Icon(
                                            Icons.access_time_rounded,
                                            color: Color(0xFF9CA3AF),
                                            size: 13,
                                          ),
                                          const SizedBox(width: 3),
                                          Text(
                                            '${service.durationMinutes} min',
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              color: Color(0xFF6B7280),
                                            ),
                                          ),
                                        ],
                                      ),

                                      const SizedBox(height: 12),

                                      // Price & Book Now Row
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'STARTING AT',
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w700,
                                                  color: Color(0xFF9CA3AF),
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              const SizedBox(height: 1),
                                              Text(
                                                '₹${service.price.toStringAsFixed(0)}',
                                                style: const TextStyle(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.w800,
                                                  color: Color(0xFF1E1B2E),
                                                  letterSpacing: -0.4,
                                                ),
                                              ),
                                            ],
                                          ),

                                          // Book Now Button
                                          GestureDetector(
                                            onTap: () {
                                              cart.addItem(service);
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(
                                                  content: Text('Added "${service.name}" to cart!'),
                                                  backgroundColor: AppColors.brand,
                                                  duration: const Duration(seconds: 2),
                                                  behavior: SnackBarBehavior.floating,
                                                  action: SnackBarAction(
                                                    label: 'VIEW CART',
                                                    textColor: const Color(0xFFFF8A3D),
                                                    onPressed: () {
                                                      Navigator.of(context).push(
                                                        MaterialPageRoute(
                                                          builder: (_) => const CartScreen(),
                                                        ),
                                                      );
                                                    },
                                                  ),
                                                ),
                                              );
                                            },
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                                              decoration: BoxDecoration(
                                                color: AppColors.brand,
                                                borderRadius: BorderRadius.circular(20),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: AppColors.brand.withValues(alpha: 0.25),
                                                    blurRadius: 8,
                                                    offset: const Offset(0, 2),
                                                  ),
                                                ],
                                              ),
                                              child: const Text(
                                                'Book now',
                                                style: TextStyle(
                                                  fontSize: 12.5,
                                                  fontWeight: FontWeight.w700,
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
                              ],
                            ),
                          ),
                        );
                      },
                    ),

                // 6. PAGINATION CONTROLS: < Page 1 of 3 >
                if (filteredServices.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 10, bottom: 28),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Previous Page Button (<)
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _currentPage > 1
                              ? () {
                                  setState(() {
                                    _currentPage--;
                                  });
                                  _scrollToTop();
                                }
                              : null,
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _currentPage > 1
                                    ? const Color(0xFFE5E7EB)
                                    : const Color(0xFFF3F4F6),
                                width: 1.2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Center(
                              child: Icon(
                                Icons.chevron_left_rounded,
                                size: 22,
                                color: _currentPage > 1
                                    ? const Color(0xFF1E1B2E)
                                    : const Color(0xFFCBD5E1),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(width: 20),

                        // Page Info Text: "Page 1 of 3"
                        Text(
                          'Page $_currentPage of $totalPages',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E1B2E),
                            letterSpacing: -0.2,
                          ),
                        ),

                        const SizedBox(width: 20),

                        // Next Page Button (>)
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _currentPage < totalPages
                              ? () {
                                  setState(() {
                                    _currentPage++;
                                  });
                                  _scrollToTop();
                                }
                              : null,
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _currentPage < totalPages
                                    ? const Color(0xFFE5E7EB)
                                    : const Color(0xFFF3F4F6),
                                width: 1.2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Center(
                              child: Icon(
                                Icons.chevron_right_rounded,
                                size: 22,
                                color: _currentPage < totalPages
                                    ? const Color(0xFF1E1B2E)
                                    : const Color(0xFFCBD5E1),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryTile({
    required String? id,
    required String title,
    required IconData icon,
    required bool isSelected,
  }) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedCategory = id;
          _currentPage = 1;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 88,
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEEECFB) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.brand : const Color(0xFFF1F5F9),
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1E1B2E).withValues(alpha: isSelected ? 0.08 : 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 22,
              color: isSelected ? AppColors.brand : const Color(0xFF4338CA),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? AppColors.brand : const Color(0xFF1E1B2E),
                height: 1.15,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
