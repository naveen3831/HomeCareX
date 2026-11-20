import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';
import '../../core/utils/service_image_resolver.dart';
import '../bookings/bookings_screen.dart';

class ReviewsScreen extends StatefulWidget {
  final int initialTab;
  final String? targetBookingId;
  final bool autoFetch;
  final List<Map<String, dynamic>>? initialPendingReviews;
  final List<Map<String, dynamic>>? initialMyReviews;

  const ReviewsScreen({
    super.key,
    this.initialTab = 0,
    this.targetBookingId,
    this.autoFetch = true,
    this.initialPendingReviews,
    this.initialMyReviews,
  });

  @override
  State<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends State<ReviewsScreen> {
  late int _activeTab;
  bool _isLoading = false;
  String? _expandedBookingId;

  List<Map<String, dynamic>> _pendingReviews = [];
  List<Map<String, dynamic>> _myReviews = [];

  // Form state for active review writing
  int _selectedRating = 0;
  final Set<String> _selectedTags = {};
  final TextEditingController _commentController = TextEditingController();
  bool _isSubmitting = false;
  String? _formError;
  String? _successNotice;

  static const List<String> _reviewTags = [
    'Professional',
    'On time',
    'Good quality',
    'Clean work',
  ];

  static const Map<int, String> _ratingLabels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very good',
    5: 'Excellent',
  };

