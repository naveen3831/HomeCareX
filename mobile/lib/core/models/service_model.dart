class ServiceModel {
  final String id;
  final String name;
  final String slug;
  final String description;
  final double price;
  final double? originalPrice;
  final String categoryId;
  final int durationMinutes;
  final double rating;
  final int reviewsCount;
  final String? imageUrl;
  final List<String> inclusions;
  final String? availability;

  ServiceModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.price,
    this.originalPrice,
    required this.categoryId,
    this.durationMinutes = 60,
    this.rating = 4.8,
    this.reviewsCount = 42,
    this.imageUrl,
    this.inclusions = const [],
    this.availability,
  });

  factory ServiceModel.fromJson(Map<String, dynamic> json) {
    String? img;
    if (json['media'] is List && (json['media'] as List).isNotEmpty) {
      final first = (json['media'] as List).first;
      if (first is Map && first['url'] != null) {
        img = first['url'].toString();
      }
    } else if (json['imageUrl'] != null) {
      img = json['imageUrl'].toString();
    }

    final priceRaw = json['price'] ?? json['basePrice'] ?? 0;
    final priceVal = (priceRaw is num) ? priceRaw.toDouble() : 0.0;
    final origRaw = json['originalPrice'];
    final origVal = (origRaw is num) ? origRaw.toDouble() : null;

    List<String> inc = [];
    if (json['inclusions'] is List) {
      inc = (json['inclusions'] as List).map((e) => e.toString()).toList();
    } else if (json['features'] is List) {
      inc = (json['features'] as List).map((e) => e.toString()).toList();
    }

    String catId = '';
    if (json['category'] is Map && json['category']['id'] != null) {
      catId = json['category']['id'].toString();
    } else if (json['categoryId'] != null) {
      catId = json['categoryId'].toString();
    }

    final ratingRaw = json['rating'] ?? 4.8;
    final ratingVal = (ratingRaw is num) ? ratingRaw.toDouble() : 4.8;

    return ServiceModel(
      id: json['id'] ?? json['_id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      description: json['description'] ?? '',
      price: priceVal,
      originalPrice: origVal,
      categoryId: catId,
      durationMinutes: json['durationMinutes'] is int ? json['durationMinutes'] : 60,
      rating: ratingVal,
      reviewsCount: json['ratingCount'] ?? json['reviewCount'] ?? json['reviewsCount'] ?? 24,
      imageUrl: img,
      inclusions: inc,
      availability: json['availability']?.toString(),
    );
  }
}

