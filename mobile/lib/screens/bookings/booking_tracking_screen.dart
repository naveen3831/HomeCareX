import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/booking_model.dart';

class BookingTrackingScreen extends StatelessWidget {
  final BookingModel booking;

  const BookingTrackingScreen({super.key, required this.booking});

  @override
  Widget build(BuildContext context) {
    final stages = ['Confirmed', 'Partner Assigned', 'En Route', 'In Progress', 'Completed'];
    int currentStage = 1;
    if (booking.status == 'assigned') currentStage = 1;
    if (booking.status == 'en_route') currentStage = 2;
    if (booking.status == 'in_progress') currentStage = 3;
    if (booking.status == 'completed') currentStage = 4;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: const Text('Live Job Tracking', style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: AppColors.panel,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.ink),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(booking.serviceTitle, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.brandSoft,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          booking.status.toUpperCase(),
                          style: const TextStyle(color: AppColors.brand, fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Booking ID: #${booking.id.isNotEmpty ? booking.id.substring(booking.id.length - 8) : 'HCX-4082'}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 16),

                  // Start OTP Box (if assigned or in progress)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.accentSoft,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Service Start PIN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accentDark)),
                            Text('Share this with partner upon arrival', style: TextStyle(fontSize: 11, color: AppColors.ink)),
                          ],
                        ),
                        Text(
                          booking.startOtp ?? '4821',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 2, color: AppColors.accentDark),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Partner Profile Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: const BoxDecoration(
                      color: AppColors.brandSoft,
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Icon(Icons.person, color: AppColors.brand, size: 28),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          booking.partnerName ?? 'Ramesh Kumar',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.ink),
                        ),
                        const SizedBox(height: 2),
                        const Row(
                          children: [
                            Icon(Icons.star, color: Colors.amber, size: 14),
                            SizedBox(width: 2),
                            Text('4.9 • 380+ jobs done', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: AppColors.successSoft,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.phone, color: AppColors.success, size: 20),
                    ),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Connecting via masked secure call...')),
                      );
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Stepper
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Progress Stages', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 16),
                  for (int i = 0; i < stages.length; i++) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                color: i <= currentStage ? AppColors.brand : AppColors.canvas,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: i <= currentStage ? AppColors.brand : AppColors.line,
                                  width: 2,
                                ),
                              ),
                              child: Center(
                                child: i <= currentStage
                                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                                    : null,
                              ),
                            ),
                            if (i < stages.length - 1)
                              Container(
                                width: 2,
                                height: 32,
                                color: i < currentStage ? AppColors.brand : AppColors.line,
                              ),
                          ],
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              stages[i],
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: i == currentStage ? FontWeight.bold : FontWeight.w500,
                                color: i <= currentStage ? AppColors.ink : AppColors.muted,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

