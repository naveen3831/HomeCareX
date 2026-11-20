class CustomerAddress {
  final String id;
  final String label;
  final String house;
  final String? street;
  final String? area;
  final String? line1;
  final String? line2;
  final String? landmark;
  final String city;
  final String state;
  final String pincode;
  final bool isDefault;
  final bool serviceable;

  CustomerAddress({
    required this.id,
    required this.label,
    required this.house,
    this.street,
    this.area,
    this.line1,
    this.line2,
    this.landmark,
    required this.city,
    required this.state,
    required this.pincode,
    this.isDefault = false,
    this.serviceable = true,
  });

  String get formattedAddress {
    final parts = [
      if (house.isNotEmpty) house,
      if (street != null && street!.isNotEmpty) street,
      if (area != null && area!.isNotEmpty) area,
      if (line1 != null && line1!.isNotEmpty && house.isEmpty) line1,
      if (line2 != null && line2!.isNotEmpty && (area == null || area!.isEmpty)) line2,
    ];
    return parts.join(', ');
  }

  factory CustomerAddress.fromJson(Map<String, dynamic> json) {
    return CustomerAddress(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      label: (json['label'] ?? 'Home').toString(),
      house: (json['house'] ?? json['line1'] ?? '').toString(),
      street: json['street']?.toString(),
      area: (json['area'] ?? json['line2'])?.toString(),
      line1: json['line1']?.toString(),
      line2: json['line2']?.toString(),
      landmark: json['landmark']?.toString(),
      city: (json['city'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
      pincode: (json['pincode'] ?? '').toString(),
      isDefault: json['isDefault'] == true,
      serviceable: json['serviceable'] != false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'house': house,
      if (street != null && street!.isNotEmpty) 'street': street,
      if (area != null && area!.isNotEmpty) 'area': area,
      if (landmark != null && landmark!.isNotEmpty) 'landmark': landmark,
      'city': city,
      'state': state,
      'pincode': pincode,
      'isDefault': isDefault,
    };
  }
}

