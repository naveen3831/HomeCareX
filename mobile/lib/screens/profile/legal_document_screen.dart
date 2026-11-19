import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class LegalSectionData {
  final String id;
  final String title;
  final List<String> content;

  const LegalSectionData({
    required this.id,
    required this.title,
    required this.content,
  });
}

class LegalDocumentScreen extends StatefulWidget {
  final String title;
  final String subtitle;
  final String description;
  final String lastUpdated;
  final String? pendingApprovalNotice;
  final List<LegalSectionData> sections;
  final String otherTitle;
  final IconData otherIcon;
  final bool isPrivacy;

  const LegalDocumentScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.lastUpdated,
    this.pendingApprovalNotice,
    required this.sections,
    required this.otherTitle,
    required this.otherIcon,
    required this.isPrivacy,
  });

  factory LegalDocumentScreen.privacy() {
    return const LegalDocumentScreen(
      title: 'Privacy Policy',
      subtitle: 'How we collect, use and protect your data.',
      description:
          'This Privacy Policy explains how HomeCareX collects, uses, shares, protects, and retains your personal information when you use our platform and home-services marketplace.',
      lastUpdated: 'October 1, 2026',
      pendingApprovalNotice: 'Legal copy pending approval — not production-approved.',
      otherTitle: 'Terms & Conditions',
      otherIcon: Icons.description_outlined,
      isPrivacy: true,
      sections: _privacySections,
    );
  }

  factory LegalDocumentScreen.terms() {
    return const LegalDocumentScreen(
      title: 'Terms & Conditions',
      subtitle: 'Rules, policies & platform terms of use.',
      description:
          'These Terms & Conditions govern your access to and use of the HomeCareX digital platform, website, and home-services marketplace.',
      lastUpdated: 'October 1, 2026',
      pendingApprovalNotice: 'Legal copy pending approval — not production-approved.',
      otherTitle: 'Privacy Policy',
      otherIcon: Icons.shield_outlined,
      isPrivacy: false,
      sections: _termsSections,
    );
  }

  @override
  State<LegalDocumentScreen> createState() => _LegalDocumentScreenState();

  static const List<LegalSectionData> _privacySections = [
    LegalSectionData(
      id: 'introduction',
      title: '1. Introduction',
      content: [
        'HomeCareX ("we", "our", or "us") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy describes how we collect, use, disclose, and safeguard your data when you visit our website, utilize our mobile applications, or engage with our on-demand home-services platform.',
        '• Policy Consent: By accessing our platform or requesting home services, you acknowledge that you have read and understood this Privacy Policy and consent to the data practices described herein.',
        '• Periodic Updates: We may update this policy periodically to reflect evolving platform capabilities, legal standards, or operational practices. We encourage you to review this page periodically to stay informed about how we safeguard your personal information.',
      ],
    ),
    LegalSectionData(
      id: 'information-collected',
      title: '2. Information We Collect',
      content: [
        'We collect information necessary to provide, coordinate, and improve home services on our digital platform. Depending on how you interact with HomeCareX, we collect information in three primary ways:',
        '• Direct Submissions: Information you provide directly to us (such as during account creation, service scheduling, or customer support inquiries).',
        '• Automated Tracking: Information collected automatically when you browse or navigate our digital platform (such as device metrics, IP address, and cookie identifiers).',
        '• Platform Interactions: Information received through platform interactions (such as service completion confirmations and customer feedback reviews).',
      ],
    ),
    LegalSectionData(
      id: 'personal-information',
      title: '3. Personal Information',
      content: [
        'When you register an account, request a service booking, or register interest as a service partner, we may collect personally identifiable information, including:',
        '• Contact Details: Full name, email address, and mobile phone number.',
        '• Service Address Details: Residential address, apartment/unit number, landmark, and postal code required for dispatching service professionals.',
        '• Account Credentials: Username, encrypted authentication passwords, and role permissions.',
        '• Communication Records: Customer support inquiries, message transcripts, and feedback ratings submitted through the platform.',
      ],
    ),
    LegalSectionData(
      id: 'location-data',
      title: '4. Location Information',
      content: [
        'Accurate location data is essential for our on-demand home-services marketplace to operate effectively.',
        'With your permission, we collect precise or approximate location information through your device (GPS, Wi-Fi network data, and IP address) to:',
        '• Service Availability Verification: Verify whether services are currently active in your neighborhood or city.',
        '• Nearby Partner Assignment: Connect your service request with nearby available Service Partners.',
        '• Navigation Support: Enable Service Partners to navigate accurately to your designated service address.',
        '• Real-Time Tracking: Provide real-time status updates (such as "En Route" and arrival notifications) during active bookings.',
        '• User Location Controls: You may control location tracking through your mobile device or browser settings, though disabling location permissions may affect service discovery and booking accuracy.',
      ],
    ),
    LegalSectionData(
      id: 'payment-information',
      title: '5. Payment Information',
      content: [
        '• Gateway Processing: When you make a payment for a booking through the Platform, financial transaction processing is handled securely by compliant third-party payment gateway providers.',
        '• No Raw Card Storage: HomeCareX does not store raw credit card numbers, debit card PINs, or CVV codes on our servers. Payment processors provide HomeCareX with transaction tokens, authorization confirmation numbers, and invoice summary details necessary for accounting and receipt generation.',
        '• TLS Encryption: All payment data transmitted through our web interfaces is encrypted using industry-standard Transport Layer Security (TLS) protocols.',
      ],
    ),
    LegalSectionData(
      id: 'usage-data',
      title: '6. Usage & Device Information',
      content: [
        'When you access the HomeCareX Platform, our servers automatically record certain technical and usage details, including:',
        '• Device Identifiers: Hardware model, operating system version, and unique browser signatures.',
        '• Network Metrics: Internet Protocol (IP) address, approximate geographic region, and Internet service provider.',
        '• Platform Activity: Pages viewed, services browsed, search queries entered, referral URLs, timestamps, and error logs.',
        '• Diagnostic Objective: This data helps our engineering team diagnose platform issues, maintain server performance, and enhance accessibility across various screen sizes and devices.',
      ],
    ),
    LegalSectionData(
      id: 'information-sharing',
      title: '7. How We Share Information',
      content: [
        'HomeCareX does not sell, rent, or trade your personal information to third parties for independent marketing purposes. We share information only in limited, legitimate circumstances essential to operating our marketplace:',
        '• Matched Service Partners: When you confirm a booking, we share your service address, contact name, phone number, and job scope details with the matched Service Partner solely to facilitate service delivery.',
        '• Technology Service Providers: We engage trusted technology vendors for cloud database hosting, SMS and email notification delivery, map APIs, and analytics support under strict confidentiality agreements.',
        '• Legal & Safety Compliance: We may disclose information if required by applicable law, court order, or governmental regulation, or when necessary to protect the safety, property, and legal rights of HomeCareX, our users, or the public.',
      ],
    ),
    LegalSectionData(
      id: 'cookies',
      title: '8. Cookies & Similar Technologies',
      content: [
        'HomeCareX uses cookies, web beacons, and local storage tokens to recognize your browser, maintain active login sessions, remember user preferences, and understand platform usage patterns.',
        '• Essential Cookies: Necessary for core platform operation, secure account authentication, and booking slot concurrency.',
        '• Functional Cookies: Remember your site preferences, such as selected city or display options.',
        '• Analytics Cookies: Help us measure platform performance, traffic volume, and page interaction metrics to improve user experience.',
        '• Browser Settings: You can configure your browser to reject cookies or alert you when cookies are being sent. Note that disabling essential cookies may impact platform functionality and access to authenticated features.',
      ],
    ),
    LegalSectionData(
      id: 'security',
      title: '9. Data Security',
      content: [
        '• Administrative & Technical Safeguards: HomeCareX employs administrative, organizational, and technical safeguards designed to protect personal information against unauthorized access, loss, misuse, or alteration.',
        '• Protective Measures: These measures include encrypted communication channels (TLS/HTTPS), salted password hashing, role-based access restrictions, firewall protections, and regular system vulnerability audits.',
        '• User Vigilance: While we strive to use commercially acceptable means to safeguard your personal data, no method of transmission over the Internet or electronic storage is completely impenetrable. We encourage you to use unique passwords and safeguard your account credentials.',
      ],
    ),
    LegalSectionData(
      id: 'retention',
      title: '10. Data Retention',
      content: [
        '• Operational Retention: We retain personal information for as long as your account remains active or as necessary to fulfill booking orders, provide customer support, and maintain platform integrity.',
        '• Legal & Tax Compliance: We may also retain certain information to comply with statutory legal, tax, accounting, and reporting obligations, resolve disputes, and enforce our agreements.',
        '• Secure Deletion & Anonymization: When personal data is no longer required for operational or legal purposes, it is securely deleted, anonymized, or isolated from active processing in accordance with our data retention guidelines.',
      ],
    ),
    LegalSectionData(
      id: 'user-rights',
      title: '11. User Rights & Third Parties',
      content: [
        'Subject to applicable privacy and data protection laws, you may exercise certain rights regarding your personal information:',
        '• Access & Review: You have the right to request access to the personal data we hold about you.',
        '• Profile Correction: You can update or correct your profile details, contact information, and saved addresses directly within your account settings.',
        '• Account Deletion: You may submit a request to deactivate your account and delete your associated personal data, subject to legal and financial retention requirements.',
        '• External Third-Party Links: Our Platform may contain links to external third-party services (such as map providers or social media platforms). We are not responsible for the privacy practices or content of third-party websites.',
      ],
    ),
    LegalSectionData(
      id: 'contact',
      title: '12. Contact Us',
      content: [
        'If you have any questions, concerns, or requests regarding this Privacy Policy or our data handling practices, please contact our Privacy & Grievance team through the following channels:',
        '• Email Support: privacy@homecarex.com or support@homecarex.com',
        '• Phone Helpline: +91 93902 12572',
        '• Headquarters Location: Hyderabad, Telangana, India',
        '• Response Commitment: We aim to acknowledge and address all privacy inquiries in a timely and responsible manner.',
      ],
    ),
  ];

  static const List<LegalSectionData> _termsSections = [
    LegalSectionData(
      id: 'introduction',
      title: '1. Introduction',
      content: [
        'Welcome to HomeCareX. These Terms and Conditions ("Terms") govern your access to and use of the HomeCareX website, mobile applications, technology platform, and related on-demand home-services marketplace (collectively, the "Platform").',
        '• Marketplace Role: HomeCareX operates as a digital technology platform that facilitates connections between individuals seeking residential maintenance services ("Customers") and independent verified professionals ("Service Partners").',
        '• Agreement to Terms: By accessing, registering for, or using the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.',
      ],
    ),
    LegalSectionData(
      id: 'eligibility',
      title: '2. Eligibility',
      content: [
        '• Age Requirement: To access and use the HomeCareX Platform, you must be at least 18 years of age and possess the legal capacity to enter into a legally binding contract.',
        '• Truthful Representation: By registering for an account or booking a service, you represent and warrant that all registration details submitted are truthful and accurate.',
      ],
    ),
    LegalSectionData(
      id: 'account',
      title: '3. Account Registration & Responsibilities',
      content: [
        '• Registration Details: You agree to provide accurate, current, and complete information during registration and keep such details updated.',
        '• Credential Security: You are solely responsible for maintaining the confidentiality of your account credentials, including password and access tokens.',
      ],
    ),
    LegalSectionData(
      id: 'services',
      title: '4. HomeCareX Services',
      content: [
        '• Curated Marketplace: HomeCareX enables Customers to discover, schedule, and coordinate various residential care and maintenance services.',
        '• Intermediary Role: HomeCareX acts solely as a digital technology intermediary connecting Customers with independent Service Partners.',
      ],
    ),
    LegalSectionData(
      id: 'booking',
      title: '5. Booking & Service Requests',
      content: [
        '• Service Requests: Customers may request services by selecting a catalogued service, specifying address, and picking an available arrival window.',
        '• Confirmation: A booking is confirmed once HomeCareX issues a digital confirmation with assigned partner status.',
      ],
    ),
    LegalSectionData(
      id: 'pricing',
      title: '6. Pricing & Estimates',
      content: [
        '• Published Rates: Pricing reflects standard base rates plus applicable taxes and transparent platform fees.',
        '• Additional Scope: Any extra parts or labor required on-site must be explicitly approved by the Customer prior to commencement.',
      ],
    ),
    LegalSectionData(
      id: 'payments',
      title: '7. Payments',
      content: [
        '• Payment Channels: Payments are processed through authorized payment gateways (UPI, Cards, NetBanking) or cash-on-service where supported.',
        '• Invoices: Digital receipts and tax invoices are automatically generated and stored in your booking history.',
      ],
    ),
    LegalSectionData(
      id: 'cancellation',
      title: '8. Cancellation Policy',
      content: [
        '• Free Cancellation: Cancellations made up to 2 hours before the scheduled appointment incur no fee.',
        '• Late Cancellation: A nominal cancellation fee may apply if canceled after a partner has been dispatched.',
      ],
    ),
    LegalSectionData(
      id: 'refund-policy',
      title: '9. Refund Policy',
      content: [
        '• Full Refunds: Unfulfilled or canceled bookings within permissible windows are refunded in full to the original payment source.',
        '• Processing: Standard banking clearance takes 3–5 business days once approved by HomeCareX.',
      ],
    ),
    LegalSectionData(
      id: 'customer-responsibilities',
      title: '10. Customer Responsibilities',
      content: [
        '• Premises Access: Provide safe and clear access to the service premises at the scheduled time.',
        '• Respectful Conduct: Maintain a safe and professional environment for all attending service professionals.',
      ],
    ),
    LegalSectionData(
      id: 'contact',
      title: '11. Contact & Grievance',
      content: [
        '• Email: support@homecarex.com',
        '• Toll-Free Helpline: +91 93902 12572',
      ],
    ),
  ];
}

