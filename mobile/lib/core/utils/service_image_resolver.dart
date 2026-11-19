import 'package:flutter/widgets.dart';

class ServiceImageResolver {
  static const Map<String, String> _slugMap = {
    // Home Cleaning
    'deep-home-cleaning': 'assets/images/home-cleaning.webp',
    'sofa-carpet-shampooing': 'assets/images/home-cleaning.webp',
    'bathroom-deep-cleaning': 'assets/images/bathroom-deep-cleaning.webp',
    'kitchen-deep-cleaning': 'assets/images/kitchen-deep-cleaning.webp',
    'full-home-sanitization': 'assets/images/full-home-sanitization.webp',

    // Appliance Repair
    'ac-service-gas-refill': 'assets/images/appliance-repair.webp',
    'ro-water-purifier-service': 'assets/images/appliance-repair.webp',
    'washing-machine-repair': 'assets/images/washing-machine-repair.webp',
    'refrigerator-repair': 'assets/images/refrigerator-repair.webp',
    'microwave-oven-repair': 'assets/images/microwave-oven-repair.webp',

    // Salon & Spa
    'at-home-spa-for-women': 'assets/images/Home-spa-women-banner.jpg',
    'at-home-spa-women': 'assets/images/Home-spa-women-banner.jpg',
    'mens-haircut-grooming': 'assets/images/mens-haircut-grooming.webp',
    'full-body-massage': 'assets/images/full-body-massage.webp',
    'bridal-makeup': 'assets/images/bridal-makeup.webp',

    // Electrical & Plumbing
    'electrician-visit-general': 'assets/images/electrical.jpg',
    'fan-light-installation': 'assets/images/electrical.jpg',
    'plumbing-tap-leak-repair': 'assets/images/plumbing.webp',
    'geyser-installation-repair': 'assets/images/geyser-installation-repair.webp',
    'water-tank-cleaning': 'assets/images/water-tank-cleaning.webp',

    // Painting & Waterproofing
    'room-painting-per-room': 'assets/images/room-painting-per-room.webp',
    'terrace-waterproofing': 'assets/images/terrace-waterproofing.webp',
    'texture-accent-wall': 'assets/images/texture-accent-wall.webp',

    // Pest Control
    'general-pest-control': 'assets/images/pest-control-clean.webp',
    'termite-treatment': 'assets/images/termite-treatment-clean.webp',
    'mosquito-fogging': 'assets/images/mosquito-fogging.webp',
    'bed-bug-treatment': 'assets/images/bed-bug-treatment.webp',

    // Carpentry
    'furniture-assembly': 'assets/images/furniture-assembly.jpg',
    'door-lock-repair': 'assets/images/door-lock-repair.jpg',
    'wardrobe-repair': 'assets/images/wardrobe-repair.jpg',
    'custom-shelf-installation': 'assets/images/shelf-curtain-rod-installation.jpg',
    'shelf-curtain-rod-installation': 'assets/images/shelf-curtain-rod-installation.jpg',
  };

  static List<String> resolveGallery(String slug, String name) {
    final s = slug.toLowerCase().trim();
    final n = name.toLowerCase().trim();

    if (s.contains('ac-') || s.contains('appliance') || n.contains('ac ') || n.contains('appliance') || n.contains('gas refill') || n.contains('purifier') || s.contains('ro-')) {
      return const [
        'assets/images/appliance-repair.webp',
        'assets/images/appliance-repair-2.webp',
        'assets/images/appliance-repair-3.webp',
        'assets/images/appliance-repair-4.webp',
      ];
    }

    if (s.contains('kitchen') || n.contains('kitchen')) {
      return const [
        'assets/images/kitchen-deep-cleaning.webp',
        'assets/images/kitchen-cleaning-2.webp',
        'assets/images/kitchen-cleaning-3.webp',
        'assets/images/kitchen-cleaning-4.webp',
      ];
    }

    if (s.contains('bathroom') || n.contains('bathroom')) {
      return const [
        'assets/images/bathroom-deep-cleaning.webp',
        'assets/images/bathroom-cleaning-2.webp',
        'assets/images/bathroom-cleaning-3.webp',
        'assets/images/bathroom-cleaning-4.webp',
      ];
    }

    if (s.contains('clean') || n.contains('clean') || s.contains('sofa') || n.contains('sofa')) {
      return const [
        'assets/images/home-cleaning.webp',
        'assets/images/home-cleaning-2.webp',
        'assets/images/home-cleaning-3.webp',
        'assets/images/home-cleaning-4.webp',
      ];
    }

    if (s.contains('paint') || n.contains('paint') || s.contains('wall') || n.contains('wall')) {
      return const [
        'assets/images/room-painting-per-room.webp',
        'assets/images/texture-accent-wall.webp',
        'assets/images/terrace-waterproofing.webp',
        'assets/images/painting-category.webp',
      ];
    }

    if (s.contains('plumb') || n.contains('plumb') || s.contains('tap') || s.contains('leak') || s.contains('pipe')) {
      return const [
        'assets/images/plumbing.webp',
        'assets/images/plumbing-2.webp',
        'assets/images/plumbing-3.webp',
        'assets/images/plumbing-4.webp',
      ];
    }

    if (s.contains('pest') || n.contains('pest') || s.contains('termite') || s.contains('mosquito') || s.contains('bug')) {
      return const [
        'assets/images/pest-control-clean.webp',
        'assets/images/termite-treatment-clean.webp',
        'assets/images/mosquito-fogging.webp',
        'assets/images/bed-bug-treatment.webp',
      ];
    }

    if (s.contains('carpent') || n.contains('carpent') || s.contains('furniture') || s.contains('lock') || s.contains('wardrobe')) {
      return const [
        'assets/images/furniture-assembly.jpg',
        'assets/images/wardrobe-repair.jpg',
        'assets/images/door-lock-repair.jpg',
        'assets/images/shelf-curtain-rod-installation.jpg',
      ];
    }

    if (s.contains('salon') || s.contains('spa') || n.contains('salon') || n.contains('spa') || n.contains('massage') || n.contains('haircut') || n.contains('bridal')) {
      return const [
        'assets/images/Home-spa-women-banner.jpg',
        'assets/images/full-body-massage.webp',
        'assets/images/mens-haircut-grooming.webp',
        'assets/images/bridal-makeup.webp',
      ];
    }

    if (s.contains('washing') || n.contains('washing')) {
      return const [
        'assets/images/washing-machine-repair.webp',
        'assets/images/appliance-repair-2.webp',
        'assets/images/appliance-repair-3.webp',
        'assets/images/appliance-repair-4.webp',
      ];
    }

    if (s.contains('refriger') || n.contains('refriger') || n.contains('fridge')) {
      return const [
        'assets/images/refrigerator-repair.webp',
        'assets/images/appliance-repair-2.webp',
        'assets/images/appliance-repair-3.webp',
        'assets/images/appliance-repair-4.webp',
      ];
    }

    final single = resolve(slug, name);
    return [single];
  }

