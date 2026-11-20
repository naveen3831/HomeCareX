import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/models/address_model.dart';
import '../../core/services/api_service.dart';

class SavedAddressesScreen extends StatefulWidget {
  final bool autoFetch;
  final List<CustomerAddress>? initialAddresses;

  const SavedAddressesScreen({
    super.key,
    this.autoFetch = true,
    this.initialAddresses,
  });

  @override
  State<SavedAddressesScreen> createState() => _SavedAddressesScreenState();
}

class _SavedAddressesScreenState extends State<SavedAddressesScreen> {
  late List<CustomerAddress> _addresses;
  bool _isLoading = false;
  String? _statusBanner;
  bool _isErrorBanner = false;

  @override
  void initState() {
    super.initState();
    _addresses = widget.initialAddresses != null
        ? List<CustomerAddress>.from(widget.initialAddresses!)
        : [];
    if (widget.autoFetch && widget.initialAddresses == null) {
      _fetchAddresses();
    }
  }

  Future<void> _fetchAddresses() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.get(ApiConstants.addresses);
      if (res != null && res is Map && res['addresses'] is List) {
        final list = (res['addresses'] as List)
            .map((item) => CustomerAddress.fromJson(item as Map<String, dynamic>))
            .toList();
        if (mounted) {
          setState(() {
            _addresses = list;
          });
        }
      }
    } catch (_) {
      // Fallback or keep empty
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteAddress(CustomerAddress address) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete address?'),
        content: Text(
          'Are you sure you want to remove your ${address.label} address (${address.city})?',
          style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep it', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ApiService.delete('${ApiConstants.addresses}/${address.id}');
      if (mounted) {
        setState(() {
          _addresses.removeWhere((a) => a.id == address.id);
          _statusBanner = '${address.label} address removed.';
          _isErrorBanner = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusBanner = 'Failed to delete address.';
          _isErrorBanner = true;
        });
      }
    }
  }

  Future<void> _setDefaultAddress(CustomerAddress address) async {
    try {
      await ApiService.patch('${ApiConstants.addresses}/${address.id}', {'isDefault': true});
      if (mounted) {
        setState(() {
          _addresses = _addresses.map((a) {
            return CustomerAddress(
              id: a.id,
              label: a.label,
              house: a.house,
              street: a.street,
              area: a.area,
              line1: a.line1,
              line2: a.line2,
              landmark: a.landmark,
              city: a.city,
              state: a.state,
              pincode: a.pincode,
              isDefault: a.id == address.id,
              serviceable: a.serviceable,
            );
          }).toList();
          _statusBanner = '${address.label} set as default address.';
          _isErrorBanner = false;
        });
      }
    } catch (_) {}
  }

  void _showAddressFormModal({CustomerAddress? initial}) {
    final isEditing = initial != null;
    String selectedLabel = initial?.label ?? 'Home';
    final houseCtrl = TextEditingController(text: initial?.house ?? '');
    final streetCtrl = TextEditingController(text: initial?.street ?? '');
    final areaCtrl = TextEditingController(text: initial?.area ?? '');
    final landmarkCtrl = TextEditingController(text: initial?.landmark ?? '');
    final cityCtrl = TextEditingController(text: initial?.city ?? 'Bengaluru');
    final stateCtrl = TextEditingController(text: initial?.state ?? 'Karnataka');
    final pincodeCtrl = TextEditingController(text: initial?.pincode ?? '');
    bool isDefault = initial?.isDefault ?? (_addresses.isEmpty);

    String? validationError;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalCtx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isEditing ? 'Edit Address' : 'Add New Address',
                          style: const TextStyle(
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
                    const SizedBox(height: 12),

                    // Label chips
                    _buildFieldLabel('ADDRESS LABEL'),
                    const SizedBox(height: 8),
                    Row(
                      children: ['Home', 'Work', 'Other'].map((lbl) {
                        final isSel = selectedLabel == lbl;
                        IconData iconData = Icons.location_on_outlined;
                        if (lbl == 'Home') iconData = Icons.home_outlined;
                        if (lbl == 'Work') iconData = Icons.work_outline_rounded;

                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            avatar: Icon(iconData, size: 16, color: isSel ? Colors.white : const Color(0xFF64748B)),
                            label: Text(lbl),
                            selected: isSel,
                            selectedColor: const Color(0xFF4338CA),
                            labelStyle: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: isSel ? Colors.white : const Color(0xFF475569),
                            ),
                            backgroundColor: const Color(0xFFF1F5F9),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            side: BorderSide.none,
                            onSelected: (_) {
                              setModalState(() => selectedLabel = lbl);
                            },
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),

                    // Validation Error banner
                    if (validationError != null) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          validationError!,
                          style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                        ),
                      ),
                    ],

                    // House / Flat No
                    _buildFieldLabel('HOUSE / FLAT / BUILDING NO.'),
                    const SizedBox(height: 6),
                    _buildTextInput(houseCtrl, 'e.g. Flat 402, Green Glen Apartments'),
                    const SizedBox(height: 12),

                    // Street / Road
                    _buildFieldLabel('STREET / ROAD'),
                    const SizedBox(height: 6),
                    _buildTextInput(streetCtrl, 'e.g. 100 Feet Road, 4th Cross'),
                    const SizedBox(height: 12),

                    // Area
                    _buildFieldLabel('AREA / LOCALITY'),
                    const SizedBox(height: 6),
                    _buildTextInput(areaCtrl, 'e.g. Indiranagar'),
                    const SizedBox(height: 12),

                    // Landmark
                    _buildFieldLabel('LANDMARK (OPTIONAL)'),
                    const SizedBox(height: 6),
                    _buildTextInput(landmarkCtrl, 'e.g. Near Metro Station'),
                    const SizedBox(height: 12),

                    // City & Pincode in Row
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildFieldLabel('CITY'),
                              const SizedBox(height: 6),
                              _buildTextInput(cityCtrl, 'Bengaluru'),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildFieldLabel('PINCODE'),
                              const SizedBox(height: 6),
                              _buildTextInput(pincodeCtrl, '560038', keyboardType: TextInputType.number),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Make default checkbox
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: isDefault,
                      dense: true,
                      activeColor: const Color(0xFF4338CA),
                      title: const Text(
                        'Make this my default address',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF1E1B2E)),
                      ),
                      onChanged: (val) => setModalState(() => isDefault = val ?? false),
                    ),
                    const SizedBox(height: 16),

                    // Submit button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4338CA),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () async {
                          if (houseCtrl.text.trim().isEmpty) {
                            setModalState(() => validationError = 'Enter house or flat number.');
                            return;
                          }
                          if (cityCtrl.text.trim().isEmpty) {
                            setModalState(() => validationError = 'Enter city name.');
                            return;
                          }
                          if (pincodeCtrl.text.trim().length != 6) {
                            setModalState(() => validationError = 'Enter a valid 6-digit pincode.');
                            return;
                          }

                          final payload = {
                            'label': selectedLabel,
                            'house': houseCtrl.text.trim(),
                            'street': streetCtrl.text.trim(),
                            'area': areaCtrl.text.trim(),
                            'landmark': landmarkCtrl.text.trim(),
                            'city': cityCtrl.text.trim(),
                            'state': stateCtrl.text.trim(),
                            'pincode': pincodeCtrl.text.trim(),
                            'isDefault': isDefault,
                          };

                          try {
                            if (isEditing) {
                              await ApiService.patch('${ApiConstants.addresses}/${initial.id}', payload);
                            } else {
                              await ApiService.post(ApiConstants.addresses, payload);
                            }
                          } catch (_) {}

                          final newAddress = CustomerAddress(
                            id: isEditing ? initial.id : 'addr-${DateTime.now().millisecondsSinceEpoch}',
                            label: selectedLabel,
                            house: houseCtrl.text.trim(),
                            street: streetCtrl.text.trim(),
                            area: areaCtrl.text.trim(),
                            landmark: landmarkCtrl.text.trim(),
                            city: cityCtrl.text.trim(),
                            state: stateCtrl.text.trim(),
                            pincode: pincodeCtrl.text.trim(),
                            isDefault: isDefault,
                          );

                          setState(() {
                            if (isEditing) {
                              _addresses = _addresses.map((a) => a.id == newAddress.id ? newAddress : (isDefault ? CustomerAddress(id: a.id, label: a.label, house: a.house, street: a.street, area: a.area, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, isDefault: false, serviceable: a.serviceable) : a)).toList();
                            } else {
                              if (isDefault) {
                                _addresses = _addresses.map((a) => CustomerAddress(id: a.id, label: a.label, house: a.house, street: a.street, area: a.area, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, isDefault: false, serviceable: a.serviceable)).toList();
                              }
                              _addresses.add(newAddress);
                            }
                            _statusBanner = isEditing ? 'Address updated.' : 'New address saved.';
                            _isErrorBanner = false;
                          });

                          if (modalCtx.mounted) Navigator.pop(modalCtx);
                        },
                        child: Text(
                          isEditing ? 'Update Address' : 'Save Address',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E1B2E), size: 22),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: const Text(
          'Saved addresses',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF4338CA)))
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Subtitle matching screenshot
                    const Text(
                      'Choose where we should come. Your selected address shows on the dashboard.',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF64748B),
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Status Banner
                    if (_statusBanner != null) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                        decoration: BoxDecoration(
                          color: _isErrorBanner ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _isErrorBanner ? const Color(0xFFFECACA) : const Color(0xFFA7F3D0),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _isErrorBanner ? Icons.error_outline_rounded : Icons.check_circle_rounded,
                              color: _isErrorBanner ? const Color(0xFFDC2626) : const Color(0xFF059669),
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _statusBanner!,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: _isErrorBanner ? const Color(0xFF991B1B) : const Color(0xFF065F46),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Empty State or Address List
                    if (_addresses.isEmpty) ...[
                      _buildEmptyStateCard(),
                    ] else ...[
                      // "Add new address" dashed top banner button
                      GestureDetector(
                        onTap: () => _showAddressFormModal(),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2FF).withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFC7D2FE), width: 1.2),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF4338CA),
                                  shape: BoxShape.circle,
                                ),
                                child: const Center(
                                  child: Icon(Icons.add_rounded, color: Colors.white, size: 20),
                                ),
                              ),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Add new address',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF4338CA),
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Home, work or anywhere we should reach you',
                                      style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // List of saved address cards
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _addresses.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (ctx, index) {
                          return _buildAddressCard(_addresses[index]);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  // Empty state card matching screenshot 1:1
  Widget _buildEmptyStateCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 36),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.location_on_outlined,
            size: 28,
            color: Color(0xFF94A3B8),
          ),
          const SizedBox(height: 14),
          const Text(
            'No saved addresses yet',
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E1B2E),
            ),
          ),
          const SizedBox(height: 6),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Add where you\'d like services delivered. You can save Home, Work and more.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12.5,
                color: Color(0xFF64748B),
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 44,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4338CA),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 22),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () => _showAddressFormModal(),
              child: const Text(
                'Add your first address',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddressCard(CustomerAddress address) {
    IconData iconData = Icons.location_on_outlined;
    if (address.label.toLowerCase().contains('home')) iconData = Icons.home_outlined;
    if (address.label.toLowerCase().contains('work') || address.label.toLowerCase().contains('office')) {
      iconData = Icons.work_outline_rounded;
    }

    final fullLines = address.formattedAddress;
    final cityPincode = '${address.city} ${address.pincode}'.trim();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: address.isDefault ? const Color(0xFF4338CA).withValues(alpha: 0.5) : const Color(0xFFF1F5F9),
          width: address.isDefault ? 1.5 : 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(iconData, size: 18, color: const Color(0xFF4338CA)),
                const SizedBox(width: 8),
                Text(
                  address.label,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
                if (address.isDefault) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Selected',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF4338CA),
                      ),
                    ),
                  ),
                ],
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF64748B)),
                  onPressed: () => _showAddressFormModal(initial: address),
                  constraints: const BoxConstraints(),
                  padding: const EdgeInsets.all(4),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                  onPressed: () => _deleteAddress(address),
                  constraints: const BoxConstraints(),
                  padding: const EdgeInsets.all(4),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              fullLines,
              style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.35),
            ),
            if (address.landmark != null && address.landmark!.isNotEmpty) ...[
              const SizedBox(height: 3),
              Text(
                'Near ${address.landmark!}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ],
            const SizedBox(height: 3),
            Text(
              cityPincode,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF64748B)),
            ),
            if (!address.isDefault) ...[
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF4338CA),
                  side: const BorderSide(color: Color(0xFF4338CA)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  minimumSize: const Size(double.infinity, 36),
                ),
                onPressed: () => _setDefaultAddress(address),
                child: const Text('Deliver here', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
              ),
            ],
          ],
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

  Widget _buildTextInput(
    TextEditingController controller,
    String hint, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 13.5, color: Color(0xFF1E1B2E)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
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
          borderSide: const BorderSide(color: Color(0xFF4338CA), width: 1.5),
        ),
      ),
    );
  }
}

