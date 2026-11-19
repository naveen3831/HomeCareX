import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/main.dart';

void main() {
  testWidgets('HomeCareXApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const HomeCareXApp());
    expect(find.byType(HomeCareXApp), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 2500));
  });
}