  static String resolve(String slug, String name) {
    final s = slug.toLowerCase().trim();
    final n = name.toLowerCase().trim();

    if (_slugMap.containsKey(s)) {
      return _slugMap[s]!;
    }

    // High-precision keyword matching on name or slug:
    // Appliances:
    if (n.contains('washing') || s.contains('washing')) return 'assets/images/washing-machine-repair.webp';
    if (n.contains('refriger') || s.contains('refriger') || n.contains('fridge')) return 'assets/images/refrigerator-repair.webp';
    if (n.contains('microwave') || s.contains('microwave') || n.contains('oven')) return 'assets/images/microwave-oven-repair.webp';
    if (n.contains('geyser') || s.contains('geyser') || n.contains('heater')) return 'assets/images/geyser-installation-repair.webp';
    if (n.contains('ac ') || s.contains('ac-') || n.contains('air condition') || n.contains('purifier') || s.contains('ro-')) {
      return 'assets/images/appliance-repair.webp';
    }

    // Cleaning:
    if (n.contains('bathroom') || s.contains('bathroom')) return 'assets/images/bathroom-deep-cleaning.webp';
    if (n.contains('kitchen') || s.contains('kitchen')) return 'assets/images/kitchen-deep-cleaning.webp';
    if (n.contains('sanitiz') || s.contains('sanitiz')) return 'assets/images/full-home-sanitization.webp';
    if (n.contains('tank') || s.contains('tank')) return 'assets/images/water-tank-cleaning.webp';
    if (n.contains('deep') || s.contains('deep') || n.contains('clean') || n.contains('sofa') || n.contains('carpet')) {
      return 'assets/images/home-cleaning.webp';
    }

    // Salon:
    if (n.contains('haircut') || s.contains('haircut') || n.contains('men') || s.contains('mens')) return 'assets/images/mens-haircut-grooming.webp';
    if (n.contains('massage') || s.contains('massage')) return 'assets/images/full-body-massage.webp';
    if (n.contains('bridal') || s.contains('bridal') || n.contains('makeup')) return 'assets/images/bridal-makeup.webp';
    if (n.contains('spa') || s.contains('spa') || n.contains('salon') || n.contains('facial') || n.contains('women')) {
      return 'assets/images/Home-spa-women-banner.jpg';
    }

    // Painting:
    if (n.contains('terrace') || s.contains('terrace') || n.contains('roof')) return 'assets/images/terrace-waterproofing.webp';
    if (n.contains('texture') || s.contains('texture') || n.contains('accent')) return 'assets/images/texture-accent-wall.webp';
    if (n.contains('paint') || s.contains('paint') || n.contains('wall') || n.contains('waterproof')) return 'assets/images/room-painting-per-room.webp';

    // Pest:
    if (n.contains('mosquito') || s.contains('mosquito') || n.contains('fogging')) return 'assets/images/mosquito-fogging.webp';
    if (n.contains('bed bug') || s.contains('bed-bug') || n.contains('bug')) return 'assets/images/bed-bug-treatment.webp';
    if (n.contains('termite') || s.contains('termite')) return 'assets/images/termite-treatment-clean.webp';
    if (n.contains('pest') || s.contains('pest')) return 'assets/images/pest-control-clean.webp';

    // Carpentry:
    if (n.contains('lock') || s.contains('lock') || n.contains('door')) return 'assets/images/door-lock-repair.jpg';
    if (n.contains('wardrobe') || s.contains('wardrobe') || n.contains('drawer')) return 'assets/images/wardrobe-repair.jpg';
    if (n.contains('shelf') || s.contains('shelf') || n.contains('curtain') || n.contains('rod')) return 'assets/images/shelf-curtain-rod-installation.jpg';
    if (n.contains('assembly') || s.contains('assembly') || n.contains('furniture') || n.contains('carpent')) return 'assets/images/furniture-assembly.jpg';

    // Electrical & Plumbing:
    if (n.contains('plumb') || s.contains('plumb') || n.contains('tap') || n.contains('leak') || n.contains('pipe')) return 'assets/images/plumbing.webp';
    if (n.contains('electr') || s.contains('electr') || n.contains('fan') || n.contains('light') || n.contains('wiring')) {
      return 'assets/images/electrical.jpg';
    }

    return 'assets/images/home-cleaning.webp';
  }

