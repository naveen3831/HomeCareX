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

  String get fullAddressLine {
    final parts = [
      if (house.isNotEmpty) house,
      if (street != null && street!.isNotEmpty) street,
      if (area != null && area!.isNotEmpty) area,
      if (city.isNotEmpty) city,
      if (pincode.isNotEmpty) pincode,
    ];
    if (parts.isNotEmpty) return parts.join(', ');
    return formattedAddress;
  }

  CustomerAddress copyWith({
    String? id,
    String? label,
    String? house,
    String? street,
    String? area,
    String? line1,
    String? line2,
    String? landmark,
    String? city,
    String? state,
    String? pincode,
    bool? isDefault,
    bool? serviceable,
  }) {
    return CustomerAddress(
      id: id ?? this.id,
      label: label ?? this.label,
      house: house ?? this.house,
      street: street ?? this.street,
      area: area ?? this.area,
      line1: line1 ?? this.line1,
      line2: line2 ?? this.line2,
      landmark: landmark ?? this.landmark,
      city: city ?? this.city,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
      isDefault: isDefault ?? this.isDefault,
      serviceable: serviceable ?? this.serviceable,
    );
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
      'id': id,
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