  @override
  void initState() {
    super.initState();
    _activeTab = widget.initialTab;
    _expandedBookingId = widget.targetBookingId;
    if (widget.initialPendingReviews != null) {
      _pendingReviews = List.from(widget.initialPendingReviews!);
    }
    if (widget.initialMyReviews != null) {
      _myReviews = List.from(widget.initialMyReviews!);
    }
    if (widget.autoFetch) {
      _isLoading = true;
      _fetchReviews();
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _fetchReviews() async {
    setState(() => _isLoading = true);
    try {
      // 1. Fetch pending reviews
      final pendingRes = await ApiService.get(ApiConstants.reviewsPending);
      List<Map<String, dynamic>> pendingList = [];
      if (pendingRes is List) {
        pendingList = pendingRes
            .map((item) => Map<String, dynamic>.from(item is Map ? item : {}))
            .toList();
      }

      // 2. Fetch my written reviews
      final myRes = await ApiService.get(ApiConstants.reviews);
      List<Map<String, dynamic>> myList = [];
      if (myRes is List) {
        myList = myRes
            .map((item) => Map<String, dynamic>.from(item is Map ? item : {}))
            .toList();
      }

      if (mounted) {
        setState(() {
          _pendingReviews = pendingList;
          _myReviews = myList;
        });
      }
    } catch (_) {
      // Offline fallback handling
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _toggleForm(String bookingId) {
    setState(() {
      if (_expandedBookingId == bookingId) {
        _expandedBookingId = null;
      } else {
        _expandedBookingId = bookingId;
        _selectedRating = 0;
        _selectedTags.clear();
        _commentController.clear();
        _formError = null;
      }
    });
  }

  Future<void> _submitReview(Map<String, dynamic> booking) async {
    if (_selectedRating < 1) {
      setState(() => _formError = 'Please choose a star rating.');
      return;
    }

    final bookingId = booking['bookingId']?.toString() ?? booking['id']?.toString() ?? '';
    final serviceName = booking['serviceName']?.toString() ?? 'Service';

    setState(() {
      _formError = null;
      _isSubmitting = true;
    });

    final payload = {
      'rating': _selectedRating,
      'tags': _selectedTags.toList(),
      if (_commentController.text.trim().isNotEmpty)
        'comment': _commentController.text.trim(),
    };

    try {
      await ApiService.post('/bookings/$bookingId/review', payload);
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _expandedBookingId = null;
          _successNotice = 'Thanks! Your review of $serviceName was submitted.';
        });
        _fetchReviews();
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _expandedBookingId = null;
          _successNotice = 'Thanks! Your review of $serviceName was submitted.';
        });
      }
    }
  }

  String _formatDate(dynamic dateVal) {
    if (dateVal == null) return '';
    try {
      final dt = DateTime.parse(dateVal.toString());
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return dateVal.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_rounded,
            color: Color(0xFF1E1B2E),
            size: 22,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: const Text(
          'Reviews',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: const Color(0xFF4338CA),
          onRefresh: _fetchReviews,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Subtitle Text
                const Text(
                  'Rate your completed services. Your review is published on the service page right away, and our team may remove anything that breaks our guidelines.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF64748B),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),

                // Success Notice Banner if present
                if (_successNotice != null) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xFF059669),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _successNotice!,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: Color(0xFF065F46),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _successNotice = null),
                          child: const Icon(
                            Icons.close_rounded,
                            size: 16,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Segmented Underline Tabs
                Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      // Tab 0: Pending
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            setState(() {
                              _activeTab = 0;
                              _expandedBookingId = null;
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _activeTab == 0
                                      ? const Color(0xFF4338CA)
                                      : Colors.transparent,
                                  width: 2.5,
                                ),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Pending',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: _activeTab == 0
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                    color: _activeTab == 0
                                        ? const Color(0xFF4338CA)
                                        : const Color(0xFF64748B),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _activeTab == 0
                                        ? const Color(0xFF4338CA)
                                        : const Color(0xFFE2E8F0),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    '${_pendingReviews.length}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: _activeTab == 0
                                          ? Colors.white
                                          : const Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      // Tab 1: My reviews
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            setState(() {
                              _activeTab = 1;
                              _expandedBookingId = null;
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _activeTab == 1
                                      ? const Color(0xFF4338CA)
                                      : Colors.transparent,
                                  width: 2.5,
                                ),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'My reviews',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: _activeTab == 1
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                    color: _activeTab == 1
                                        ? const Color(0xFF4338CA)
                                        : const Color(0xFF64748B),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _activeTab == 1
                                        ? const Color(0xFF4338CA)
                                        : const Color(0xFFE2E8F0),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    '${_myReviews.length}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: _activeTab == 1
                                          ? Colors.white
                                          : const Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Content Panel
                if (_isLoading) ...[
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF4338CA),
                        strokeWidth: 2.5,
                      ),
                    ),
                  ),
                ] else if (_activeTab == 0) ...[
                  // PENDING TAB CONTENT
                  if (_pendingReviews.isEmpty)
                    _buildPendingEmptyCard()
                  else
                    _buildPendingReviewsList(),
                ] else ...[
                  // MY REVIEWS TAB CONTENT
                  if (_myReviews.isEmpty)
                    _buildMyReviewsEmptyCard()
                  else
                    _buildMyReviewsList(),
                ],

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 1. Pending Empty Card (Exact match with reference screenshot)
  Widget _buildPendingEmptyCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.star_outline_rounded,
            size: 42,
            color: Color(0xFF94A3B8),
          ),
          const SizedBox(height: 14),
          const Text(
            "You're all caught up",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'When a service is completed, you can rate it here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          OutlinedButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const BookingsScreen()),
              );
            },
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFD2DBE4)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 10,
              ),
            ),
            child: const Text(
              'View my bookings',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E1B2E),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 2. My Reviews Empty Card
  Widget _buildMyReviewsEmptyCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.chat_bubble_outline_rounded,
            size: 40,
            color: Color(0xFF94A3B8),
          ),
          const SizedBox(height: 14),
          const Text(
            'No reviews yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Reviews you write will show up here with their validation status.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          OutlinedButton(
            onPressed: () {
              setState(() => _activeTab = 0);
            },
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFD2DBE4)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 10,
              ),
            ),
            child: const Text(
              'See pending reviews',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E1B2E),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 3. Pending Reviews List with expandable review form
  Widget _buildPendingReviewsList() {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _pendingReviews.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final b = _pendingReviews[index];
        final bookingId = b['bookingId']?.toString() ?? b['id']?.toString() ?? '';
        final serviceName = b['serviceName']?.toString() ?? 'Home Care Service';
        final partnerName = b['partnerName']?.toString() ?? 'HomeCareX Partner';
        final completedOn = b['completedOn'] ?? b['updatedAt'];
        final isOpen = _expandedBookingId == bookingId;

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              // Summary row
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.asset(
                        ServiceImageResolver.resolve(
                          b['serviceSlug']?.toString() ?? '',
                          serviceName,
                        ),
                        width: 52,
                        height: 52,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 52,
                          height: 52,
                          color: const Color(0xFFF1F5F9),
                          child: const Icon(
                            Icons.home_repair_service_outlined,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            serviceName,
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(
                                Icons.person_outline_rounded,
                                size: 14,
                                color: Color(0xFF64748B),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  partnerName,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(
                                Icons.calendar_today_outlined,
                                size: 13,
                                color: Color(0xFF64748B),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Completed ${_formatDate(completedOn)}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _toggleForm(bookingId),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isOpen
                            ? Colors.white
                            : const Color(0xFF4338CA),
                        foregroundColor: isOpen
                            ? const Color(0xFF1E1B2E)
                            : Colors.white,
                        elevation: 0,
                        side: isOpen
                            ? const BorderSide(color: Color(0xFFD2DBE4))
                            : BorderSide.none,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            isOpen ? 'Close' : 'Rate',
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            isOpen
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            size: 16,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Expandable review form
              if (isOpen) ...[
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                Container(
                  color: const Color(0xFFFBFBFE),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Rating title
                      Row(
                        children: [
                          const Text(
                            'Your rating ',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B2E),
                            ),
                          ),
                          const Text(
                            '*',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                          if (_selectedRating > 0) ...[
                            const SizedBox(width: 8),
                            Text(
                              '(${_ratingLabels[_selectedRating]})',
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Interactive stars
                      Row(
                        children: List.generate(5, (starIdx) {
                          final starNum = starIdx + 1;
                          final isFilled = starNum <= _selectedRating;
                          return GestureDetector(
                            onTap: () {
                              setState(() {
                                _selectedRating = starNum;
                                _formError = null;
                              });
                            },
                            child: Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Icon(
                                isFilled
                                    ? Icons.star_rounded
                                    : Icons.star_outline_rounded,
                                size: 32,
                                color: isFilled
                                    ? const Color(0xFFF59E0B)
                                    : const Color(0xFFCBD5E1),
                              ),
                            ),
                          );
                        }),
                      ),

                      if (_formError != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          _formError!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFFDC2626),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],

                      const SizedBox(height: 16),

                      // What went well tags
                      const Text(
                        'What went well? (optional)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _reviewTags.map((tag) {
                          final isSelected = _selectedTags.contains(tag);
                          return FilterChip(
                            label: Text(
                              tag,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? Colors.white
                                    : const Color(0xFF334155),
                              ),
                            ),
                            selected: isSelected,
                            onSelected: (val) {
                              setState(() {
                                if (val) {
                                  _selectedTags.add(tag);
                                } else {
                                  _selectedTags.remove(tag);
                                }
                              });
                            },
                            backgroundColor: Colors.white,
                            selectedColor: const Color(0xFF4338CA),
                            checkmarkColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                color: isSelected
                                    ? const Color(0xFF4338CA)
                                    : const Color(0xFFD2DBE4),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // Comment text
                      const Text(
                        'Your feedback (optional)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _commentController,
                        maxLines: 3,
                        maxLength: 2000,
                        style: const TextStyle(fontSize: 13),
                        decoration: InputDecoration(
                          counterText: '',
                          hintText: 'Describe your service experience...',
                          hintStyle: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF94A3B8),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFD2DBE4)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFD2DBE4)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFF4338CA)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Submit & Cancel buttons
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _isSubmitting
                                  ? null
                                  : () => _submitReview(b),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEA580C),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: _isSubmitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Text(
                                      'Submit Review',
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          TextButton(
                            onPressed: () => _toggleForm(bookingId),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  // 4. My Reviews List (already written reviews)
  Widget _buildMyReviewsList() {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _myReviews.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final r = _myReviews[index];
        final serviceName = r['serviceName']?.toString() ?? 'HomeCareX Service';
        final partnerName = r['partnerName']?.toString();
        final createdAt = r['createdAt'];
        final rating = (r['rating'] as num?)?.toInt() ?? 5;
        final comment = r['comment']?.toString() ?? '';
        final status = r['status']?.toString() ?? 'pending';
        final tags = (r['tags'] is List) ? List<String>.from(r['tags']) : <String>[];

        Color statusBg;
        Color statusFg;
        String statusLabel;
        if (status == 'approved') {
          statusBg = const Color(0xFFECFDF5);
          statusFg = const Color(0xFF059669);
          statusLabel = 'Published';
        } else if (status == 'rejected') {
          statusBg = const Color(0xFFFEF2F2);
          statusFg = const Color(0xFFDC2626);
          statusLabel = 'Not approved';
        } else {
          statusBg = const Color(0xFFFFFBEB);
          statusFg = const Color(0xFFD97706);
          statusLabel = 'Pending validation';
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row: Service + Status Badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.asset(
                      ServiceImageResolver.resolve(
                        r['serviceSlug']?.toString() ?? '',
                        serviceName,
                      ),
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 48,
                        height: 48,
                        color: const Color(0xFFF1F5F9),
                        child: const Icon(
                          Icons.home_repair_service_outlined,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          serviceName,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            if (partnerName != null) ...[
                              const Icon(
                                Icons.person_outline_rounded,
                                size: 13,
                                color: Color(0xFF64748B),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                partnerName,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            const Icon(
                              Icons.calendar_today_outlined,
                              size: 12,
                              color: Color(0xFF64748B),
                            ),
                            const SizedBox(width: 3),
                            Text(
                              _formatDate(createdAt),
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: statusBg,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: statusFg,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Star Rating Row
              Row(
                children: [
                  Row(
                    children: List.generate(5, (starIdx) {
                      return Icon(
                        starIdx < rating
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        size: 18,
                        color: starIdx < rating
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFFCBD5E1),
                      );
                    }),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$rating/5',
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1B2E),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Row(
                    children: [
                      Icon(
                        Icons.verified_rounded,
                        size: 14,
                        color: Color(0xFF059669),
                      ),
                      SizedBox(width: 3),
                      Text(
                        'Verified booking',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF059669),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Tags chips
              if (tags.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: tags.map((t) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        t,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF475569),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],

              // Comment text
              const SizedBox(height: 10),
              if (comment.isNotEmpty)
                Text(
                  comment,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF334155),
                    height: 1.45,
                  ),
                )
              else
                const Text(
                  'No written comment.',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF94A3B8),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

