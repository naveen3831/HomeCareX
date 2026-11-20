class BookingModel {
  final String id;
  final String serviceTitle;
  final double amount;
  final String status;
  final DateTime scheduledAt;
  final String address;
  final String? partnerName;
  final String? partnerPhone;
  final String? startOtp;

  BookingModel({
    required this.id,
    required this.serviceTitle,
    required this.amount,
    required this.status,
    required this.scheduledAt,
    required this.address,
    this.partnerName,
    this.partnerPhone,
    this.startOtp,
  });

  factory BookingModel.fromJson(Map<String, dynamic> json) {
    DateTime date = DateTime.now();
    if (json['scheduledAt'] != null) {
      date = DateTime.tryParse(json['scheduledAt'].toString()) ?? DateTime.now();
    } else if (json['date'] != null) {
      date = DateTime.tryParse(json['date'].toString()) ?? DateTime.now();
    } else if (json['createdAt'] != null) {
      date = DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now();
    }

    String title = 'Home Care Service';
    if (json['serviceTitle'] != null && json['serviceTitle'].toString().trim().isNotEmpty) {
      title = json['serviceTitle'].toString();
    } else if (json['serviceName'] != null && json['serviceName'].toString().trim().isNotEmpty) {
      title = json['serviceName'].toString();
    } else if (json['items'] is List && (json['items'] as List).isNotEmpty) {
      final first = (json['items'] as List).first;
      if (first is Map && first['name'] != null) {
        title = first['name'].toString();
      }
    }

    double amount = 0.0;
    if (json['amount'] is num) {
      amount = (json['amount'] as num).toDouble();
    } else if (json['totalAmount'] is num) {
      amount = (json['totalAmount'] as num).toDouble();
    } else if (json['priceBreakdown'] is Map && json['priceBreakdown']['total'] is num) {
      amount = (json['priceBreakdown']['total'] as num).toDouble();
    } else if (json['priceSnapshot'] is Map && json['priceSnapshot']['total'] is num) {
      amount = (json['priceSnapshot']['total'] as num).toDouble();
    } else if (json['amount'] != null) {
      amount = double.tryParse(json['amount'].toString()) ?? 0.0;
    } else if (json['totalAmount'] != null) {
      amount = double.tryParse(json['totalAmount'].toString()) ?? 0.0;
    }

    String address = 'Home Address';
    if (json['address'] is String && (json['address'] as String).trim().isNotEmpty) {
      address = json['address'];
    } else if (json['address'] is Map) {
      final addrMap = json['address'] as Map;
      if (addrMap['formatted'] != null && addrMap['formatted'].toString().trim().isNotEmpty) {
        address = addrMap['formatted'].toString();
      } else {
        final line1 = addrMap['line1'] ?? '';
        final area = addrMap['area'] ?? '';
        final city = addrMap['city'] ?? '';
        final pin = addrMap['pincode'] ?? '';
        final parts = [line1, area, city, pin].where((p) => p.toString().trim().isNotEmpty).join(', ');
        if (parts.isNotEmpty) address = parts;
      }
    } else if (json['addressSnapshot'] is Map) {
      final addrMap = json['addressSnapshot'] as Map;
      final line1 = addrMap['line1'] ?? '';
      final line2 = addrMap['line2'] ?? '';
      final city = addrMap['city'] ?? '';
      final pin = addrMap['pincode'] ?? '';
      final parts = [line1, line2, city, pin].where((p) => p.toString().trim().isNotEmpty).join(', ');
      if (parts.isNotEmpty) address = parts;
    }

    String? partnerName = json['partnerName']?.toString();
    if (partnerName == null && json['partner'] is Map) {
      partnerName = json['partner']['name']?.toString();
    }

    String? partnerPhone = json['partnerPhone']?.toString();
    if (partnerPhone == null && json['partner'] is Map) {
      partnerPhone = json['partner']['phone']?.toString();
    }

    String? startOtp = json['startOtp']?.toString();
    if (startOtp == null && json['otpCodes'] is Map) {
      startOtp = json['otpCodes']['start']?.toString();
    } else if (startOtp == null && json['otp'] is Map) {
      startOtp = json['otp']['code']?.toString();
    }

    return BookingModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      serviceTitle: title,
      amount: amount,
      status: json['status']?.toString() ?? 'confirmed',
      scheduledAt: date,
      address: address,
      partnerName: partnerName,
      partnerPhone: partnerPhone,
      startOtp: startOtp,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'serviceTitle': serviceTitle,
      'amount': amount,
      'status': status,
      'scheduledAt': scheduledAt.toIso8601String(),
      'address': address,
      if (partnerName != null) 'partnerName': partnerName,
      if (partnerPhone != null) 'partnerPhone': partnerPhone,
      if (startOtp != null) 'startOtp': startOtp,
    };
  }
}