class _LegalDocumentScreenState extends State<LegalDocumentScreen> {
  final Map<String, bool> _expanded = {};

  bool get _allExpanded =>
      widget.sections.isNotEmpty &&
      widget.sections.every((s) => _expanded[s.id] == true);

  void _toggleAll() {
    final nextState = !_allExpanded;
    setState(() {
      for (final s in widget.sections) {
        _expanded[s.id] = nextState;
      }
    });
  }

  void _toggleSection(String id) {
    setState(() {
      _expanded[id] = !(_expanded[id] ?? false);
    });
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
        title: Text(
          widget.title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. SUBTITLE
              Text(
                widget.subtitle,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 12),

              // 2. MAIN DESCRIPTION
              Text(
                widget.description,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF1E1B2E),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 10),

              // 3. LAST UPDATED
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                  children: [
                    const TextSpan(text: 'Last updated: '),
                    TextSpan(
                      text: widget.lastUpdated,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E1B2E),
                      ),
                    ),
                  ],
                ),
              ),

              // 4. PENDING APPROVAL NOTICE
              if (widget.pendingApprovalNotice != null) ...[
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 2, right: 6),
                      child: Icon(
                        Icons.error_outline_rounded,
                        size: 15,
                        color: Color(0xFFC2410C),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        widget.pendingApprovalNotice!,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFC2410C),
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 24),

              // 5. SECTIONS COUNT & EXPAND ALL
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${widget.sections.length} SECTIONS',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  GestureDetector(
                    onTap: _toggleAll,
                    child: Text(
                      _allExpanded ? 'Collapse all' : 'Expand all',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.brand,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // 6. ACCORDION SECTIONS
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: widget.sections.length,
                separatorBuilder: (_, __) =>
                    const Divider(color: Color(0xFFE2E8F0), height: 1),
                itemBuilder: (context, index) {
                  final section = widget.sections[index];
                  final isOpen = _expanded[section.id] ?? false;
                  final numberStr = (index + 1).toString().padLeft(2, '0');
                  final cleanTitle =
                      section.title.replaceFirst(RegExp(r'^\d+\.\s*'), '');

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Row
                      InkWell(
                        onTap: () => _toggleSection(section.id),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          child: Row(
                            children: [
                              // Number Badge
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEEECFB),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Center(
                                  child: Text(
                                    numberStr,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.brand,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),

                              // Section Title
                              Expanded(
                                child: Text(
                                  cleanTitle,
                                  style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF1E1B2E),
                                  ),
                                ),
                              ),

                              // Chevron Icon
                              AnimatedRotation(
                                turns: isOpen ? 0.5 : 0.0,
                                duration: const Duration(milliseconds: 200),
                                child: const Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  size: 20,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Expanded Body Content
                      if (isOpen)
                        Padding(
                          padding: const EdgeInsets.only(
                            left: 48,
                            right: 4,
                            bottom: 16,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: section.content.map((p) {
                              return _buildParagraph(p);
                            }).toList(),
                          ),
                        ),
                    ],
                  );
                },
              ),
              const Divider(color: Color(0xFFE2E8F0), height: 1),

              const SizedBox(height: 24),

              // 7. ALSO READ (Other legal document)
              GestureDetector(
                onTap: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => widget.isPrivacy
                          ? LegalDocumentScreen.terms()
                          : LegalDocumentScreen.privacy(),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEECFB),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(
                          widget.otherIcon,
                          color: AppColors.brand,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Also read',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.otherTitle,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E1B2E),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFF94A3B8),
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildParagraph(String text) {
    final isBullet = text.startsWith('•') || text.startsWith('-');
    final cleanText = isBullet ? text.replaceFirst(RegExp(r'^[•-]\s*'), '') : text;

    // Check for bold label before colon
    final colonIdx = cleanText.indexOf(':');
    final hasPrefix = colonIdx != -1 && colonIdx < 40;

    String? prefix;
    String body = cleanText;
    if (hasPrefix) {
      prefix = cleanText.substring(0, colonIdx + 1);
      body = cleanText.substring(colonIdx + 1).trim();
    }

    final textWidget = RichText(
      text: TextSpan(
        style: const TextStyle(
          fontSize: 13,
          color: Color(0xFF475569),
          height: 1.5,
        ),
        children: [
          if (prefix != null)
            TextSpan(
              text: '$prefix ',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E1B2E),
              ),
            ),
          TextSpan(text: body),
        ],
      ),
    );

    if (isBullet) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 5,
              height: 5,
              margin: const EdgeInsets.only(top: 7, right: 10),
              decoration: const BoxDecoration(
                color: AppColors.brand,
                shape: BoxShape.circle,
              ),
            ),
            Expanded(child: textWidget),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: textWidget,
    );
  }
}

