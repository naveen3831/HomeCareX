import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';
import 'create_ticket_screen.dart';

class MyTicketsScreen extends StatefulWidget {
  final int initialTab;
  const MyTicketsScreen({super.key, this.initialTab = 1});

  @override
  State<MyTicketsScreen> createState() => _MyTicketsScreenState();
}

class _MyTicketsScreenState extends State<MyTicketsScreen> {
  late int _activeTab;
  String _selectedStatus = 'All statuses';
  List<dynamic> _tickets = [];

  // Search query for Help Center
  final TextEditingController _helpSearchController = TextEditingController();
  String _helpSearchQuery = '';

  static const List<String> _statusOptions = [
    'All statuses',
    'Open',
    'In Progress',
    'Resolved',
    'Closed',
  ];

  static const List<Map<String, dynamic>> _faqData = [
    {
      'category': 'Bookings',
      'question': 'Where can I see my booking details?',
      'answer':
          'Open My Bookings in the bottom navigation and choose View details. You can track the assigned professional, appointment arrival slot, address, and live status.',
    },
    {
      'category': 'Bookings',
      'question': 'My booking did not confirm. What should I do?',
      'answer':
          'Check your My Bookings list. If payment was deducted but the booking is unconfirmed, create a ticket and our support team will reconcile it within 15 minutes.',
    },
    {
      'category': 'Payments',
      'question': 'Where is my payment invoice or receipt?',
      'answer':
          'Digital invoices and GST receipts are generated automatically upon service completion and can be downloaded from your completed booking order view.',
    },
    {
      'category': 'Payments',
      'question': 'How does the refund process work?',
      'answer':
          'Approved cancellations within the permissible advance window are credited directly back to your original source payment method within 3–5 business days.',
    },
    {
      'category': 'Cancellations',
      'question': 'How can I cancel or reschedule a service?',
      'answer':
          'Open the booking details and tap Cancel booking or Reschedule. Free cancellation is supported up to 2 hours before the professional is dispatched.',
    },
    {
      'category': 'Service Quality',
      'question': 'What if the service partner did not complete all tasks?',
      'answer':
          'Every service is covered by the HomeCareX Quality Guarantee. Raise a ticket within 24 hours and we will arrange a free inspection rework.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _activeTab = widget.initialTab;
    _fetchTickets();
  }

  @override
  void dispose() {
    _helpSearchController.dispose();
    super.dispose();
  }

  Future<void> _fetchTickets() async {
    try {
      final res = await ApiService.get(ApiConstants.tickets);
      if (res is Map<String, dynamic> && mounted) {
        final items = res['items'] ?? res['data'];
        if (items is List) {
          setState(() => _tickets = items);
        }
      } else if (res is List && mounted) {
        setState(() => _tickets = res);
      }
    } catch (_) {
      // Empty state when no tickets
    }
  }

  Future<void> _openCreateTicketScreen([String? category]) async {
    final res = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CreateTicketScreen(initialCategory: category),
      ),
    );
    if (res == true && mounted) {
      _fetchTickets();
    }
  }

  void _openCreateTicketModal() {
    _openCreateTicketScreen();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
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
          'My Tickets',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. CARD 1: Raise a New Ticket
              GestureDetector(
                onTap: _openCreateTicketModal,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F4FF),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFDBE6FE)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFDBEAFE)),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.confirmation_number_outlined,
                            color: Color(0xFF2563EB),
                            size: 22,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Raise a New Ticket',
                              style: TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E1B4B),
                              ),
                            ),
                            SizedBox(height: 3),
                            Text(
                              'Get support for your issue',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFF2563EB),
                        size: 22,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // 2. CARD 2: How can we help you? Hero Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF7F9FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFDBEAFE)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFFEDD5)),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.help_outline_rounded,
                          color: Color(0xFFEA580C),
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'HERE TO HELP',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: Color(0xFFEA580C),
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'How can we help you?',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1B4B),
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Find an answer or talk to the HomeCareX team.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 3. SEGMENTED UNDERLINE TABS
              Container(
                decoration: const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
                child: Row(
                  children: [
                    // Help center Tab
                    GestureDetector(
                      onTap: () => setState(() => _activeTab = 0),
                      child: Container(
                        padding: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: _activeTab == 0
                                  ? const Color(0xFFEA580C)
                                  : Colors.transparent,
                              width: 2.2,
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.help_outline_rounded,
                              size: 16,
                              color: _activeTab == 0
                                  ? const Color(0xFFEA580C)
                                  : const Color(0xFF64748B),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Help center',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: _activeTab == 0
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: _activeTab == 0
                                    ? const Color(0xFFEA580C)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(width: 24),

                    // My tickets Tab
                    GestureDetector(
                      onTap: () => setState(() => _activeTab = 1),
                      child: Container(
                        padding: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: _activeTab == 1
                                  ? const Color(0xFFEA580C)
                                  : Colors.transparent,
                              width: 2.2,
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.confirmation_number_outlined,
                              size: 16,
                              color: _activeTab == 1
                                  ? const Color(0xFFEA580C)
                                  : const Color(0xFF64748B),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'My tickets',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: _activeTab == 1
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: _activeTab == 1
                                    ? const Color(0xFFEA580C)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // 4. TAB CONTENT
              if (_activeTab == 1)
                _buildMyTicketsPanel()
              else
                _buildHelpCenterPanel(),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  // MY TICKETS PANEL
  Widget _buildMyTicketsPanel() {
    final filteredTickets = _tickets.where((t) {
      if (_selectedStatus == 'All statuses') return true;
      final s = (t['status'] ?? '').toString().toLowerCase();
      return s == _selectedStatus.toLowerCase();
    }).toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'My tickets',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 3),
          const Text(
            'Track requests and continue the conversation.',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 16),

          // Status Filter Dropdown Label
          const Text(
            'Status',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),

          // Status Filter Dropdown (Orange active border matching screenshot)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: const Color(0xFFEA580C),
                width: 1.2,
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _selectedStatus,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF94A3B8),
                  size: 20,
                ),
                items: _statusOptions.map((opt) {
                  return DropdownMenuItem(
                    value: opt,
                    child: Text(
                      opt,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF1E1B2E),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedStatus = val);
                  }
                },
              ),
            ),
          ),

          const SizedBox(height: 36),

          // Empty state or Ticket List
          if (filteredTickets.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Column(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF8FAFC),
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.chat_bubble_outline_rounded,
                          size: 26,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      _selectedStatus == 'All statuses'
                          ? 'No tickets yet'
                          : 'No $_selectedStatus tickets',
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'When you need a hand, our support team is here.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: _openCreateTicketModal,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEA580C),
                        side: const BorderSide(color: Color(0xFFFDBA74)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 9,
                        ),
                      ),
                      child: const Text(
                        'Create a ticket',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
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
              itemCount: filteredTickets.length,
              separatorBuilder: (_, __) =>
                  const Divider(color: Color(0xFFF1F5F9), height: 16),
              itemBuilder: (context, idx) {
                final t = filteredTickets[idx];
                final id = t['id'] ?? '#TK-00$idx';
                final subject = t['subject'] ?? 'Support inquiry';
                final category = t['category'] ?? 'General';
                final status = (t['status'] ?? 'open').toString().toLowerCase();

                Color badgeBg = const Color(0xFFEEF2FF);
                Color badgeFg = const Color(0xFF4338CA);
                if (status == 'resolved' || status == 'closed') {
                  badgeBg = const Color(0xFFECFDF5);
                  badgeFg = const Color(0xFF059669);
                } else if (status == 'in progress') {
                  badgeBg = const Color(0xFFEFF6FF);
                  badgeFg = const Color(0xFF2563EB);
                }

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              id,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              subject,
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E1B2E),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              category,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: badgeBg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: badgeFg,
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

  // HELP CENTER PANEL
  Widget _buildHelpCenterPanel() {
    final query = _helpSearchQuery.trim().toLowerCase();
    final filteredFaqs = _faqData.where((faq) {
      if (query.isEmpty) return true;
      final q = (faq['question'] ?? '').toString().toLowerCase();
      final a = (faq['answer'] ?? '').toString().toLowerCase();
      final c = (faq['category'] ?? '').toString().toLowerCase();
      return q.contains(query) || a.contains(query) || c.contains(query);
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Search Input
        Container(
          height: 46,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF1E1B2E).withValues(alpha: 0.02),
                blurRadius: 6,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            children: [
              const SizedBox(width: 14),
              const Icon(
                Icons.search_rounded,
                size: 18,
                color: Color(0xFF94A3B8),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _helpSearchController,
                  onChanged: (val) =>
                      setState(() => _helpSearchQuery = val),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF1E1B2E),
                  ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    hintText: 'Search payments, bookings, refunds...',
                    hintStyle: TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF94A3B8),
                    ),
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              if (_helpSearchQuery.isNotEmpty)
                GestureDetector(
                  onTap: () {
                    _helpSearchController.clear();
                    setState(() => _helpSearchQuery = '');
                  },
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 10),
                    child: Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ),
            ],
          ),
        ),

        const SizedBox(height: 12),
        Text(
          '${filteredFaqs.length} help articles',
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 10),

        // Accordion FAQ Items
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: filteredFaqs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, idx) {
            final faq = filteredFaqs[idx];
            return Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Theme(
                data: Theme.of(context).copyWith(
                  dividerColor: Colors.transparent,
                ),
                child: ExpansionTile(
                  tilePadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  childrenPadding: const EdgeInsets.only(
                    left: 14,
                    right: 14,
                    bottom: 14,
                  ),
                  title: Text(
                    faq['question'],
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1B2E),
                      height: 1.3,
                    ),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      faq['category'],
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  children: [
                    const Divider(color: Color(0xFFF1F5F9)),
                    const SizedBox(height: 4),
                    Text(
                      faq['answer'],
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF475569),
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
