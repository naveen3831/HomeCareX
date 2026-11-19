class Icon3DResolver {
  static const Map<String, String> _emojiToIcon = {
    '🧹': 'broom',
    '🧽': 'soap',
    '🧼': 'soap',
    '🔧': 'wrench',
    '🛠': 'tools',
    '🪚': 'tools',
    '🔨': 'tools',
    '🪑': 'tools',
    '🛋️': 'soap',
    '🛋': 'soap',
    '💆': 'massage',
    '💇': 'scissors',
    '✂': 'scissors',
    '✂️': 'scissors',
    '💡': 'light-bulb',
    '🔌': 'plug',
    '⚡': 'light-bulb',
    '🎨': 'palette',
    '🖌': 'paintbrush',
    '🐜': 'ant',
    '🐛': 'bug',
    '🪲': 'bug',
    '🦟': 'bug',
    '❄': 'snowflake',
    '❄️': 'snowflake',
    '💧': 'droplet',
    '🚿': 'shower',
    '🚰': 'droplet',
    '🧰': 'toolbox',
    '🏠': 'house',
    '🏡': 'house-garden',
    '🎁': 'gift',
    '🎉': 'party',
  };

  static final List<MapEntry<RegExp, String>> _keywordPatterns = [
    MapEntry(RegExp(r'\b(ac|air.?condition|refrigerat|fridge|cooling)\b', caseSensitive: false), 'snowflake'),
    MapEntry(RegExp(r'(pest|termite|cockroach|rodent|bug|ant|mosquito)', caseSensitive: false), 'bug'),
    MapEntry(RegExp(r'(spa|massage|facial|salon|beauty|makeup|bridal)', caseSensitive: false), 'massage'),
    MapEntry(RegExp(r'(hair|haircut|barber|scissor)', caseSensitive: false), 'scissors'),
    MapEntry(RegExp(r'(plumb|tap|leak|water|pipe|ro\b|purifier|drain|tank)', caseSensitive: false), 'droplet'),
    MapEntry(RegExp(r'(electric|wiring|switch|socket|fan|light|bulb|lamp)', caseSensitive: false), 'light-bulb'),
    MapEntry(RegExp(r'(carpenter|carpentry|furniture|assembly|drawer|wardrobe|door|lock|wood|saw|fitting|shelf)', caseSensitive: false), 'tools'),
    MapEntry(RegExp(r'(sofa|carpet|shampoo|laundry|wash|sanitiz|disinfect|clean|maid|sweep|mop|deep.?clean)', caseSensitive: false), 'broom'),
    MapEntry(RegExp(r'(bath|shower|toilet)', caseSensitive: false), 'shower'),
    MapEntry(RegExp(r'(paint|waterproof|wall)', caseSensitive: false), 'palette'),
    MapEntry(RegExp(r'(repair|appliance|service|fix|maintenance|geyser|washing.?machine|microwave)', caseSensitive: false), 'wrench'),
  ];

  static String resolve(List<String?> hints) {
    for (final hint in hints) {
      if (hint == null || hint.trim().isEmpty) continue;
      final cleaned = hint.replaceAll(RegExp(r'[\uFE0F\u200D]'), '').trim();
      if (_emojiToIcon.containsKey(cleaned)) {
        return 'assets/icons/3d/${_emojiToIcon[cleaned]}.png';
      }
    }

    for (final hint in hints) {
      if (hint == null || hint.trim().isEmpty) continue;
      final text = hint.toLowerCase();
      for (final entry in _keywordPatterns) {
        if (entry.key.hasMatch(text)) {
          return 'assets/icons/3d/${entry.value}.png';
        }
      }
    }

    return 'assets/icons/3d/tools.png';
  }
}

