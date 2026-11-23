import 'package:flutter/material.dart';

class Bell3DIcon extends StatelessWidget {
  final double size;

  const Bell3DIcon({super.key, this.size = 26});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        size: Size(size, size),
        painter: const _Bell3DPainter(),
      ),
    );
  }
}

class _Bell3DPainter extends CustomPainter {
  const _Bell3DPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 32.0;
    canvas.save();
    canvas.scale(scale, scale);

    // 1. Top handle knob
    final knobPaint = Paint()
      ..color = const Color(0xFFF26A0C)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(const Offset(16, 3.6), 1.7, knobPaint);

    // 2. Bell body with linear gradient (#FFC27A to #F26A0C)
    final bodyPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment(-0.56, -0.81),
        end: Alignment(0.56, 0.5),
        colors: [Color(0xFFFFC27A), Color(0xFFF26A0C)],
      ).createShader(const Rect.fromLTWH(0, 0, 32, 32))
      ..style = PaintingStyle.fill;

    final bodyPath = Path()
      ..moveTo(16, 4.6)
      ..cubicTo(11.3, 4.6, 8, 8.2, 8, 12.9)
      ..lineTo(8, 16.7)
      ..cubicTo(8, 18.7, 6.8, 20.1, 5.7, 21.3)
      ..cubicTo(5.1, 22.0, 5.5, 23.0, 6.4, 23.0)
      ..lineTo(25.6, 23.0)
      ..cubicTo(26.5, 23.0, 26.9, 22.0, 26.3, 21.3)
      ..cubicTo(25.2, 20.1, 24, 18.7, 24, 16.7)
      ..lineTo(24, 12.9)
      ..cubicTo(24, 8.2, 20.7, 4.6, 16, 4.6)
      ..close();
    canvas.drawPath(bodyPath, bodyPaint);

    // 3. Highlight stroke arc
    final highlightPaint = Paint()
      ..color = Colors.white.withOpacity(0.65)
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final highlightPath = Path()
      ..moveTo(10.4, 12.2)
      ..cubicTo(10.8, 9.6, 12.6, 7.8, 14.8, 7.3);
    canvas.drawPath(highlightPath, highlightPaint);

    // 4. Clapper (#FF9A3D to #D95A06)
    final clapperPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFFF9A3D), Color(0xFFD95A06)],
      ).createShader(const Rect.fromLTWH(12.6, 23, 6.8, 6))
      ..style = PaintingStyle.fill;
    final clapperPath = Path()
      ..moveTo(12.6, 24.6)
      ..arcToPoint(
        const Offset(19.4, 24.6),
        radius: const Radius.circular(3.5),
        clockwise: false,
      )
      ..close();
    canvas.drawPath(clapperPath, clapperPaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class NotificationBellButton extends StatelessWidget {
  final VoidCallback onTap;
  final int count;

  const NotificationBellButton({
    super.key,
    required this.onTap,
    this.count = 0,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Center(
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              const Bell3DIcon(size: 26),
              if (count > 0)
                Positioned(
                  top: -5,
                  right: -7,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    constraints: const BoxConstraints(
                      minWidth: 19,
                      minHeight: 19,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFEF4444).withOpacity(0.35),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
