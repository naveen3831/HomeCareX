import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool autoSubmit;
  final String? initialEmail;

  const ChangePasswordScreen({
    super.key,
    this.autoSubmit = true,
    this.initialEmail,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final TextEditingController _currentPasswordController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  bool _showCurrentPassword = false;
  bool _showNewPassword = false;
  bool _showConfirmPassword = false;

  bool _isSubmitting = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void initState() {
    super.initState();
    _newPasswordController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // Password criteria checks
  bool get _hasMinLength => _newPasswordController.text.length >= 8;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_newPasswordController.text);
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_newPasswordController.text);
  bool get _hasSpecialChar => RegExp(r'[^A-Za-z0-9]').hasMatch(_newPasswordController.text);
  bool get _allRulesMet => _hasMinLength && _hasUppercase && _hasNumber && _hasSpecialChar;

  void _showForgotPasswordSheet(BuildContext context) {
    final emailController = TextEditingController(text: widget.initialEmail ?? '');
    String? localNotice;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Forgot Password',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                        onPressed: () => Navigator.of(modalCtx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Enter your registered email address and we will send you a password reset link.',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      hintText: 'name@example.com',
                      labelText: 'EMAIL ADDRESS',
                      labelStyle: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: Color(0xFF64748B),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF4338CA), width: 1.5),
                      ),
                    ),
                  ),
                  if (localNotice != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      localNotice!,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF059669)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4338CA),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed: () async {
                        final email = emailController.text.trim();
                        if (email.isEmpty) return;
                        try {
                          await ApiService.post(ApiConstants.forgotPassword, {'email': email});
                        } catch (_) {}
                        setModalState(() {
                          localNotice = 'Reset instructions sent to $email';
                        });
                        await Future.delayed(const Duration(milliseconds: 1200));
                        if (modalCtx.mounted) Navigator.of(modalCtx).pop();
                      },
                      child: const Text('Send Reset Link', style: TextStyle(fontWeight: FontWeight.bold)),
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

  Future<void> _handleSubmit() async {
    final currentPw = _currentPasswordController.text;
    final newPw = _newPasswordController.text;
    final confirmPw = _confirmPasswordController.text;

    setState(() {
      _errorMessage = null;
      _successMessage = null;
    });

    if (currentPw.isEmpty) {
      setState(() => _errorMessage = 'Please enter your current password.');
      return;
    }

    if (!_allRulesMet) {
      setState(() => _errorMessage = 'Please meet all password requirements.');
      return;
    }

    if (newPw != confirmPw) {
      setState(() => _errorMessage = 'New password and confirmation do not match.');
      return;
    }

    if (currentPw == newPw) {
      setState(() => _errorMessage = 'New password must be different from current password.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      if (widget.autoSubmit) {
        final payload = {
          'currentPassword': currentPw,
          'newPassword': newPw,
          'confirmPassword': confirmPw,
        };
        final res = await ApiService.post(ApiConstants.changePassword, payload);
        if (res is Map && res['success'] == false) {
          throw Exception(res['message'] ?? 'Failed to update password');
        }
      }

      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _successMessage = 'Password updated successfully.';
          _currentPasswordController.clear();
          _newPasswordController.clear();
          _confirmPasswordController.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
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
          'Change password',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Subtitle Text
              const Text(
                'Use a strong password you don\'t use anywhere else.',
                style: TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF64748B),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 22),

              // Error Banner
              if (_errorMessage != null) ...[
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF991B1B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Success Banner
              if (_successMessage != null) ...[
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _successMessage!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF065F46),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // 1. CURRENT PASSWORD FIELD
              _buildFieldLabel('CURRENT PASSWORD'),
              const SizedBox(height: 8),
              _buildPasswordField(
                controller: _currentPasswordController,
                showPassword: _showCurrentPassword,
                onToggleVisibility: () => setState(() => _showCurrentPassword = !_showCurrentPassword),
              ),
              const SizedBox(height: 8),

              // Forgot your password link aligned right
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  onTap: () => _showForgotPasswordSheet(context),
                  child: const Text(
                    'Forgot your password?',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF4338CA),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // 2. NEW PASSWORD FIELD
              _buildFieldLabel('NEW PASSWORD'),
              const SizedBox(height: 8),
              _buildPasswordField(
                controller: _newPasswordController,
                showPassword: _showNewPassword,
                onToggleVisibility: () => setState(() => _showNewPassword = !_showNewPassword),
              ),
              const SizedBox(height: 12),

              // Dynamic Password Rules Checklist
              _buildRuleRow('At least 8 characters', _hasMinLength),
              _buildRuleRow('An uppercase letter', _hasUppercase),
              _buildRuleRow('A number', _hasNumber),
              _buildRuleRow('A special character', _hasSpecialChar),
              const SizedBox(height: 20),

              // 3. CONFIRM NEW PASSWORD FIELD
              _buildFieldLabel('CONFIRM NEW PASSWORD'),
              const SizedBox(height: 8),
              _buildPasswordField(
                controller: _confirmPasswordController,
                showPassword: _showConfirmPassword,
                onToggleVisibility: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
              ),
              const SizedBox(height: 28),

              // 4. UPDATE PASSWORD BUTTON
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4338CA),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Update password',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Color(0xFF64748B),
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required bool showPassword,
    required VoidCallback onToggleVisibility,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TextField(
        controller: controller,
        obscureText: !showPassword,
        style: const TextStyle(
          fontSize: 14.5,
          color: Color(0xFF1E1B2E),
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          filled: false,
          suffixIcon: IconButton(
            icon: Icon(
              showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 20,
              color: const Color(0xFF94A3B8),
            ),
            onPressed: onToggleVisibility,
          ),
        ),
      ),
    );
  }

  Widget _buildRuleRow(String ruleText, bool isMet) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        children: [
          Icon(
            isMet ? Icons.check_rounded : Icons.close_rounded,
            size: 15,
            color: isMet ? const Color(0xFF059669) : const Color(0xFF94A3B8),
          ),
          const SizedBox(width: 8),
          Text(
            ruleText,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isMet ? FontWeight.w600 : FontWeight.w400,
              color: isMet ? const Color(0xFF059669) : const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }
}
