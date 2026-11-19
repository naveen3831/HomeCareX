class CategoryModel {
  final String id;
  final String name;
  final String slug;
  final String description;
  final String icon;
  final String? iconUrl;
  final String? imageUrl;
  final int servicesCount;

  CategoryModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.icon,
    this.iconUrl,
    this.imageUrl,
    this.servicesCount = 0,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    String? img;
    if (json['images'] is List && (json['images'] as List).isNotEmpty) {
      final first = (json['images'] as List).first;
      if (first is Map && first['url'] != null) {
        img = first['url'].toString();
      }
    } else if (json['imageUrl'] != null) {
      img = json['imageUrl'].toString();
    }

    return CategoryModel(
      id: json['id'] ?? json['_id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      description: json['description'] ?? '',
      icon: json['icon'] ?? '🧹',
      iconUrl: json['iconUrl'],
      imageUrl: img,
      servicesCount: json['servicesCount'] is int
          ? json['servicesCount']
          : (json['serviceCount'] is int
              ? json['serviceCount']
              : (json['services'] is int ? json['services'] : 0)),
    );
  }
}

