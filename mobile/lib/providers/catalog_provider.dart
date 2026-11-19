import 'package:flutter/material.dart';
import '../core/models/category_model.dart';
import '../core/models/service_model.dart';
import '../core/services/api_service.dart';
import '../core/constants/api_constants.dart';

class CatalogProvider extends ChangeNotifier {
  List<CategoryModel> _categories = _fallbackCategories;
  List<ServiceModel> _services = _fallbackServices;
  bool _isLoading = false;
  String? _selectedCategorySlug;

  List<CategoryModel> get categories => _categories;
  List<ServiceModel> get services => _services;
  bool get isLoading => _isLoading;
  String? get selectedCategorySlug => _selectedCategorySlug;

  List<ServiceModel> get popularServices => _services.take(6).toList();

  List<ServiceModel> servicesForCategory(String categoryId) {
    return _services.where((s) => s.categoryId == categoryId).toList();
  }

  void selectCategory(String? slug) {
    _selectedCategorySlug = slug;
    notifyListeners();
  }

  Future<void> loadCategories() => fetchCatalog();
  Future<void> loadFeaturedServices() => fetchCatalog();

  Future<void> fetchCatalog() async {
    _isLoading = true;
    notifyListeners();

    try {
      final catRes = await ApiService.get(ApiConstants.categories);
      if (catRes is List && catRes.isNotEmpty) {
        _categories = catRes
            .map((c) => CategoryModel.fromJson(Map<String, dynamic>.from(c)))
            .toList();
      }

      final srvRes = await ApiService.get('${ApiConstants.services}?limit=50');
      if (srvRes is List && srvRes.isNotEmpty) {
        _services = srvRes
            .map((s) => ServiceModel.fromJson(Map<String, dynamic>.from(s)))
            .toList();
      }
    } catch (e) {
      debugPrint('[CatalogProvider] Error fetching catalog (using offline seeds): $e');
      if (_categories.isEmpty) _categories = _fallbackCategories;
      if (_services.isEmpty) _services = _fallbackServices;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  static List<CategoryModel> get _fallbackCategories => [
    CategoryModel(
      id: 'cat_cleaning',
      name: 'Home Cleaning',
      slug: 'home-cleaning',
      icon: '🧹',
      description: 'Professional deep and regular home cleaning services',
      servicesCount: 5,
    ),
    CategoryModel(
      id: 'cat_appliances',
      name: 'Appliance Repair & Service',
      slug: 'appliance-repair-service',
      icon: '🔧',
      description: 'Expert diagnostics and repair for all household appliances',
      servicesCount: 5,
    ),
    CategoryModel(
      id: 'cat_salon',
      name: 'Salon & Spa',
      slug: 'salon-spa',
      icon: '💆',
      description: 'In-home grooming, beauty care, and relaxation therapies',
      servicesCount: 5,
    ),
    CategoryModel(
      id: 'cat_electrical',
      name: 'Electrical & Plumbing',
      slug: 'electrical-plumbing',
      icon: '⚡',
      description: 'Certified electricians and plumbers for quick fixes and installs',
      servicesCount: 5,
    ),
    CategoryModel(
      id: 'cat_painting',
      name: 'Painting & Waterproofing',
      slug: 'painting-waterproofing',
      icon: '🎨',
      description: 'Wall painting, textures, waterproof coatings, and consulting',
      servicesCount: 4,
    ),
    CategoryModel(
      id: 'cat_pest',
      name: 'Pest Control',
      slug: 'pest-control',
      icon: '🐜',
      description: 'Odourless, safe pest management and termite prevention',
      servicesCount: 3,
    ),
    CategoryModel(
      id: 'cat_carpentry',
      name: 'Carpentry & Furniture Assembly',
      slug: 'carpentry-furniture-assembly',
      icon: '🪚',
      description: 'Furniture assembly, hinge repairs, drill & hang services',
      servicesCount: 3,
    ),
  ];

  static List<ServiceModel> get _fallbackServices => [
    // Home Cleaning
    ServiceModel(
      id: 'srv_deep_clean',
      name: 'Deep Home Cleaning',
      slug: 'deep-home-cleaning',
      description: 'Top-to-bottom cleaning of floors, kitchen, bathrooms, windows and fittings.',
      price: 1499,
      categoryId: 'cat_cleaning',
      durationMinutes: 180,
      rating: 4.8,
      reviewsCount: 2140,
      availability: 'tomorrow',
      inclusions: ['Floor scrubbing', 'Kitchen degreasing', 'Bathroom disinfection'],
    ),
    ServiceModel(
      id: 'srv_sofa_clean',
      name: 'Sofa & Carpet Shampooing',
      slug: 'sofa-carpet-shampooing',
      description: 'Machine shampooing and vacuuming for sofas and carpets.',
      price: 899,
      categoryId: 'cat_cleaning',
      durationMinutes: 90,
      rating: 4.7,
      reviewsCount: 980,
      availability: 'today',
      inclusions: ['Machine shampooing', 'Fabric sanitization', 'Stain treatment'],
    ),
    ServiceModel(
      id: 'srv_bathroom_clean',
      name: 'Bathroom Deep Cleaning',
      slug: 'bathroom-deep-cleaning',
      description: 'Descaling of tiles, taps and fittings with disinfectant finish.',
      price: 599,
      categoryId: 'cat_cleaning',
      durationMinutes: 60,
      rating: 4.8,
      reviewsCount: 1320,
      availability: 'today',
      inclusions: ['Tile descaling', 'Tap buffing', 'Mirror & fixture shining'],
    ),
    ServiceModel(
      id: 'srv_kitchen_clean',
      name: 'Kitchen Deep Cleaning',
      slug: 'kitchen-deep-cleaning',
      description: 'Chimney, hob, cabinets and tiles degreased and sanitised.',
      price: 1199,
      categoryId: 'cat_cleaning',
      durationMinutes: 120,
      rating: 4.7,
      reviewsCount: 1050,
      availability: 'tomorrow',
      inclusions: ['Chimney degreasing', 'Hob scrubbing', 'Cabinet wiping'],
    ),
    ServiceModel(
      id: 'srv_home_sanitization',
      name: 'Full Home Sanitization',
      slug: 'full-home-sanitization',
      description: 'Odourless disinfectant spray across rooms, handles and furniture.',
      price: 999,
      categoryId: 'cat_cleaning',
      durationMinutes: 75,
      rating: 4.5,
      reviewsCount: 610,
      availability: 'scheduled',
      inclusions: ['Room misting', 'High-touch points', 'Hospital-grade sanitizer'],
    ),

    // Appliance Repair & Service
    ServiceModel(
      id: 'srv_ac_gas',
      name: 'AC Service & Gas Refill',
      slug: 'ac-service-gas-refill',
      description: 'Jet-wash service of indoor and outdoor units with a cooling check.',
      price: 599,
      categoryId: 'cat_appliances',
      durationMinutes: 60,
      rating: 4.8,
      reviewsCount: 3210,
      availability: 'today',
      inclusions: ['Jet pump cleaning', 'Cooling inspection', 'Gas pressure test'],
    ),
    ServiceModel(
      id: 'srv_ro_purifier',
      name: 'RO/Water Purifier Service',
      slug: 'ro-water-purifier-service',
      description: 'Filter check, membrane flush and TDS test for RO purifiers.',
      price: 399,
      categoryId: 'cat_appliances',
      durationMinutes: 45,
      rating: 4.5,
      reviewsCount: 1120,
      availability: 'today',
      inclusions: ['TDS check', 'Filter membrane flush', 'Leak check'],
    ),
    ServiceModel(
      id: 'srv_washing_machine',
      name: 'Washing Machine Repair',
      slug: 'washing-machine-repair',
      description: 'Diagnosis and repair for front-load and top-load machines.',
      price: 349,
      categoryId: 'cat_appliances',
      durationMinutes: 60,
      rating: 4.4,
      reviewsCount: 890,
      availability: 'tomorrow',
      inclusions: ['Motor & drum check', 'Drain pump inspection', 'Spin cycle testing'],
    ),
    ServiceModel(
      id: 'srv_refrigerator',
      name: 'Refrigerator Repair',
      slug: 'refrigerator-repair',
      description: 'Cooling, compressor and door-seal checks with on-spot repair.',
      price: 449,
      categoryId: 'cat_appliances',
      durationMinutes: 60,
      rating: 4.5,
      reviewsCount: 760,
      availability: 'tomorrow',
      inclusions: ['Compressor testing', 'Thermostat check', 'Gas line inspection'],
    ),
    ServiceModel(
      id: 'srv_microwave',
      name: 'Microwave Oven Repair',
      slug: 'microwave-oven-repair',
      description: 'Fault diagnosis and repair for solo, grill and convection ovens.',
      price: 299,
      categoryId: 'cat_appliances',
      durationMinutes: 45,
      rating: 4.3,
      reviewsCount: 340,
      availability: 'scheduled',
      inclusions: ['Magnetron check', 'Heating test', 'Control board diagnosis'],
    ),

    // Salon & Spa
    ServiceModel(
      id: 'srv_spa_women',
      name: 'At-Home Spa for Women',
      slug: 'at-home-spa-for-women',
      description: 'Relaxing spa session by a trained therapist, at home.',
      price: 1299,
      categoryId: 'cat_salon',
      durationMinutes: 120,
      rating: 4.9,
      reviewsCount: 1560,
      availability: 'tomorrow',
      inclusions: ['Full body therapy', 'Aroma massage', 'Herbal steam'],
    ),
    ServiceModel(
      id: 'srv_mens_haircut',
      name: "Men's Haircut & Grooming",
      slug: 'mens-haircut-grooming',
      description: 'Haircut, beard trim and head massage at your doorstep.',
      price: 399,
      categoryId: 'cat_salon',
      durationMinutes: 45,
      rating: 4.8,
      reviewsCount: 1480,
      availability: 'today',
      inclusions: ['Precision hair styling', 'Beard shaping', 'Head massage'],
    ),

    // PAGE 2 STARTS HERE (Index 12)
    // Electrical & Plumbing
    ServiceModel(
      id: 'srv_plumbing_tap',
      name: 'Plumbing – Tap & Leak Repair',
      slug: 'plumbing-tap-leak-repair',
      description: 'Tap, pipe and flush-tank leak repair with spare fitting.',
      price: 299,
      categoryId: 'cat_electrical',
      durationMinutes: 45,
      rating: 4.8,
      reviewsCount: 840,
      availability: 'today',
      inclusions: ['Washer replacement', 'Leak sealing', 'Water pressure test'],
    ),
    ServiceModel(
      id: 'srv_geyser_repair',
      name: 'Geyser Installation & Repair',
      slug: 'geyser-installation-repair',
      description: 'Install, replace or repair electric and gas geysers.',
      price: 449,
      categoryId: 'cat_electrical',
      durationMinutes: 60,
      rating: 4.4,
      reviewsCount: 430,
      availability: 'tomorrow',
      inclusions: ['Thermostat check', 'Inlet/outlet connection', 'Safety valve test'],
    ),
    ServiceModel(
      id: 'srv_water_tank',
      name: 'Water Tank Cleaning',
      slug: 'water-tank-cleaning',
      description: 'Mechanised scrubbing and disinfection of overhead and sump tanks.',
      price: 799,
      categoryId: 'cat_electrical',
      durationMinutes: 90,
      rating: 4.5,
      reviewsCount: 390,
      availability: 'scheduled',
      inclusions: ['High-pressure de-sludging', 'UV antibacterial treatment', 'Tank vacuuming'],
    ),
    ServiceModel(
      id: 'srv_electrician_general',
      name: 'Electrician Visit (General)',
      slug: 'electrician-visit-general',
      description: 'Visit and diagnosis for switches, wiring, fans and minor electrical faults.',
      price: 249,
      categoryId: 'cat_electrical',
      durationMinutes: 30,
      rating: 4.4,
      reviewsCount: 870,
      availability: 'today',
      inclusions: ['Wiring safety check', 'Socket inspection', 'Minor fix included'],
    ),
    ServiceModel(
      id: 'srv_fan_light',
      name: 'Fan & Light Installation',
      slug: 'fan-light-installation',
      description: 'Ceiling fan, tube light and decorative light fitting.',
      price: 299,
      categoryId: 'cat_electrical',
      durationMinutes: 30,
      rating: 4.5,
      reviewsCount: 720,
      availability: 'today',
      inclusions: ['Ceiling fan assembly', 'Wall drill & fix', 'Trial run testing'],
    ),
    ServiceModel(
      id: 'srv_full_massage',
      name: 'Full Body Massage',
      slug: 'full-body-massage',
      description: 'Swedish or deep-tissue massage by a certified therapist.',
      price: 1499,
      categoryId: 'cat_salon',
      durationMinutes: 90,
      rating: 4.8,
      reviewsCount: 1190,
      availability: 'tomorrow',
      inclusions: ['Swedish strokes', 'Stress relief therapy', 'Natural essential oils'],
    ),
    ServiceModel(
      id: 'srv_bridal_makeup',
      name: 'Bridal Makeup',
      slug: 'bridal-makeup',
      description: 'Complete bridal makeup and hairstyling by a senior artist.',
      price: 4999,
      categoryId: 'cat_salon',
      durationMinutes: 180,
      rating: 4.9,
      reviewsCount: 210,
      availability: 'scheduled',
      inclusions: ['HD Makeup', 'Bridal hairstyle', 'Draping & eyelashes'],
    ),
    // Painting & Waterproofing
    ServiceModel(
      id: 'srv_room_painting',
      name: 'Room Painting (per room)',
      slug: 'room-painting-per-room',
      description: 'Interior wall painting with furniture covering and clean-up.',
      price: 3499,
      categoryId: 'cat_painting',
      durationMinutes: 480,
      rating: 4.8,
      reviewsCount: 430,
      availability: 'scheduled',
      inclusions: ['Wall prep', 'Two coats of premium emulsion', 'Post-paint clean up'],
    ),
    ServiceModel(
      id: 'srv_terrace_waterproofing',
      name: 'Terrace Waterproofing',
      slug: 'terrace-waterproofing',
      description: 'Crack filling and waterproof coating for terraces and roofs.',
      price: 7999,
      categoryId: 'cat_painting',
      durationMinutes: 600,
      rating: 4.4,
      reviewsCount: 150,
      availability: 'scheduled',
      inclusions: ['Polymer coating', 'Crack filling', 'Water ponding test'],
    ),
    ServiceModel(
      id: 'srv_texture_wall',
      name: 'Texture Accent Wall',
      slug: 'texture-accent-wall',
      description: 'Designer texture finish on a single feature wall.',
      price: 2499,
      categoryId: 'cat_painting',
      durationMinutes: 300,
      rating: 4.7,
      reviewsCount: 180,
      availability: 'scheduled',
      inclusions: ['Base coat application', 'Designer pattern rolling', 'Metallic topcoat'],
    ),

    // Pest Control
    ServiceModel(
      id: 'srv_general_pest',
      name: 'General Pest Control',
      slug: 'general-pest-control',
      description: 'Odourless spray treatment for cockroaches, ants and common household pests.',
      price: 799,
      categoryId: 'cat_pest',
      durationMinutes: 60,
      rating: 4.5,
      reviewsCount: 1980,
      availability: 'tomorrow',
      inclusions: ['Kitchen gel baiting', 'Drain spray', 'Baseboard treatment'],
    ),
    ServiceModel(
      id: 'srv_termite_treatment',
      name: 'Termite Treatment',
      slug: 'termite-treatment',
      description: 'Drill-and-inject anti-termite treatment with 1-year warranty.',
      price: 1999,
      categoryId: 'cat_pest',
      durationMinutes: 120,
      rating: 4.4,
      reviewsCount: 310,
      availability: 'scheduled',
      inclusions: ['Chemical barrier injection', 'Door frame treatment', '1-year warranty'],
    ),

    // PAGE 3 STARTS HERE (Index 24)
    ServiceModel(
      id: 'srv_mosquito_fogging',
      name: 'Mosquito Fogging',
      slug: 'mosquito-fogging',
      description: 'Thermal fogging for homes, balconies and gardens.',
      price: 499,
      categoryId: 'cat_pest',
      durationMinutes: 30,
      rating: 4.2,
      reviewsCount: 420,
      availability: 'today',
      inclusions: ['Thermal smoke fogging', 'Balcony misting', 'Larvicide treatment'],
    ),
    ServiceModel(
      id: 'srv_bed_bug',
      name: 'Bed Bug Treatment',
      slug: 'bed-bug-treatment',
      description: 'Two-step heat and spray treatment for beds, sofas and wardrobes.',
      price: 1299,
      categoryId: 'cat_pest',
      durationMinutes: 90,
      rating: 4.8,
      reviewsCount: 260,
      availability: 'tomorrow',
      inclusions: ['Mattress steaming', 'Chemical crack spray', 'Follow-up inspection'],
    ),

    // Carpentry & Furniture Assembly
    ServiceModel(
      id: 'srv_furniture_assembly',
      name: 'Furniture Assembly',
      slug: 'furniture-assembly',
      description: 'Assembly of beds, wardrobes, tables and shelves.',
      price: 349,
      categoryId: 'cat_carpentry',
      durationMinutes: 60,
      rating: 4.5,
      reviewsCount: 560,
      availability: 'tomorrow',
      inclusions: ['Manual alignment', 'Hardware tightening', 'Stability testing'],
    ),
    ServiceModel(
      id: 'srv_door_lock',
      name: 'Door & Lock Repair',
      slug: 'door-lock-repair',
      description: 'Hinge, handle and lock repair or replacement.',
      price: 299,
      categoryId: 'cat_carpentry',
      durationMinutes: 45,
      rating: 4.4,
      reviewsCount: 480,
      availability: 'today',
      inclusions: ['Lock alignment', 'Hinge lubrication', 'Striker plate adjustment'],
    ),
    ServiceModel(
      id: 'srv_wardrobe_repair',
      name: 'Wardrobe & Drawer Repair',
      slug: 'wardrobe-repair',
      description: 'Channel, hinge and shutter alignment for wardrobes and drawers.',
      price: 399,
      categoryId: 'cat_carpentry',
      durationMinutes: 60,
      rating: 4.3,
      reviewsCount: 250,
      availability: 'tomorrow',
      inclusions: ['Drawer slide replacement', 'Hydraulic hinge fitting', 'Shutter leveling'],
    ),
    ServiceModel(
      id: 'srv_shelf_install',
      name: 'Shelf & Curtain Rod Installation',
      slug: 'custom-shelf-installation',
      description: 'Drill-and-fix wall shelves, curtain rods and TV brackets.',
      price: 349,
      categoryId: 'cat_carpentry',
      durationMinutes: 45,
      rating: 4.5,
      reviewsCount: 330,
      availability: 'today',
      inclusions: ['Precision level alignment', 'Anchored wall drilling', 'Heavy duty brackets'],
    ),
  ];
}

