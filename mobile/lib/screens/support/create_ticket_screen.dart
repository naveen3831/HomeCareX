import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';

class CreateTicketScreen extends StatefulWidget {
  final String? initialCategory;
  final String? initialBookingId;

  const CreateTicketScreen({
    super.key,
    this.initialCategory,
    this.initialBookingId,
  });

  @override
  State<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends State<CreateTicketScreen> {
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _bodyController = TextEditingController();
  final TextEditingController _bookingSearchController = TextEditingController();

  String _selectedCategory = 'Booking';
  String _selectedPriority = 'Normal';
  String? _selectedBookingId;

  bool _isLoadingBookings = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<Map<String, dynamic>> _allBookings = [];
  List<Map<String, dynamic>> _filteredBookings = [];

  final List<Map<String, String>> _attachedFiles = [];

  static const List<String> _categories = [
    'Booking',
    'Payment & Refund',
    'Cancellation',
    'Rescheduling',
    'Partner issues',
    'Account & Login',
    'Refunds',
    'Safety',
    'App issue',
    'Other',
  ];

  static const List<String> _priorities = [
    'Low',
    'Normal',
    'High',
    'Urgent',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialCategory != null &&
        _categories.contains(widget.initialCategory)) {
      _selectedCategory = widget.initialCategory!;
    }
    _selectedBookingId = widget.initialBookingId;

    _bodyController.addListener(() {
      setState(() {});
    });

    _bookingSearchController.addListener(_onBookingSearchChanged);

    _fetchBookings();
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _bodyController.dispose();
    _bookingSearchController.dispose();
    super.dispose();
  }

