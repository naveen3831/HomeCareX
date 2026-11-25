import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../main_navigation_screen.dart';
import 'login_screen.dart';

class PartnerRegisterScreen extends StatefulWidget {
  const PartnerRegisterScreen({super.key});

  @override
  State<PartnerRegisterScreen> createState() => _PartnerRegisterScreenState();
}

class _PartnerRegisterScreenState extends State<PartnerRegisterScreen> {
  int _currentStep = 1;

  // Step 1: Personal Information
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  String? _gender;
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  // Step 2: Identity Proof
  String _idProofType = 'aadhaar';
  final _idProofNumberController = TextEditingController();
  String? _idProofFileName;

  // Step 3: Address Proof
  final _addressController = TextEditingController();
  final _cityController = TextEditingController(text: 'Hyderabad');
  final _stateController = TextEditingController(text: 'Telangana');
  final _pincodeController = TextEditingController();
  String? _addressProofFileName;

  // Step 4: Professional Details
  String _category = 'cleaning';
  final List<String> _selectedSkills = ['Deep Home Cleaning', 'Kitchen Cleaning'];
  String _experienceYears = '3';
  final _bioController = TextEditingController();
  double _serviceRadiusKm = 15;
  final List<String> _workingDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  final TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  final TimeOfDay _endTime = const TimeOfDay(hour: 18, minute: 0);

  // Step 5: Bank Details
  final _accountHolderController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _ifscController = TextEditingController();
  final _upiIdController = TextEditingController();
  bool _agreeTerms = false;

  final _formKey = GlobalKey<FormState>();
  String? _stepError;

  static const List<Map<String, String>> _idProofTypes = [
    {'value': 'aadhaar', 'label': 'Aadhaar Card'},
    {'value': 'pan', 'label': 'PAN Card'},
    {'value': 'voter_id', 'label': 'Voter ID'},
    {'value': 'driving_license', 'label': 'Driving License'},
    {'value': 'passport', 'label': 'Passport'},
  ];

  static const List<Map<String, String>> _categories = [
    {'value': 'cleaning', 'label': 'Cleaning & Pest Control'},
    {'value': 'appliances', 'label': 'Appliance Repair & Service'},
    {'value': 'plumbing', 'label': 'Plumbing & Electrical'},
    {'value': 'painting', 'label': 'Painting & Waterproofing'},
    {'value': 'salon', 'label': 'Salon & Spa'},
  ];

  static const Map<String, List<String>> _categorySkillsMap = {
    'cleaning': [
      'Deep Home Cleaning',
      'Kitchen Cleaning',
      'Bathroom Sanitization',
      'Sofa & Carpet Cleaning',
      'Pest Control',
    ],
    'appliances': [
      'AC Servicing & Repair',
      'Refrigerator Repair',
      'Washing Machine Repair',
      'Microwave & Oven Repair',
      'Water Purifier (RO) Repair',
    ],
    'plumbing': [
      'Pipe & Drain Repair',
      'Tap & Shower Fitting',
      'Switchboard & Wiring',
      'Ceiling Fan & Lights',
      'Water Motor Installation',
    ],
    'painting': [
      'Full Home Painting',
      'Wall Water Proofing',
      'Texture & Stencil Design',
      'Carpentry & Furniture Repair',
    ],
    'salon': [
      'Haircut & Styling',
      'Facial & Cleanup',
      'Manicure & Pedicure',
      'At-Home Spa Therapy',
    ],
  };

  static const List<String> _allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  void dispose() {
    _nameController.dispose();
    _dobController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _idProofNumberController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    _bioController.dispose();
    _accountHolderController.dispose();
    _accountNumberController.dispose();
    _ifscController.dispose();
    _upiIdController.dispose();
    super.dispose();
  }

