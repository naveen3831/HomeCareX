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
    } else if (json['createdAt'] != null) {
      date = DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now();
    }

    String title = 'Home Care Service';
    if (json['serviceName'] != null) {
      title = json['serviceName'];
    } else if (json['items'] is List && (json['items'] as List).isNotEmpty) {
      final first = (json['items'] as List).first;
      if (first is Map && first['name'] != null) {
        title = first['name'].toString();
      }
    }

    return BookingModel(
      id: json['id'] ?? json['_id'] ?? '',
      serviceTitle: title,
      amount: (json['totalAmount'] ?? json['amount'] ?? 0).toDouble(),
      status: json['status'] ?? 'pending',
      scheduledAt: date,
      address: json['address'] is Map ? (json['address']['formatted'] ?? 'Saved Address') : (json['address']?.toString() ?? 'Home Address'),
      partnerName: json['partnerName'] ?? (json['partner'] is Map ? json['partner']['name'] : null),
      partnerPhone: json['partnerPhone'] ?? (json['partner'] is Map ? json['partner']['phone'] : null),
      startOtp: json['startOtp']?.toString(),
    );
  }
}

