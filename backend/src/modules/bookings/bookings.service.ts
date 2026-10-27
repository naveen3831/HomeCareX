      const created = await withSlotLock(
        `booking:${input.serviceId}:${input.date}:${input.slot}`,
        async () => {
          await bookingsRepository.releaseStaleHolds(
            input.serviceId,
            input.date,
            input.slot,
            now,
          );

          const seat = await bookingsRepository.findFreeSeat(
            input.serviceId,
            input.date,
            input.slot,
            capacity,
          );

          if (seat === null) {
            throw new AppError(
              409,
              "SLOT_UNAVAILABLE",
              "Selected slot is no longer available",
            );
          }

          const createdBooking =
            await bookingsRepository.create({
              customerId: new Types.ObjectId(customerId),
              serviceId: new Types.ObjectId(input.serviceId),
              ...(service.categoryId
                ? { categoryId: service.categoryId }
                : {}),
              quantity: input.quantity,
              addOns: input.addOns.map((item) => ({
                addOnId: new Types.ObjectId(item.addOnId),
                quantity: item.quantity,
              })),
              addressSnapshot: {
                ...addressSnapshot,
                sourceAddressId: addressSnapshot.sourceAddressId
                  ? new Types.ObjectId(
                      addressSnapshot.sourceAddressId,
                    )
                  : undefined,
              },
              serviceName: service.name,
              address: {
                line1: addressSnapshot.line1,
                area: addressSnapshot.line2,
                city: addressSnapshot.city,
                pincode: addressSnapshot.pincode,
                ...(addressSnapshot.location
                  ? {
                      location: {
                        type: "Point",
                        coordinates: [
                          addressSnapshot.location.lng,
                          addressSnapshot.location.lat,
                        ],
                      },
                    }
                  : {}),
              },
              scheduledAt: slotStartDate(
                input.date,
                input.slot,
              ),
              priceBreakdown: {
                base: lines[0].amount,
                addOns: pricing.addOnsTotal,
                surge: pricing.surge,
                discount: priceSnapshot.discount,
                convenienceFee: priceSnapshot.convenienceFee,
                tax: pricing.gst,
                total: priceSnapshot.total,
              },
              date: input.date,
              slot: input.slot,
              priceSnapshot,
              status: initialStatus,
              paymentStatus: initialPaymentStatus,
              statusHistory: [
                {
                  from: null,
                  to: initialStatus,
                  at: now,
                  actorId: customerId,
                  actorRole: "customer",
                  reason: requirePayment
                    ? "Booking created, awaiting payment"
                    : "Booking confirmed",
                },
              ],
              slotSeat: seat,
              idempotencyKey,
              requestHash,
              holdExpiresAt: requirePayment
                ? new Date(now.getTime() + BOOKING_HOLD_MS)
                : undefined,
            } as never);

          if (coupon) {
            await couponsService.recordUsage(
              coupon.code,
              customerId,
              String(
                (createdBooking as { _id?: unknown })._id ?? "",
              ),
            );
          }

          return createdBooking;
        },
      );

      void Promise.resolve(
        notifyAdmins("booking.created", {
          bookingId: String(
            (created as { _id?: unknown })._id ?? "",
          ),
          serviceId: input.serviceId,
        }),
      ).catch(() => undefined);