  void _navigateBack() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => const MainNavigationScreen(initialIndex: 2),
        ),
      );
    }
  }

  void _navigateToLogin() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => const LoginScreen(),
        ),
      );
    }
  }

  bool _validateStep(int step) {
    setState(() => _stepError = null);

    if (step == 1) {
      if (_nameController.text.trim().isEmpty) {
        setState(() => _stepError = 'Please enter your full name');
        return false;
      }
      if (_dobController.text.trim().isEmpty) {
        setState(() => _stepError = 'Please select your date of birth');
        return false;
      }
      if (_gender == null || _gender!.isEmpty) {
        setState(() => _stepError = 'Please select your gender');
        return false;
      }
      final phone = _phoneController.text.trim();
      if (phone.isEmpty || phone.replaceAll(RegExp(r'\D'), '').length < 10) {
        setState(() => _stepError = 'Please enter a valid 10-digit mobile number');
        return false;
      }
      final email = _emailController.text.trim();
      if (email.isEmpty || !email.contains('@') || !email.contains('.')) {
        setState(() => _stepError = 'Please enter a valid email address');
        return false;
      }
      if (_passwordController.text.length < 6) {
        setState(() => _stepError = 'Password must be at least 6 characters');
        return false;
      }
      if (_passwordController.text != _confirmPasswordController.text) {
        setState(() => _stepError = 'Passwords do not match');
        return false;
      }
    } else if (step == 2) {
      if (_idProofNumberController.text.trim().isEmpty) {
        setState(() => _stepError = 'Please enter your ID proof document number');
        return false;
      }
    } else if (step == 3) {
      if (_addressController.text.trim().isEmpty) {
        setState(() => _stepError = 'Please enter your street address');
        return false;
      }
      if (_cityController.text.trim().isEmpty) {
        setState(() => _stepError = 'Please enter your city');
        return false;
      }
      final pincode = _pincodeController.text.trim();
      if (pincode.length != 6 || int.tryParse(pincode) == null) {
        setState(() => _stepError = 'Please enter a valid 6-digit postal pincode');
        return false;
      }
    } else if (step == 4) {
      if (_selectedSkills.isEmpty) {
        setState(() => _stepError = 'Please select at least one skill or service');
        return false;
      }
      if (_workingDays.isEmpty) {
        setState(() => _stepError = 'Please select at least one working day');
        return false;
      }
    } else if (step == 5) {
      if (_accountHolderController.text.trim().isEmpty) {
        setState(() => _stepError = 'Please enter the bank account holder name');
        return false;
      }
      final accNo = _accountNumberController.text.trim();
      if (accNo.length < 9) {
        setState(() => _stepError = 'Account number must be 9 to 18 digits');
        return false;
      }
      final ifsc = _ifscController.text.trim();
      if (ifsc.length < 4) {
        setState(() => _stepError = 'Please enter a valid bank IFSC code');
        return false;
      }
      if (!_agreeTerms) {
        setState(() => _stepError = 'Please agree to the Partner Terms & Conditions');
        return false;
      }
    }

    return true;
  }

  void _nextStep() {
    if (!_validateStep(_currentStep)) return;
    if (_currentStep < 5) {
      setState(() {
        _currentStep++;
        _stepError = null;
      });
    }
  }

  void _prevStep() {
    if (_currentStep > 1) {
      setState(() {
        _currentStep--;
        _stepError = null;
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_validateStep(5)) return;

    final auth = context.read<AuthProvider>();

    final partnerData = {
      'name': _nameController.text.trim(),
      'dob': _dobController.text.trim(),
      'gender': _gender,
      'phone': _phoneController.text.trim(),
      'email': _emailController.text.trim().toLowerCase(),
      'password': _passwordController.text,
      'confirmPassword': _confirmPasswordController.text,
      'idProofType': _idProofType,
      'idProofNumber': _idProofNumberController.text.trim().toUpperCase(),
      'address': _addressController.text.trim(),
      'city': _cityController.text.trim(),
      'state': _stateController.text.trim(),
      'pincode': _pincodeController.text.trim(),
      'category': _category,
      'skills': _selectedSkills,
      'experienceYears': int.tryParse(_experienceYears) ?? 3,
      'bio': _bioController.text.trim(),
      'serviceRadiusKm': _serviceRadiusKm.round(),
      'workingDays': _workingDays,
      'workingHoursStart': '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}',
      'workingHoursEnd': '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}',
      'accountHolder': _accountHolderController.text.trim(),
      'accountNumber': _accountNumberController.text.trim(),
      'ifsc': _ifscController.text.trim().toUpperCase(),
      'upiId': _upiIdController.text.trim(),
    };

    final success = await auth.registerPartner(partnerData);

    if (mounted) {
      if (success) {
        _showSuccessDialog();
      } else {
        setState(() {
          _stepError = auth.errorMessage ?? 'Partner registration failed. Please try again.';
        });
      }
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 36),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Application Submitted!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Thank you for registering as a HomeCareX Partner. Our team will verify your documents within 24 hours. You can sign in once verified.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.45),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: const Text('Back to Login', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Bar: Back to Home (left) & Brand Logo (right)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    GestureDetector(
                      onTap: _navigateBack,
                      behavior: HitTestBehavior.opaque,
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.arrow_back_rounded, size: 18, color: Color(0xFF64748B)),
                          SizedBox(width: 4),
                          Text(
                            'Back to Home',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Image.asset(
                      'assets/images/logo.png',
                      height: 24,
                      fit: BoxFit.contain,
                      semanticLabel: 'HOMECAREX',
                      errorBuilder: (_, __, ___) => const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.home_rounded, color: Color(0xFFFF9548), size: 20),
                          SizedBox(width: 4),
                          Text(
                            'HOMECAREX',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Pill Badge: Partner Registration
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFDBEAFE)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.bolt_rounded, size: 14, color: Color(0xFF2563EB)),
                        SizedBox(width: 4),
                        Text(
                          'Partner Registration',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2563EB),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                // Main Title & Subtitle matching web screenshot
                const Text(
                  'Become a HomeCareX Partner',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Register your business and start receiving service bookings.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF64748B),
                    height: 1.35,
                  ),
                ),

                const SizedBox(height: 16),

                // Linear Progress Bar (Step 1 to 5)
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _currentStep / 5.0,
                    minHeight: 4,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                  ),
                ),

                const SizedBox(height: 20),

                // Error Banner (if any)
                if (_stepError != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _stepError!,
                            style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // Step Content Wizard
                if (_currentStep == 1) _buildStep1Personal(),
                if (_currentStep == 2) _buildStep2Identity(),
                if (_currentStep == 3) _buildStep3Address(),
                if (_currentStep == 4) _buildStep4Professional(),
                if (_currentStep == 5) _buildStep5Bank(auth.isLoading),

                const SizedBox(height: 28),

                // Navigation Buttons (Back & Continue)
                Row(
                  children: [
                    if (_currentStep > 1) ...[
                      Expanded(
                        flex: 1,
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton(
                            onPressed: _prevStep,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF475569),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('← Back', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      flex: _currentStep > 1 ? 2 : 1,
                      child: SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          onPressed: auth.isLoading
                              ? null
                              : (_currentStep == 5 ? _handleSubmit : _nextStep),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          child: auth.isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : Text(
                                  _currentStep == 5
                                      ? 'Submit Application ✓'
                                      : 'Continue to Step ${_currentStep + 1} →',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // Link: Already registered as a partner? Sign in here
                Center(
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Text(
                        'Already registered as a partner? ',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _navigateToLogin,
                        child: const Text(
                          'Sign in here',
                          style: TextStyle(
                            color: Color(0xFF2563EB),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Trust Badges
                Container(
                  padding: const EdgeInsets.only(top: 14),
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: Color(0xFFF1F5F9)),
                    ),
                  ),
                  child: const Center(
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.verified_user_outlined, size: 13, color: Color(0xFF10B981)),
                            SizedBox(width: 4),
                            Text(
                              'Verified Platform',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                        Text('•', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 10)),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.flash_on_rounded, size: 13, color: Color(0xFF2563EB)),
                            SizedBox(width: 4),
                            Text(
                              'Fast Payouts',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                        Text('•', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 10)),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.workspace_premium_outlined, size: 13, color: Color(0xFF8B5CF6)),
                            SizedBox(width: 4),
                            Text(
                              'Instant Bookings',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ================= STEP 1: PERSONAL INFORMATION =================
  Widget _buildStep1Personal() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header Row
        _buildSectionHeader(
          title: 'Section A: Personal Information',
          subtitle: 'Basic profile information for your partner identity',
          stepBadge: 'Step 1 of 5',
        ),
        const SizedBox(height: 16),

        // Full Name
        _buildLabel('Full Name'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _nameController,
          hint: 'e.g. Ramesh Kumar',
          icon: Icons.person_outline_rounded,
        ),
        const SizedBox(height: 14),

        // Date of Birth & Gender (2 Columns matching screenshot)
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildLabel('Date of Birth'),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: DateTime(1995, 1, 1),
                        firstDate: DateTime(1950),
                        lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
                      );
                      if (picked != null) {
                        final formatted = '${picked.day.toString().padLeft(2, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.year}';
                        setState(() => _dobController.text = formatted);
                      }
                    },
                    child: AbsorbPointer(
                      child: _buildTextField(
                        controller: _dobController,
                        hint: 'dd-mm-yyyy',
                        icon: Icons.calendar_today_outlined,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildLabel('Gender'),
                  const SizedBox(height: 6),
                  Container(
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _gender,
                        hint: const Text(
                          'Select Gender',
                          style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                        ),
                        isExpanded: true,
                        icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF64748B)),
                        items: ['Male', 'Female', 'Other']
                            .map((g) => DropdownMenuItem(value: g, child: Text(g, style: const TextStyle(fontSize: 13))))
                            .toList(),
                        onChanged: (val) => setState(() => _gender = val),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Mobile Number
        _buildLabel('Mobile Number'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _phoneController,
          hint: '9876543210',
          icon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 14),

        // Email Address
        _buildLabel('Email Address'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _emailController,
          hint: 'ramesh@example.com',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 14),

        // Create Password
        _buildLabel('Create Password'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _passwordController,
          hint: '••••••••',
          icon: Icons.lock_outline_rounded,
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              size: 18,
              color: const Color(0xFF94A3B8),
            ),
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
          ),
        ),
        const SizedBox(height: 14),

        // Confirm Password
        _buildLabel('Confirm Password'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _confirmPasswordController,
          hint: '••••••••',
          icon: Icons.lock_outline_rounded,
          obscureText: _obscureConfirmPassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureConfirmPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              size: 18,
              color: const Color(0xFF94A3B8),
            ),
            onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
          ),
        ),
      ],
    );
  }

  // ================= STEP 2: IDENTITY PROOF =================
  Widget _buildStep2Identity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Section B: Identity Proof',
          subtitle: 'Government-issued ID verification for safety',
          stepBadge: 'Step 2 of 5',
        ),
        const SizedBox(height: 16),

        _buildLabel('ID Proof Type'),
        const SizedBox(height: 6),
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _idProofType,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF64748B)),
              items: _idProofTypes
                  .map((t) => DropdownMenuItem(value: t['value'], child: Text(t['label']!, style: const TextStyle(fontSize: 13))))
                  .toList(),
              onChanged: (val) => setState(() => _idProofType = val!),
            ),
          ),
        ),
        const SizedBox(height: 14),

        _buildLabel('ID Proof Number'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _idProofNumberController,
          hint: 'e.g. 1234 5678 9012',
          icon: Icons.badge_outlined,
        ),
        const SizedBox(height: 16),

        _buildLabel('Upload ID Document (Optional)'),
        const SizedBox(height: 6),
        _buildUploadBox(
          fileName: _idProofFileName,
          onTap: () {
            setState(() => _idProofFileName = 'aadhaar_front_back.pdf');
          },
          onRemove: () {
            setState(() => _idProofFileName = null);
          },
        ),
      ],
    );
  }

  // ================= STEP 3: ADDRESS PROOF =================
  Widget _buildStep3Address() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Section C: Address Proof',
          subtitle: 'Operational and communication address',
          stepBadge: 'Step 3 of 5',
        ),
        const SizedBox(height: 16),

        _buildLabel('Street / House Address'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _addressController,
          hint: 'Flat 402, Sri Sai Nilayam, Madhapur',
          icon: Icons.location_on_outlined,
        ),
        const SizedBox(height: 14),

        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildLabel('City'),
                  const SizedBox(height: 6),
                  _buildTextField(controller: _cityController, hint: 'Hyderabad', icon: Icons.location_city_rounded),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildLabel('State'),
                  const SizedBox(height: 6),
                  _buildTextField(controller: _stateController, hint: 'Telangana', icon: Icons.map_outlined),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        _buildLabel('Pincode'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _pincodeController,
          hint: '500081',
          icon: Icons.pin_drop_outlined,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 16),

        _buildLabel('Upload Address Document (Optional)'),
        const SizedBox(height: 6),
        _buildUploadBox(
          fileName: _addressProofFileName,
          onTap: () {
            setState(() => _addressProofFileName = 'electricity_bill.pdf');
          },
          onRemove: () {
            setState(() => _addressProofFileName = null);
          },
        ),
      ],
    );
  }

  // ================= STEP 4: PROFESSIONAL DETAILS =================
  Widget _buildStep4Professional() {
    final availableSkills = _categorySkillsMap[_category] ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Section D: Professional Details',
          subtitle: 'Service category, expertise and availability',
          stepBadge: 'Step 4 of 5',
        ),
        const SizedBox(height: 16),

        _buildLabel('Primary Service Category'),
        const SizedBox(height: 6),
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _category,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF64748B)),
              items: _categories
                  .map((c) => DropdownMenuItem(value: c['value'], child: Text(c['label']!, style: const TextStyle(fontSize: 13))))
                  .toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _category = val;
                    _selectedSkills.clear();
                    _selectedSkills.addAll((_categorySkillsMap[val] ?? []).take(2));
                  });
                }
              },
            ),
          ),
        ),
        const SizedBox(height: 16),

        _buildLabel('Specific Skills & Services'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: availableSkills.map((skill) {
            final isSelected = _selectedSkills.contains(skill);
            return FilterChip(
              label: Text(skill),
              selected: isSelected,
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    _selectedSkills.add(skill);
                  } else {
                    _selectedSkills.remove(skill);
                  }
                });
              },
              backgroundColor: const Color(0xFFF1F5F9),
              selectedColor: const Color(0xFFDBEAFE),
              labelStyle: TextStyle(
                fontSize: 12,
                color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF334155),
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              ),
              checkmarkColor: const Color(0xFF1D4ED8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              side: BorderSide(color: isSelected ? const Color(0xFF93C5FD) : Colors.transparent),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),

        _buildLabel('Years of Experience'),
        const SizedBox(height: 6),
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _experienceYears,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF64748B)),
              items: ['1', '2', '3', '5', '8', '10', '15']
                  .map((y) => DropdownMenuItem(value: y, child: Text('$y years', style: const TextStyle(fontSize: 13))))
                  .toList(),
              onChanged: (val) => setState(() => _experienceYears = val ?? '3'),
            ),
          ),
        ),
        const SizedBox(height: 16),

        _buildLabel('Working Days'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _allDays.map((day) {
            final isSelected = _workingDays.contains(day);
            return GestureDetector(
              onTap: () {
                setState(() {
                  if (isSelected) {
                    _workingDays.remove(day);
                  } else {
                    _workingDays.add(day);
                  }
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  day,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    color: isSelected ? Colors.white : const Color(0xFF475569),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),

        _buildLabel('Service Radius: ${_serviceRadiusKm.round()} km'),
        Slider(
          value: _serviceRadiusKm,
          min: 5,
          max: 50,
          divisions: 9,
          activeColor: const Color(0xFF2563EB),
          label: '${_serviceRadiusKm.round()} km',
          onChanged: (val) => setState(() => _serviceRadiusKm = val),
        ),
      ],
    );
  }

  // ================= STEP 5: BANK & PAYOUT DETAILS =================
  Widget _buildStep5Bank(bool isLoading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Section E: Bank & Payout Details',
          subtitle: 'Direct weekly payout deposits into your bank',
          stepBadge: 'Step 5 of 5',
        ),
        const SizedBox(height: 16),

        // Direct Activation Banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFA7F3D0)),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.stars_rounded, color: Color(0xFF059669), size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Direct Partner Activation',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Your partner profile is reviewed and activated promptly. Weekly payouts are credited directly to your bank account.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF047857), height: 1.35),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        _buildLabel('Account Holder Name'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _accountHolderController,
          hint: 'As per bank passbook or cheque',
          icon: Icons.person_outline_rounded,
        ),
        const SizedBox(height: 14),

        _buildLabel('Bank Account Number'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _accountNumberController,
          hint: 'e.g. 123456789012',
          icon: Icons.account_balance_outlined,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 14),

        _buildLabel('IFSC Code'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _ifscController,
          hint: 'e.g. SBIN0001234',
          icon: Icons.business_rounded,
        ),
        const SizedBox(height: 14),

        _buildLabel('UPI ID (Optional)'),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _upiIdController,
          hint: 'e.g. ramesh@upi',
          icon: Icons.alternate_email_rounded,
        ),
        const SizedBox(height: 18),

        // Terms and conditions checkbox
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: _agreeTerms,
                activeColor: const Color(0xFF2563EB),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                onChanged: (val) => setState(() => _agreeTerms = val ?? false),
              ),
            ),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'I agree to the HomeCareX Partner Terms & Conditions, Code of Conduct, and Service Agreement.',
                style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.35),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ================= HELPER WIDGETS =================
  Widget _buildSectionHeader({
    required String title,
    required String subtitle,
    required String stepBadge,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Text(
            stepBadge,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1D4ED8),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF334155),
          ),
        ),
        if (!text.contains('(Optional)'))
          const Text(
            ' *',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFFEF4444),
            ),
          ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 13.5, color: Color(0xFF0F172A)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
        prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 19),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
        ),
      ),
    );
  }

  Widget _buildUploadBox({
    required String? fileName,
    required VoidCallback onTap,
    required VoidCallback onRemove,
  }) {
    if (fileName != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFBFDBFE)),
        ),
        child: Row(
          children: [
            const Icon(Icons.description_rounded, color: Color(0xFF2563EB), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                fileName,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
              ),
            ),
            GestureDetector(
              onTap: onRemove,
              child: const Icon(Icons.close_rounded, color: Color(0xFFEF4444), size: 18),
            ),
          ],
        ),
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFCBD5E1), style: BorderStyle.solid),
        ),
        child: const Center(
          child: Column(
            children: [
              Icon(Icons.cloud_upload_outlined, color: Color(0xFF64748B), size: 28),
              SizedBox(height: 6),
              Text(
                'Tap to select document (PDF, PNG, JPG)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
              ),
              SizedBox(height: 2),
              Text(
                'Maximum size: 5MB',
                style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
