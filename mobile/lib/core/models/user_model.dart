class UserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String? avatarUrl;
  final String? referralCode;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    this.avatarUrl,
    this.referralCode,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? json['_id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      role: json['role'] ?? 'customer',
      avatarUrl: json['avatar'] ?? json['avatarUrl'],
      referralCode: json['referralCode'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phone': phone,
    'role': role,
    'avatar': avatarUrl,
    'referralCode': referralCode,
  };
}