  static Alignment resolveFocus(String slug, String name) {
    final s = slug.toLowerCase().trim();
    final n = name.toLowerCase().trim();

    // Specific known service slugs:
    switch (s) {
      // Home Cleaning
      case 'kitchen-deep-cleaning':
        return const Alignment(0.0, -0.70);
      case 'full-home-sanitization':
      case 'home-sanitization':
        return const Alignment(0.0, -0.75);
      case 'bathroom-deep-cleaning':
        return const Alignment(0.0, -0.60);
      case 'deep-home-cleaning':
      case 'sofa-carpet-shampooing':
        return const Alignment(0.0, -0.35);

      // Appliance Repair
      case 'washing-machine-repair':
        return const Alignment(0.0, -0.50);
      case 'ac-service-gas-refill':
      case 'ro-water-purifier-service':
      case 'appliance-repair':
        return const Alignment(0.0, -0.56);
      case 'refrigerator-repair':
        return const Alignment(0.0, -0.40);
      case 'microwave-oven-repair':
        return const Alignment(0.0, -0.40);
      case 'geyser-installation-repair':
        return const Alignment(0.0, -0.50);

      // Salon & Spa
      case 'mens-haircut-grooming':
        return const Alignment(0.0, -0.55);
      case 'bridal-makeup':
        return const Alignment(0.0, -0.45);
      case 'full-body-massage':
        return const Alignment(0.0, -0.30);
      case 'at-home-spa-for-women':
      case 'at-home-spa-women':
        return const Alignment(0.0, -0.28);

      // Electrical & Plumbing
      case 'electrician-visit-general':
      case 'fan-light-installation':
        return const Alignment(-0.30, 0.0);
      case 'plumbing-tap-leak-repair':
        return const Alignment(0.0, -0.20);
      case 'water-tank-cleaning':
        return const Alignment(0.0, -0.40);

      // Painting
      case 'room-painting-per-room':
        return const Alignment(0.0, -0.40);
      case 'terrace-waterproofing':
        return const Alignment(0.0, -0.30);
      case 'texture-accent-wall':
        return const Alignment(0.0, 0.0);

      // Pest Control
      case 'general-pest-control':
        return const Alignment(0.20, 0.0);
      case 'termite-treatment':
        return const Alignment(-0.72, 0.0);
      case 'mosquito-fogging':
        return const Alignment(0.0, -0.40);
      case 'bed-bug-treatment':
        return const Alignment(0.0, -0.40);

      // Carpentry
      case 'furniture-assembly':
        return const Alignment(0.0, -0.10);
      case 'door-lock-repair':
        return const Alignment(0.0, -0.20);
      case 'wardrobe-repair':
        return const Alignment(0.0, 0.0);
      case 'custom-shelf-installation':
      case 'shelf-curtain-rod-installation':
        return const Alignment(0.0, -0.30);
    }

    // Name-based fuzzy fallbacks:
    if (s.contains('kitchen') || n.contains('kitchen')) return const Alignment(0.0, -0.70);
    if (s.contains('sanitiz') || n.contains('sanitiz')) return const Alignment(0.0, -0.75);
    if (s.contains('washing') || n.contains('washing')) return const Alignment(0.0, -0.50);
    if (s.contains('bathroom') || n.contains('bathroom')) return const Alignment(0.0, -0.60);
    if (s.contains('haircut') || n.contains('haircut') || n.contains('men')) return const Alignment(0.0, -0.55);
    if (s.contains('makeup') || n.contains('bridal')) return const Alignment(0.0, -0.45);
    if (s.contains('ac') || s.contains('purifier')) return const Alignment(0.0, -0.56);
    if (s.contains('electr') || n.contains('electr')) return const Alignment(-0.30, 0.0);
    if (s.contains('plumb') || n.contains('plumb')) return const Alignment(0.0, -0.20);
    if (s.contains('termite')) return const Alignment(-0.72, 0.0);
    if (s.contains('pest')) return const Alignment(0.20, 0.0);

    return const Alignment(0.0, -0.35);
  }
}