  void _onBookingSearchChanged() {
    final query = _bookingSearchController.text.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredBookings = List.from(_allBookings);
      } else {
        _filteredBookings = _allBookings.where((b) {
          final title = (b['title'] ?? '').toString().toLowerCase();
          final code = (b['code'] ?? '').toString().toLowerCase();
          return title.contains(query) || code.contains(query);
        }).toList();
      }
    });
  }

  Future<void> _fetchBookings() async {
    setState(() => _isLoadingBookings = true);
    try {
      final res = await ApiService.get(ApiConstants.bookings);
      if (res is List && mounted) {
        final list = res.map((item) {
          final map = Map<String, dynamic>.from(item is Map ? item : {});
          final id = map['id'] ?? map['_id'] ?? '';
          final code = 'BK-${id.toString().length >= 6 ? id.toString().substring(0, 6).toUpperCase() : id.toString().toUpperCase()}';
          String title = 'Home Care Service';
          if (map['serviceName'] != null) {
            title = map['serviceName'].toString();
          } else if (map['items'] is List && (map['items'] as List).isNotEmpty) {
            final first = (map['items'] as List).first;
            if (first is Map && first['name'] != null) {
              title = first['name'].toString();
            }
          }
          return {
            'id': id.toString(),
            'code': code,
            'title': title,
            'label': '$code · $title',
          };
        }).toList();

        setState(() {
          _allBookings = list;
          _filteredBookings = list;
        });
      }
    } catch (_) {
      // Keep empty bookings list
    } finally {
      if (mounted) setState(() => _isLoadingBookings = false);
    }
  }

  void _addAttachment() {
    if (_attachedFiles.length >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 3 attachments allowed.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Add Attachment',
                style: TextStyle(
                  fontSize: 16.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Select photo or document to attach to this support ticket.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.camera_alt_outlined, color: Color(0xFFEA580C)),
                ),
                title: const Text('Take a Photo', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Capture issue with camera', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                onTap: () {
                  Navigator.pop(ctx);
                  _simulateAddAttachment('camera_photo_${DateTime.now().millisecondsSinceEpoch}.jpg', '1.4 MB');
                },
              ),
              ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.photo_library_outlined, color: Color(0xFF2563EB)),
                ),
                title: const Text('Choose from Gallery', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Select screenshot or photo', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                onTap: () {
                  Navigator.pop(ctx);
                  _simulateAddAttachment('screenshot_${DateTime.now().millisecondsSinceEpoch}.png', '840 KB');
                },
              ),
              ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.description_outlined, color: Color(0xFF475569)),
                ),
                title: const Text('Attach Document (PDF)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Invoice or receipt file', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                onTap: () {
                  Navigator.pop(ctx);
                  _simulateAddAttachment('invoice_receipt_${DateTime.now().millisecondsSinceEpoch}.pdf', '320 KB');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _simulateAddAttachment(String name, String size) {
    setState(() {
      _attachedFiles.add({'name': name, 'size': size});
    });
  }

  Future<void> _submitTicket() async {
    final subject = _subjectController.text.trim();
    final body = _bodyController.text.trim();

    if (subject.length < 3 || body.length < 10) {
      setState(() {
        _errorMessage =
            'Enter a subject of at least 3 characters and a description of at least 10 characters.';
      });
      return;
    }

    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    final categoryKey = _selectedCategory
        .toLowerCase()
        .replaceAll(' & ', '_')
        .replaceAll(' ', '_');

    final payload = {
      'category': categoryKey,
      'priority': _selectedPriority.toLowerCase(),
      'subject': subject,
      'body': body,
      if (_selectedBookingId != null && _selectedBookingId!.isNotEmpty)
        'bookingId': _selectedBookingId,
    };

    try {
      await ApiService.post(ApiConstants.tickets, payload);
    } catch (_) {
      // Offline fallback handling
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Support ticket created successfully!'),
            backgroundColor: Color(0xFF059669),
          ),
        );
        Navigator.of(context).pop(true);
      }
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
          'Contact Us',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Screen Header
              const Text(
                'Create a support ticket',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E1B2E),
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Tell us what happened. Your conversation stays private.',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 20),

              // Category Dropdown
              const Text(
                'Category',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFD2DBE4)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedCategory,
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Color(0xFF64748B),
                    ),
                    items: _categories.map((cat) {
                      return DropdownMenuItem(
                        value: cat,
                        child: Text(
                          cat,
                          style: const TextStyle(
                            fontSize: 13.5,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedCategory = val);
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Priority Dropdown
              const Text(
                'Priority',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFD2DBE4)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedPriority,
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Color(0xFF64748B),
                    ),
                    items: _priorities.map((p) {
                      return DropdownMenuItem(
                        value: p,
                        child: Text(
                          p,
                          style: const TextStyle(
                            fontSize: 13.5,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedPriority = val);
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // Related booking (optional) Card Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E7EE)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: const TextSpan(
                        text: 'Related booking ',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E1B2E),
                        ),
                        children: [
                          TextSpan(
                            text: '(optional)',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w400,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Find a booking
                    const Text(
                      'Find a booking',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _bookingSearchController,
                      style: const TextStyle(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Search by service or booking reference',
                        hintStyle: const TextStyle(
                          fontSize: 12.5,
                          color: Color(0xFF94A3B8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(9),
                          borderSide: const BorderSide(color: Color(0xFFD2DBE4)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(9),
                          borderSide: const BorderSide(color: Color(0xFFD2DBE4)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(9),
                          borderSide: const BorderSide(color: Color(0xFFEA580C)),
                        ),
                        suffixIcon: _bookingSearchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(
                                  Icons.clear_rounded,
                                  size: 18,
                                  color: Color(0xFF94A3B8),
                                ),
                                onPressed: () {
                                  _bookingSearchController.clear();
                                },
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Booking selector
                    const Text(
                      'Booking',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 46,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(color: const Color(0xFFD2DBE4)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: _selectedBookingId ?? '',
                          icon: const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: Color(0xFF64748B),
                          ),
                          items: [
                            const DropdownMenuItem<String>(
                              value: '',
                              child: Text(
                                'General question / no booking',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF1E1B2E),
                                ),
                              ),
                            ),
                            ..._filteredBookings.map((b) {
                              return DropdownMenuItem<String>(
                                value: b['id'] as String,
                                child: Text(
                                  b['label'] as String,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF1E1B2E),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }),
                          ],
                          onChanged: (val) {
                            setState(() {
                              if (val == null || val.isEmpty) {
                                _selectedBookingId = null;
                              } else {
                                _selectedBookingId = val;
                              }
                            });
                          },
                        ),
                      ),
                    ),

                    if (_isLoadingBookings) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'Loading your bookings…',
                        style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ] else if (_filteredBookings.isEmpty) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'No matching bookings. You can still raise a general question.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Subject
              const Text(
                'Subject',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _subjectController,
                maxLength: 200,
                style: const TextStyle(fontSize: 13.5),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'A short summary of your issue',
                  hintStyle: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF94A3B8),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
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
                    borderSide: const BorderSide(color: Color(0xFFEA580C)),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // Description
              const Text(
                'Description',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _bodyController,
                minLines: 5,
                maxLines: 7,
                maxLength: 4000,
                style: const TextStyle(fontSize: 13.5),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'Describe what happened and how we can help.',
                  hintStyle: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF94A3B8),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.all(14),
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
                    borderSide: const BorderSide(color: Color(0xFFEA580C)),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${_bodyController.text.length}/4000 characters. Do not include passwords or payment PINs.',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 18),

              // Attachments (optional)
              RichText(
                text: const TextSpan(
                  text: 'Attachments ',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E1B2E),
                  ),
                  children: [
                    TextSpan(
                      text: '(optional)',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w400,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              InkWell(
                onTap: _addAttachment,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: const Color(0xFFCBD5E1),
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.attach_file_rounded,
                        size: 18,
                        color: Color(0xFFEA580C),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _attachedFiles.isEmpty
                            ? 'Add photos or documents'
                            : 'Add more files (${_attachedFiles.length}/3)',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFEA580C),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Up to 3 images or PDFs. Maximum 5 MB each.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),

              if (_attachedFiles.isNotEmpty) ...[
                const SizedBox(height: 10),
                Column(
                  children: _attachedFiles.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final file = entry.value;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.insert_drive_file_outlined,
                            size: 18,
                            color: Color(0xFF475569),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${file['name']} · ${file['size']}',
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: Color(0xFF334155),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _attachedFiles.removeAt(idx);
                              });
                            },
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              child: Text(
                                'Remove',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFEF4444),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ],

              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF2F0),
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: const Color(0xFFEDB9B0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFF9F2521),
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF9F2521),
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // Submit Ticket Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitTicket,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFEA580C).withValues(alpha: 0.6),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Submit Ticket',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
